// AI 提示词集中管理（server 与浏览器本地模式共用）
import type { KnowledgeNode, Project, TreeParams } from "./types.ts";

export const IMPORTANCE_DESC = `importance 取值三选一：
- "core"：不掌握就无法读懂该方向论文的地基
- "recommended"：显著提升阅读效率与理解深度
- "extension"：拓展视野`;

export const KIND_DESC = `kind 标记知识点类型，五选一：
- "concept"：基础概念（如"条件独立性"、"注意力机制"）
- "model"：具体模型或方法（如"IV-Wald估计量"、"Transformer"）
- "formula"：公式或定理（如"贝叶斯公式"、"反事实分解定理"），description 中给出公式核心含义
- "paper"：领域经典或必读论文（name 用论文名，description 一句话说清其贡献与为什么必读）
- "tool"：工具技能（如"文献检索"、"Stata/R做因果分析"）`;

export function systemPromptForTree(): string {
  return `你是科研论文精读规划专家。用户给出科研方向、已有背景和学习目标，你要产出「读懂并能跟进该方向论文」所需的细粒度知识清单。

核心原则（务必遵守）：
1. 粒度要细：每个节点只包含一个具体的知识点——一个基础概念、一个具体模型/方法、一条关键公式或定理、一篇经典论文、一项工具技能。禁止输出"XX基础"、"XX理论与方法"这类笼统大节点。
2. 论文导向：以「读懂该方向的经典论文」为目标组织。把该方向 3~6 篇奠基性/必读论文作为 kind="paper" 的节点列入；论文节点的前置就是读懂它所需要的概念/模型/公式。
3. 数量与时长：输出 30~60 个节点；每个节点 estHours 0.5~6 小时（公式/概念 0.5~2，模型/方法 1~4，论文精读 2~6），使每个学习阶段（依赖层）总时长控制在 2~8 小时内，当天可完成。
4. 每个节点：name（具体名词短语，中文，论文节点用论文名）、description（一句话：学什么/这条公式说什么/这篇论文的贡献是什么，学到什么程度）、kind（五选一）、importance（三选一）、prereqs（前置节点 name 数组，必须引用清单中其他节点 name 原文，可为空）、estHours（数字，支持 0.5）、resources（0~2 个资料）。
5. resources 每项：title（资料名：教材章节/课程/论文名/文档）、type（"book"|"course"|"paper"|"tutorial" 四选一）、note（一句话理由，可选）。
6. 依赖关系必须构成有向无环图：概念→公式→模型→论文，由浅入深，严禁循环依赖。
7. ${KIND_DESC}
8. ${IMPORTANCE_DESC}
9. kind="paper" 的节点 resources 里给出论文本身（type="paper"）；重要公式节点 description 里说明公式形式或含义。

只输出一个 JSON 对象，不要输出任何其他文字、解释或 markdown 代码围栏，格式：
{"title":"研究方向标题（10字内）","summary":"两三句话概括该方向的知识结构与阅读路线","nodes":[{"name":"","description":"","kind":"concept","importance":"core","prereqs":[],"estHours":1,"resources":[{"title":"","type":"book","note":""}]}]}`;
}

export function userPromptForTree({ direction, background, goal }: TreeParams): string {
  return `科研方向：${direction}
已有背景：${background || "（未提供，按零基础/低年级本科生处理）"}
学习目标：${goal || "（未提供，按「能独立精读该方向论文并复现方法」处理）"}`;
}

export function systemPromptForExpand(): string {
  return `你是科研论文精读规划专家。用户会给你一个知识节点（含描述）及其所在科研方向上下文，请把该节点细化为 4~8 个更小的子知识点。

要求：
1. 粒度：每个子节点只含一个具体概念/模型/公式/论文步骤/工具操作，禁止笼统合并。
2. 每个子节点：name、description（一句话）、kind（五选一：concept/model/formula/paper/tool）、importance（三选一：core/recommended/extension）、estHours（0.5~4，支持 0.5）、prereqs、resources（0~2 个）。
3. 子节点间的依赖关系：每个子节点的 prereqs 只能引用「给定的上游前置知识名」或「本次输出的其他子节点名」，构成有向无环图，严禁循环依赖。
4. 子节点 estHours 总和应接近原节点的 estHours。
5. ${KIND_DESC}
6. ${IMPORTANCE_DESC}

只输出一个 JSON 对象，不要输出任何其他文字，格式：
{"children":[{"name":"","description":"","kind":"concept","importance":"core","prereqs":[],"estHours":1,"resources":[]}]}`;
}

export function userPromptForExpand({ node, project }: { node: KnowledgeNode; project: Project }): string {
  return `科研方向：${project.direction || project.title}
知识节点：${node.name}
节点类型：${node.kind || "concept"}
节点描述：${node.description || "（无）"}
原预计学时：${node.estHours || 2} 小时
该节点的上游前置知识：${(node.prereqs || []).join("、") || "（无）"}`;
}

export function systemPromptForResources(): string {
  return `你是科研学习资料推荐专家。针对给定的知识节点，推荐 3~5 个高质量中文可得的学习资料（经典教材章节、名校公开课、领域经典论文、优质教程/文档）。

要求：每个资料含 title（资料名）、type（"book"|"course"|"paper"|"tutorial" 四选一）、note（一两句推荐理由，说明适合什么阶段读）。

只输出一个 JSON 对象，不要输出任何其他文字，格式：
{"resources":[{"title":"","type":"book","note":""}]}`;
}

export function userPromptForResources({ node, project }: { node: KnowledgeNode; project: Project }): string {
  return `科研方向：${project.direction || project.title}
知识节点：${node.name}
节点描述：${node.description || "（无）"}
已有资料：${(node.resources || []).map((r) => r.title).join("、") || "（无）"}`;
}
