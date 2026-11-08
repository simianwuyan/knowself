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
}

export interface Project {
  id: string;
  title: string;
  direction: string;
  background: string;
  goal: string;
  summary: string;
  nodes: KnowledgeNode[];
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
