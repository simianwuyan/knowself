// AI 调用核心逻辑：server（Node）与浏览器本地模式共用
// 只依赖 fetch（Node 18+ 与浏览器均内置），设置与 mock 判断由调用方决定
import type {
  AISettings,
  CompareResult,
  Importance,
  KnowledgeNode,
  NodeKind,
  PaperAnalysis,
  PaperMeta,
  PaperPlanParams,
  Project,
  Resource,
  ResourceType,
  StudyCard,
  TreeParams,
  TreeResult,
} from "./types.ts";
import {
  systemPromptForTree,
  userPromptForTree,
  systemPromptForExpand,
  userPromptForExpand,
  systemPromptForResources,
  userPromptForResources,
  systemPromptForPaperAnalysis,
  userPromptForPaperAnalysis,
  systemPromptForPaperPlan,
  userPromptForPaperPlan,
  systemPromptForCompare,
  userPromptForCompare,
  systemPromptForStudyCard,
  userPromptForStudyCard,
} from "./prompts.ts";
import {
  mockTree,
  mockExpand,
  mockResources,
  mockTest,
  mockAnalyzePaper,
  mockCompare,
  mockPaperPlan,
  mockStudyCard,
} from "./mock.ts";
import { searchWorks } from "./lit-search.ts";

const TIMEOUT_MS = 120_000;

export function isMockSettings(s: AISettings, useMock?: boolean): boolean {
  if (useMock) return true;
  return !s.apiKey || !s.baseUrl;
}

