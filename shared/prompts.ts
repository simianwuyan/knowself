// AI 提示词集中管理（server 与浏览器本地模式共用）
import type { KnowledgeNode, PaperMeta, Project, ProjectPaper, TreeParams } from "./types.ts";

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

export function systemPromptForPaperAnalysis(): string {
  return `你是科研论文精读规划专家。用户给出将要精读的一篇论文（题录、摘要，可能附正文片段）以及其科研方向，你要拆解出「读懂这篇论文」所需的细粒度知识清单。

要求：
1. paperNode：论文本身，name 用论文原标题，description 用两三句话说明这篇论文的贡献、解决什么问题、为什么必读、学到什么程度；importance 一律 "core"；kind 一律 "paper"；estHours 2~6。
2. nodes：8~20 个读懂该论文所需的具体知识点——论文中用到的概念、模型/方法、关键公式或定理、工具技能。粒度与格式要求同清单生成：每个节点只含一个具体知识点，name 为具体名词（中文），description 一句话说明它在论文中的作用与要学到什么程度，kind 五选一（concept/model/formula/paper/tool），importance 三选一，prereqs 只能引用「本次输出其他节点 name」或「keyRefs 里的引文标题」，构成有向无环图，estHours 0.5~4（支持 0.5）。每个节点尽量给出 excerpt（论文原文对应片段，逐字摘自摘要/正文片段，无对应内容则空字符串）。
3. keyRefs：从给定「参考文献题录」中挑出 3~6 篇理解该论文必读的引文（优先：被论文方法直接依赖的奠基工作、同方向的经典综述）；每篇 {title, why}，title 必须逐字复制题录中的标题，why 一句话说明它是论文的哪块基础。若未提供参考文献题录，则 keyRefs 返回空数组，宁可缺失也不要编造不存在的论文。
4. 严禁循环依赖；概念→公式→模型→论文由浅入深。
5. ${KIND_DESC}
6. ${IMPORTANCE_DESC}

只输出一个 JSON 对象，不要输出任何其他文字，格式：
{"paperNode":{"name":"","description":"","kind":"paper","importance":"core","prereqs":[],"estHours":4},"nodes":[{"name":"","description":"","kind":"concept","importance":"core","prereqs":[],"estHours":1,"resources":[]}],"keyRefs":[{"title":"","why":""}]}`;
}

export function userPromptForPaperAnalysis({ meta, direction, extraText }: { meta: PaperMeta; direction: string; extraText?: string }): string {
  return `科研方向：${direction || "（未提供）"}
论文标题：${meta.title}
作者：${meta.authors.join("、") || "（无）"}
年份/期刊：${[meta.year, meta.venue].filter(Boolean).join(" / ") || "（无）"}
摘要：${meta.abstract || "（无）"}
${extraText ? `\n正文片段（用户粘贴）：\n${extraText.slice(0, 6000)}` : ""}
参考文献题录（真实引文数据，keyRefs 只能从中选）：
${meta.refs.length ? meta.refs.map((r, i) => `${i + 1}. ${r.title}${r.year ? ` (${r.year})` : ""}`).join("\n") : "（未提供，keyRefs 返回空数组）"}`;
}

export function systemPromptForPaperPlan(): string {
  return `你是科研论文精读规划专家。用户提供了一篇将要精读的论文（题录、摘要，通常附正文片段），请产出「以读懂这篇论文为中心」的完整学习路线。

要求：
1. 输出 20~40 个节点，覆盖：论文的问题背景与动机、方法链条的每个模块、关键公式/定理、实验设计与评价指标、结论与局限，以及 3~6 篇必读引文（kind="paper"，只能从给定参考文献题录中选，title 逐字复制）。
2. 粒度：每个节点只含一个具体知识点（概念/模型/公式/论文/工具），由浅入深构成有向无环图：基础概念 → 公式 → 方法模块 → 论文整体。
3. **excerpt（重要）**：每个节点给出论文原文中与它直接对应的片段——逐字摘自「摘要」或「正文片段」，2~4 句，放在双引号内不做改写；这是用户对照原文学习的锚点。给定文本中确实没有对应内容时 excerpt 返回空字符串，严禁编造或改写原文。
4. 每个节点：name（具体名词，中文；论文与引文节点用原标题）、description（一句话：学什么/在论文中的作用/学到什么程度）、kind（五选一）、importance（三选一）、prereqs（只能引用其他节点 name 或引文标题，严禁循环）、estHours（0.5~4，支持 0.5）、resources（0~2）、excerpt。
5. 论文本身也是节点：kind="paper"、name=论文原标题、prereqs 指向它的核心方法/公式节点与必读引文节点。
6. ${KIND_DESC}
7. ${IMPORTANCE_DESC}

只输出一个 JSON 对象，不要输出任何其他文字，格式：
{"title":"论文简称（10字内）","summary":"两三句话概括这篇论文讲什么、路线怎么安排","nodes":[{"name":"","description":"","kind":"concept","importance":"core","prereqs":[],"estHours":1,"resources":[],"excerpt":""}]}`;
}

