// 论文分析结果合并进项目（server 与浏览器本地模式共用）
import type { KnowledgeNode, PaperAnalysis, PaperMeta, Project } from "./types.ts";

export function normName(s: string): string {
  return String(s || "").toLowerCase().replace(/\s+/g, "");
}

export interface MergeOutcome {
  nodes: KnowledgeNode[]; // 全部节点（合并后）
  addedCount: number;
  skipped: string[]; // 因重名被跳过的节点名
}

function shortId(): string {
  // 双模式通用 id 生成（浏览器与 Node 均支持 crypto.randomUUID）
  return crypto.randomUUID();
}

export function mergePaperAnalysis(
  project: Project,
  analysis: PaperAnalysis,
  meta: PaperMeta
): MergeOutcome {
  const existing = new Set(project.nodes.map((n) => normName(n.name)));
  const added: KnowledgeNode[] = [];
  const skipped: string[] = [];

  // 1. 概念/模型/公式节点
  for (const n of analysis.nodes) {
    if (existing.has(normName(n.name))) {
      skipped.push(n.name);
      continue;
    }
    added.push({ ...n, id: shortId(), mastery: "unknown" });
    existing.add(normName(n.name));
  }

  // 2. 必读引文节点（真实参考文献题录）
  for (const kr of analysis.keyRefs) {
    if (existing.has(normName(kr.title))) {
      skipped.push(kr.title);
      continue;
    }
    added.push({
      id: shortId(),
      name: kr.title,
      description: kr.why,
      kind: "paper",
      importance: "recommended",
      prereqs: [],
      estHours: 3,
      resources: [],
      mastery: "unknown",
      fromPaper: analysis.paperNode.name,
    });
    existing.add(normName(kr.title));
  }

  // 3. 论文节点（前置 = AI 给出的概念/公式/引文名；附带完整参考文献题录）
  if (existing.has(normName(analysis.paperNode.name))) {
    skipped.push(analysis.paperNode.name);
  } else {
    added.push({
      ...analysis.paperNode,
      refs: meta.refs.map((r) => ({ title: r.title, year: r.year })),
      id: shortId(),
      mastery: "unknown",
    });
  }

  project.nodes = [...project.nodes, ...added];
  project.updatedAt = Date.now();
  return { nodes: project.nodes, addedCount: added.length, skipped };
}