function normalizeBaseUrl(url: string): string {
  let u = String(url || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  u = u.replace(/\/+$/, "");
  if (u.endsWith("/chat/completions")) return u;
  return `${u}/chat/completions`;
}

interface ChatOpts {
  temperature?: number;
  extraBody?: Record<string, unknown>;
  timeoutMs?: number;
}

async function rawChat(
  settings: AISettings,
  messages: { role: string; content: string }[],
  { temperature = 0.4, extraBody, timeoutMs = TIMEOUT_MS }: ChatOpts = {}
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(normalizeBaseUrl(settings.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || "gpt-4o-mini",
        messages,
        temperature,
        ...extraBody,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI 接口返回 ${res.status}：${text.slice(0, 300)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("AI 返回内容为空");
    }
    return content;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`AI 请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`AI 请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// 从 AI 回复中提取 JSON：剥代码围栏、截取首尾大括号
export function extractJson(text: string): Record<string, unknown> {
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("回复中未找到 JSON 对象");
  }
  return JSON.parse(t.slice(start, end + 1));
}

async function chatJson(
  settings: AISettings,
  system: string,
  user: string,
  { temperature = 0.4 }: { temperature?: number } = {}
): Promise<Record<string, unknown>> {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  // 优先要求 json_object 输出（不兼容的服务端可能报错，失败则降级重试）
  let content: string;
  try {
    content = await rawChat(settings, messages, {
      temperature,
      extraBody: { response_format: { type: "json_object" } },
    });
  } catch {
    content = await rawChat(settings, messages, { temperature });
  }
  try {
    return extractJson(content);
  } catch (err) {
    // 带错误信息重试一次
    const retryMessages = [
      ...messages,
      { role: "assistant", content },
      {
        role: "user",
        content: `你的输出无法被 JSON.parse 解析（${err instanceof Error ? err.message : "格式错误"}）。请重新输出，只输出一个合法的 JSON 对象，不要任何其他文字。`,
      },
    ];
    const retry = await rawChat(settings, retryMessages, { temperature: 0.2 });
    return extractJson(retry);
  }
}

// ---------- 校验/规范化 ----------

function importanceOk(v: unknown): v is Importance {
  return v === "core" || v === "recommended" || v === "extension";
}

const RESOURCE_TYPES: ResourceType[] = ["book", "course", "paper", "tutorial"];
const NODE_KINDS: NodeKind[] = ["concept", "model", "formula", "paper", "tool"];

function kindOk(v: unknown): NodeKind | undefined {
  return NODE_KINDS.includes(v as NodeKind) ? (v as NodeKind) : undefined;
}

/** 细粒度学时：按 0.5 小时取整，最低 0.5 */
function cleanHours(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(50, Math.max(0.5, Math.round(n * 2) / 2));
}

/** 论文原文片段：截断至 800 字 */
function cleanExcerpt(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const t = v.trim().slice(0, 800);
  return t || undefined;
}

export function cleanResources(list: unknown): Resource[] {
  return Array.isArray(list)
    ? list
        .filter(
          (r): r is { title: string; type?: string; note?: string } =>
            Boolean(r) && typeof (r as { title?: unknown }).title === "string" &&
            Boolean((r as { title?: string }).title?.trim())
        )
        .map((r) => ({
          title: r.title.trim(),
          type: RESOURCE_TYPES.includes(r.type as ResourceType)
            ? (r.type as ResourceType)
            : "book",
          note: typeof r.note === "string" ? r.note.trim() : "",
        }))
    : [];
}

export function cleanPrereqs(list: unknown, validNames: Set<string>): string[] {
  return Array.isArray(list)
    ? list
        .filter(
          (p): p is string =>
            typeof p === "string" && validNames.has(p.trim())
        )
        .map((p) => p.trim())
    : [];
}

export function normalizeTree(json: Record<string, unknown>, params: TreeParams): TreeResult {
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  if (nodes.length < 5) throw new Error("AI 生成的知识节点过少，请重试");
  const names = new Set(
    nodes
      .map((n) => (n && typeof (n as { name?: unknown }).name === "string" ? ((n as { name: string }).name || "").trim() : ""))
      .filter(Boolean)
  );
  const cleaned = nodes
    .filter(
      (n): n is Record<string, unknown> =>
        Boolean(n) && typeof (n as { name?: unknown }).name === "string" && Boolean((n as { name: string }).name.trim())
    )
    .map((n) => ({
      name: (n.name as string).trim(),
      description: typeof n.description === "string" ? (n.description as string).trim() : "",
      kind: kindOk(n.kind),
      importance: importanceOk(n.importance) ? n.importance : ("recommended" as Importance),
      prereqs: cleanPrereqs(n.prereqs, names),
      estHours: cleanHours(n.estHours, 1.5),
      resources: cleanResources(n.resources),
      excerpt: cleanExcerpt(n.excerpt),
    }));
  return {
    title:
      typeof json.title === "string" && json.title.trim()
        ? json.title.trim()
        : params.direction,
    summary: typeof json.summary === "string" ? json.summary.trim() : "",
    nodes: cleaned,
  };
}

// ---------- 对外接口 ----------

export async function generateTreeAI(
  settings: AISettings,
  useMock: boolean | undefined,
  params: TreeParams
): Promise<TreeResult> {
  if (isMockSettings(settings, useMock)) return mockTree(params);
  const json = await chatJson(
    settings,
    systemPromptForTree(),
    userPromptForTree(params),
    { temperature: 0.5 }
  );
  return normalizeTree(json, params);
}

/** 论文精读计划：以一篇论文为中心生成完整学习路线（含原文对应片段） */
export async function generatePaperPlanAI(
  settings: AISettings,
  useMock: boolean | undefined,
  params: PaperPlanParams
): Promise<TreeResult> {
  if (isMockSettings(settings, useMock)) return mockPaperPlan(params);
  const json = await chatJson(
    settings,
    systemPromptForPaperPlan(),
    userPromptForPaperPlan(params),
    { temperature: 0.4 }
  );
  return normalizeTree(json, { direction: params.meta.title });
}

export async function expandNodeAI(
  settings: AISettings,
  useMock: boolean | undefined,
  node: KnowledgeNode,
  project: Project
): Promise<{ children: Omit<KnowledgeNode, "id" | "mastery">[] }> {
  if (isMockSettings(settings, useMock)) return mockExpand({ node });
  const json = await chatJson(
    settings,
    systemPromptForExpand(),
    userPromptForExpand({ node, project }),
    { temperature: 0.4 }
  );
  const children = Array.isArray(json.children) ? json.children : [];
  if (!children.length) throw new Error("AI 未返回子知识点，请重试");
  const childNames = new Set(
    children
      .map((c) => (c && typeof (c as { name?: unknown }).name === "string" ? (c as { name: string }).name.trim() : ""))
      .filter(Boolean)
  );
  return {
    children: children
      .filter(
        (c): c is Record<string, unknown> =>
          Boolean(c) && typeof (c as { name?: unknown }).name === "string" && Boolean((c as { name: string }).name.trim())
      )
      .map((c) => ({
        name: (c.name as string).trim(),
        description: typeof c.description === "string" ? (c.description as string).trim() : "",
        kind: kindOk(c.kind),
        importance: importanceOk(c.importance) ? c.importance : ("recommended" as Importance),
        prereqs: cleanPrereqs(c.prereqs, childNames),
        estHours: cleanHours(c.estHours, 1),
        resources: cleanResources(c.resources),
      })),
  };
}

function bingSearchUrl(title: string): string {
  return `https://www.bing.com/search?q=${encodeURIComponent(title)}`;
}

/**
 * 为 AI 推荐的资料配链接：
 * - 论文类：OpenAlex/Crossref 按标题检索，配 DOI 原文与开放获取 PDF（失败则 Bing 搜索兜底）
 * - 其他类型：配 Bing 搜索链接（保证总能打开）
 */
async function enrichResources(resources: Resource[]): Promise<Resource[]> {
  const out: Resource[] = [];
  for (const r of resources) {
    try {
      if (r.type === "paper" && !r.url) {
        const hits = await searchWorks(r.title, 1);
        if (hits[0]) {
          out.push({
            ...r,
            url: hits[0].landingUrl || bingSearchUrl(r.title),
            pdfUrl: hits[0].pdfUrl,
          });
          continue;
        }
      }
    } catch {
      /* 富化失败不影响主结果 */
    }
    out.push({ ...r, url: r.url || bingSearchUrl(r.title) });
  }
  return out;
}

export async function recommendResourcesAI(
  settings: AISettings,
  useMock: boolean | undefined,
  node: KnowledgeNode,
  project: Project
): Promise<{ resources: Resource[] }> {
  if (isMockSettings(settings, useMock)) return mockResources({ node });
  const json = await chatJson(
    settings,
    systemPromptForResources(),
    userPromptForResources({ node, project }),
    { temperature: 0.6 }
  );
  const resources = Array.isArray(json.resources) ? json.resources : [];
  if (!resources.length) throw new Error("AI 未返回资料推荐，请重试");
  const cleaned = cleanResources(resources);
  // 为每条资料配可点击链接（论文→真实文献链接，其余→搜索页）
  return { resources: await enrichResources(cleaned) };
}

export async function testConnectionAI(
  settings: AISettings,
  useMock: boolean | undefined,
  overrides: Partial<AISettings> = {}
): Promise<{ reply: string; ms: number; model?: string }> {
  const s: AISettings = { ...settings, ...overrides };
  if (isMockSettings(s, useMock)) return mockTest();
  const started = Date.now();
  const reply = await rawChat(
    s,
    [{ role: "user", content: "请只回复两个字母：OK" }],
    { temperature: 0, extraBody: { max_tokens: 10 }, timeoutMs: 30_000 }
  );
  return { reply: reply.trim(), ms: Date.now() - started, model: s.model };
}

// ---------- 论文分析 / 知识点对比 ----------

function cleanNodeList(
  list: unknown,
  validNames: Set<string>,
  defaultHours: number,
  fromPaper?: string
): Omit<KnowledgeNode, "id" | "mastery">[] {
  return (Array.isArray(list) ? list : [])
    .filter(
      (n): n is Record<string, unknown> =>
        Boolean(n) && typeof (n as { name?: unknown }).name === "string" && Boolean((n as { name: string }).name.trim())
    )
    .map((n) => ({
      name: (n.name as string).trim(),
      description: typeof n.description === "string" ? (n.description as string).trim() : "",
      kind: kindOk(n.kind),
      importance: importanceOk(n.importance) ? n.importance : ("recommended" as Importance),
      prereqs: cleanPrereqs(n.prereqs, validNames),
      estHours: cleanHours(n.estHours, defaultHours),
      resources: cleanResources(n.resources),
      excerpt: cleanExcerpt(n.excerpt),
      ...(fromPaper ? { fromPaper } : {}),
    }));
}

/** AI 分析论文：拆出论文节点、知识点与必读引文（合并由调用方完成） */
export async function analyzePaperAI(
  settings: AISettings,
  useMock: boolean | undefined,
  input: { meta: PaperMeta; direction: string; extraText?: string }
): Promise<PaperAnalysis> {
  if (isMockSettings(settings, useMock)) return mockAnalyzePaper({ meta: input.meta });
  const json = await chatJson(
    settings,
    systemPromptForPaperAnalysis(),
    userPromptForPaperAnalysis({ meta: input.meta, direction: input.direction, extraText: input.extraText }),
    { temperature: 0.4 }
  );
  const pn = json.paperNode as Record<string, unknown> | undefined;
  if (!pn || typeof pn.name !== "string" || !pn.name.trim()) {
    throw new Error("AI 未返回论文节点，请重试");
  }
  const paperName = pn.name.trim();
  const keyRefs = (Array.isArray(json.keyRefs) ? json.keyRefs : [])
    .filter(
      (r): r is { title: string; why: string } =>
        Boolean(r) && typeof (r as { title?: unknown }).title === "string" && Boolean((r as { title: string }).title.trim())
    )
    .map((r) => ({
      title: r.title.trim(),
      why: typeof r.why === "string" ? r.why.trim() : "",
    }));
  const refTitles = new Set(keyRefs.map((r) => r.title));
  const rawNodes = Array.isArray(json.nodes) ? json.nodes : [];
  const nodeNames = new Set(
    rawNodes
      .map((n) => (n && typeof (n as { name?: unknown }).name === "string" ? ((n as { name: string }).name || "").trim() : ""))
      .filter(Boolean)
  );
  // 两遍扫描：先收集全部节点名，再清洗，保证节点间互相引用不被误删
  const validNames = new Set([paperName, ...refTitles, ...nodeNames]);
  const nodes = cleanNodeList(rawNodes, validNames, 1.5, paperName);
  const paperNode = cleanNodeList([{ ...pn, kind: "paper", importance: "core" }], validNames, 4)[0];
  return { paperNode, nodes, keyRefs };
}

/** 学习卡：知识点概括 + 自测题（用户点进知识点后按需生成） */
export async function generateStudyCardAI(
  settings: AISettings,
  useMock: boolean | undefined,
  node: KnowledgeNode,
  project: Project
): Promise<StudyCard> {
  if (isMockSettings(settings, useMock)) return mockStudyCard({ node });
  const json = await chatJson(
    settings,
    systemPromptForStudyCard(),
    userPromptForStudyCard({ node, project }),
    { temperature: 0.5 }
  );
  const summary = typeof json.summary === "string" ? json.summary.trim() : "";
  const rawQs = Array.isArray(json.questions) ? json.questions : [];
  const questions = rawQs
    .filter(
      (q): q is { q: string; a: string } =>
        Boolean(q) &&
        typeof (q as { q?: unknown }).q === "string" &&
        Boolean((q as { q: string }).q.trim()) &&
        typeof (q as { a?: unknown }).a === "string"
    )
    .map((q) => ({ q: q.q.trim().slice(0, 300), a: q.a.trim().slice(0, 800) }))
    .slice(0, 6);
  if (!summary && !questions.length) throw new Error("AI 未返回学习卡内容，请重试");
  return { summary, questions, generatedAt: Date.now() };
}

/** AI 对比 2~4 个知识点，返回纯文本讲解 */
export async function compareNodesAI(
  settings: AISettings,
  useMock: boolean | undefined,
  nodes: KnowledgeNode[]
): Promise<CompareResult> {
  if (isMockSettings(settings, useMock)) return mockCompare({ nodes });
  if (nodes.length < 2 || nodes.length > 4) {
    throw new Error("请选择 2~4 个知识点进行对比");
  }
  const raw = await rawChat(
    settings,
    [
      { role: "system", content: systemPromptForCompare() },
      { role: "user", content: userPromptForCompare({ nodes }) },
    ],
    { temperature: 0.5 }
  );
  // 期望 {"text": "...", "questions": [...]}；兼容只返回纯文本的模型
  let text = raw.trim();
  let questions: { q: string; a: string }[] = [];
  try {
    const obj = extractJson(text);
    if (obj && typeof obj.text === "string" && obj.text.trim()) {
      text = obj.text.trim();
      questions = (Array.isArray(obj.questions) ? obj.questions : [])
        .filter(
          (q): q is { q: string; a: string } =>
            Boolean(q) &&
            typeof (q as { q?: unknown }).q === "string" &&
            Boolean((q as { q: string }).q.trim()) &&
            typeof (q as { a?: unknown }).a === "string"
        )
        .map((q) => ({ q: q.q.trim().slice(0, 300), a: q.a.trim().slice(0, 800) }))
        .slice(0, 3);
    }
  } catch {
    // 不是 JSON，按纯文本使用（无自测题）
  }
  return { text, questions };
}