export function userPromptForPaperPlan({ meta, direction, background, goal }: { meta: ProjectPaper; direction: string; background?: string; goal?: string }): string {
  return `论文标题：${meta.title}
作者：${meta.authors.join("、") || "（无）"}
年份/期刊：${[meta.year, meta.venue].filter(Boolean).join(" / ") || "（无）"}
科研方向：${direction || "（未提供）"}
读者背景：${background || "（未提供，按零基础/低年级研究生处理）"}
学习目标：${goal || "（未提供，按「彻底读懂并复现这篇论文」处理）"}
摘要：${meta.abstract || "（无）"}
${meta.extraText ? `\n正文片段（excerpt 必须逐字摘自摘要或以下正文）：\n${meta.extraText.slice(0, 8000)}` : "\n（未提供正文，excerpt 只能摘自摘要）"}
参考文献题录（必读引文只能从中选）：
${meta.refs.length ? meta.refs.map((r, i) => `${i + 1}. ${r.title}${r.year ? ` (${r.year})` : ""}`).join("\n") : "（未提供）"}`;
}

export function systemPromptForStudyCard(): string {
  return `你是科研学习辅导专家。用户正在精读论文/规划科研学习，针对给定的知识点（含描述、类型，可能附论文原文片段与用户掌握状态），生成一张「学习卡」帮助用户理解并自测。

输出两部分：
1. summary（概括）：300~500 字，2~3 段——这个知识点是什么、核心机制/内容是什么、在论文或该科研方向中起什么作用、学习的要点与易错处。语言具体、直接，不要空话。
2. questions（自测题）：3~5 个，按由浅到深排列：概念复述 → 机制/原因理解 → 应用或推导。每个问题 {q, a}：q 是具体可自测的问题（像背单词卡片一样，用户看 q 应能立刻自测）；a 是参考答案与解析（含为什么、常见误区），60~150 字。
3. 结合给出的论文原文片段出题，使自测贴合论文语境。

只输出一个 JSON 对象，不要输出任何其他文字，格式：
{"summary":"","questions":[{"q":"","a":""}]}`;
}

export function userPromptForStudyCard({ node, project }: { node: KnowledgeNode; project: Project }): string {
  return `科研方向：${project.direction || project.title}
知识节点：${node.name}（类型：${node.kind || "concept"}）
节点描述：${node.description || "（无）"}
${node.excerpt ? `论文原文片段：${node.excerpt}` : ""}
用户当前掌握状态：${node.mastery === "mastered" ? "已掌握（出题可更深入）" : node.mastery === "partial" ? "部分掌握（重点查漏）" : "未掌握（从基础问起）"}`;
}

export function systemPromptForCompare(): string {  return `你是科研学习辅导专家。用户给出 2~4 个知识点（含各自描述与类型），请输出一份异同对比讲解，并配套自测题，帮助读者辨析并加深理解。

输出 JSON 包含两部分：
1. text：纯文本对比讲解（不要 markdown 标记符号），按以下小节组织，每个小节一行标题加空行后接内容：
【共同点】它们本质上共享什么、属于同一类问题/工具吗
【关键差异】逐条对比，可用「A：…；B：…」形式，指出最核心的 2~4 条
【联系与依赖】谁是谁的基础/改进，在学习和使用顺序上的含义
【常见混淆点】初学者最容易搞混的地方与澄清
【怎么选/怎么学】一句话实践建议
总长度控制在 300~600 字，语言具体、直接，不要空话。
2. questions：2~3 道对比自测题——像背单词卡片一样，用户看问题应能自测「说得出两者的异同吗」。每个 {q, a}：q 是具体的对比问题（如「A 和 B 各自解决什么问题？核心差异在哪一条？」），a 是参考答案与解析（60~150 字，基于 text 内容）。

只输出一个 JSON 对象，不要输出任何其他文字，格式：
{"text":"...","questions":[{"q":"","a":""}]}`;
}

export function userPromptForCompare({ nodes }: { nodes: KnowledgeNode[] }): string {
  return `请对比以下知识点：
${nodes
  .map(
    (n, i) =>
      `${i + 1}. ${n.name}（类型：${n.kind || "concept"}）\n   描述：${n.description || "（无）"}`
  )
  .join("\n")}`;
}
