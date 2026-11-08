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
}

export interface PaperRef {
  title: string;
  year?: number;
}

export interface PaperMeta {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  citations?: number;
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
  createdAt: number;
}

export interface CompareResult {
  text: string;
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

export interface TreeResult {
  title: string;
  summary: string;
  nodes: Omit<KnowledgeNode, "id" | "mastery">[];
}
