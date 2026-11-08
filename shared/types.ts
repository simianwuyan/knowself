// 前后端共享的类型定义（server 由 Node 26 原生 TS 加载，前端由 Vite 编译）
// 注意：只能使用可擦除语法（interface/type/函数），不能用 enum/namespace

export type Mastery = "unknown" | "partial" | "mastered";
export type Importance = "core" | "recommended" | "extension";
export type ResourceType = "book" | "course" | "paper" | "tutorial";
export type NodeKind = "concept" | "model" | "formula" | "paper" | "tool";

export interface Resource {
  title: string;
  type: ResourceType;
  note?: string;
  /** 可点击打开的链接（文献原文/搜索页） */
  url?: string;
  /** 开放获取 PDF 直链（如有） */
  pdfUrl?: string;
}

/** 知识点学习卡（按需 AI 生成，存于节点） */
export interface StudyCard {
  summary: string; // 概括讲解
  questions: { q: string; a: string }[]; // 自测问题与解析
  generatedAt: number;
}

export interface KnowledgeNode {
  id: string;
  name: string;
  description: string;
  importance: Importance;
  kind?: NodeKind; // 知识点类型：概念/模型/公式/论文/工具
  prereqs: string[]; // 引用其他节点 name
  estHours: number;
  resources: Resource[];
  mastery: Mastery;
  fromPaper?: string; // 来源论文标题（从论文导入的知识点）
  refs?: PaperRef[]; // 参考文献题录（仅 paper 节点）
  /** 论文原文中与该知识点直接对应的片段（逐字摘录，可能为空） */
  excerpt?: string;
  /** AI 学习卡：概括 + 自测题（用户点进知识点后按需生成） */
  study?: StudyCard;
}

export interface PaperRef {
  title: string;
  year?: number;
}

/** 论文精读计划的来源论文（题录 + 素材） */
export interface ProjectPaper {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  /** 用户粘贴的正文片段（用于生成 excerpt） */
  extraText?: string;
  refs: PaperRef[];
  source: "openalex" | "text";
}

export interface PaperMeta {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  citations?: number;
  doi?: string;
  refs: PaperRef[]; // 参考文献题录
  source: "openalex" | "text"; // openalex=链接/标题命中；text=用户粘贴文本
}

/** AI 从论文中提取的结果（合并由调用方完成） */
export interface PaperAnalysis {
  paperNode: Omit<KnowledgeNode, "id" | "mastery" | "refs">;
  nodes: Omit<KnowledgeNode, "id" | "mastery">[];
  keyRefs: { title: string; why: string }[];
}

/** 知识点对比记录 */
export interface Comparison {
  id: string;
  nodeNames: string[];
  text: string;
  /** 对比自测题（测「说得出异同吗」），存在时可进入卡片流自测 */
  questions?: { q: string; a: string }[];
  createdAt: number;
}

export interface CompareResult {
  text: string;
  /** 对比自测题（由 AI 基于对比内容生成） */
  questions: { q: string; a: string }[];
}

export interface Project {
  id: string;
  title: string;
  direction: string;
  background: string;
  goal: string;
  summary: string;
  nodes: KnowledgeNode[];
  comparisons?: Comparison[];
  /** 论文精读计划的来源论文（存在时 generate 走论文计划 prompt） */
  paper?: ProjectPaper;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSummary {
  id: string;
  title: string;
  direction: string;
  createdAt: number;
  total: number;
  mastered: number;
  partial: number;
  remainingHours: number;
}

export interface SettingsView {
  baseUrl: string;
  model: string;
  useMock: boolean;
  hasKey: boolean;
  isMock: boolean;
  /** 仅本地模式：Key 仍为旧版明文存储（重新保存即可升级为加密） */
  legacyPlainKey?: boolean;
}

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TreeParams {
  direction: string;
  background?: string;
  goal?: string;
}

/** 论文精读计划的生成参数 */
export interface PaperPlanParams {
  meta: ProjectPaper;
  direction: string;
  background?: string;
  goal?: string;
}

export interface TreeResult {
  title: string;
  summary: string;
  nodes: Omit<KnowledgeNode, "id" | "mastery">[];
}
