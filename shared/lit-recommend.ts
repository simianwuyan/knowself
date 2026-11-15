// 智能文献推荐（前后端共用）：真实引文网络 + 关键词检索 → AI「前置/拓展」分类
// 前置文献来自论文的真实引用关系（OpenAlex cited references），不依赖关键词碰运气
import type { KnowledgeNode, Project } from "./types.ts";
import { fetchRefsForTitle, searchWorks, type WorkHit } from "./lit-search.ts";
import { classifyLiteratureAI, type ClassifiedLiterature } from "./ai-client.ts";
import type { AISettings } from "./types.ts";

function normTitle(s: string): string {
  return String(s || "").toLowerCase().replace(/\s+/g, "");
}

export type LiteratureItem = WorkHit & { why: string };

export interface LiteratureGroup {
  prereq: LiteratureItem[];
  extension: LiteratureItem[];
  /** 未能成功检索时给出提示（候选来源失败等） */
  notice?: string;
}

/**
 * 针对知识点的智能文献推荐：
 * 1. 前置候选：所属论文/种子论文的真实引文（OpenAlex cited references）+ 项目 paper 的题录
 * 2. 拓展候选：关键词检索（OpenAlex→Crossref）
 * 3. AI 分类与相关性筛选（过滤偏题项，给出理由）
 */
export async function smartLiterature(
  settings: AISettings,
  useMock: boolean | undefined,
  input: { node: KnowledgeNode; project: Project; query?: string }
): Promise<LiteratureGroup> {
  const { node, project } = input;
  const query = (input.query || node.name).trim();

  // ---- 组装候选（真实数据，AI 只做分类不编造） ----
  const candidates: WorkHit[] = [];
  const seen = new Set<string>();
  const push = (h: WorkHit) => {
    const key = normTitle(h.title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push(h);
  };
  const notices: string[] = [];

  // 1. 项目论文的题录（创建论文计划时已保存）
  if (project.paper?.refs?.length) {
    for (const r of project.paper.refs.slice(0, 25)) {
      push({ title: r.title, year: r.year, authors: [] });
    }
  }

  // 2. 种子论文的真实引文网络：优先项目论文标题，其次论文类节点自身
  const seedTitle =
    project.paper?.title || (node.kind === "paper" ? node.name : "") || project.direction;
  if (seedTitle) {
    try {
      const refs = await fetchRefsForTitle(seedTitle, 25);
      refs.forEach(push);
      if (!refs.length) notices.push("未能获取该论文的引文网络");
    } catch {
      notices.push("引文网络查询失败");
    }
  }

  // 3. 关键词检索（拓展候选）
  try {
    const kw = await searchWorks(query, 12);
    kw.forEach(push);
  } catch (e) {
    notices.push(
      (e as { status?: number }).status === 429
        ? "关键词检索被限流"
        : "关键词检索失败"
    );
  }

  const candidateList = candidates.slice(0, 45);
  if (!candidateList.length) {
    return {
      prereq: [],
      extension: [],
      notice: notices.join("；") || "没有找到候选文献，请换个关键词试试",
    };
  }

  // ---- AI 分类（前置/拓展 + 相关性过滤 + 理由） ----
  let classified: ClassifiedLiterature[] = [];
  let classifyNotice = "";
  try {
    classified = await classifyLiteratureAI(settings, useMock, {
      node,
      project,
      candidates: candidateList.map((c) => ({ title: c.title, year: c.year })),
    });
  } catch (e) {
    classifyNotice = "AI 分类失败，以下为未经筛选的候选结果";
  }

  const byTitle = new Map(candidateList.map((c) => [normTitle(c.title), c]));
  const result: LiteratureGroup = { prereq: [], extension: [] };
  for (const c of classified) {
    const hit = byTitle.get(normTitle(c.title));
    if (!hit) continue;
    (result[c.category] || result.extension).push({ ...hit, why: c.why } as LiteratureItem);
  }
  // AI 分类完全失败时：退回全部候选（标记为未分组），保证功能可用
  if (!result.prereq.length && !result.extension.length) {
    result.extension = candidateList.slice(0, 12).map((c) => ({ ...c, why: "" }) as LiteratureItem);
    if (classifyNotice) result.notice = classifyNotice;
  }
  if (notices.length && !result.notice) {
    result.notice = notices.join("；");
  }
  return result;
}
