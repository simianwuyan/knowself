// 后端接口抽象：同一套函数签名，两种实现（服务器模式 / 本地模式）
import type { CompareResult, PaperMeta, Project, ProjectSummary, Resource, SettingsView } from "../types";

export interface TestResult {
  reply: string;
  ms: number;
  model?: string;
}

export interface Backend {
  readonly mode: "server" | "local";
  fetchSettings(): Promise<SettingsView>;
  saveSettings(patch: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    useMock?: boolean;
  }): Promise<SettingsView>;
  testConnection(patch: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  }): Promise<TestResult>;
  fetchProjects(): Promise<ProjectSummary[]>;
  fetchProject(id: string): Promise<Project>;
  createProject(input: {
    direction: string;
    background?: string;
    goal?: string;
  }): Promise<Project>;
  generateTree(id: string): Promise<Project>;
  renameProject(id: string, title: string): Promise<Project>;
  deleteProject(id: string): Promise<null>;
  setNodeMastery(projectId: string, nodeId: string, mastery: string): Promise<Project>;
  addNode(
    projectId: string,
    input: {
      name: string;
      description?: string;
      importance?: string;
      estHours?: number;
      kind?: string;
      fromPaper?: string;
    }
  ): Promise<Project>;
  deleteNode(projectId: string, nodeId: string): Promise<Project>;
  expandNode(projectId: string, nodeId: string): Promise<Project>;
  recommendResources(projectId: string, nodeId: string): Promise<Project>;
  /** 手动追加一条资料（如收藏的文献） */
  addResource(projectId: string, nodeId: string, resource: Resource): Promise<Project>;
  /** 分析论文并合并进项目（meta 已由前端从 OpenAlex/粘贴文本组装） */
  analyzePaper(
    projectId: string,
    input: { meta: PaperMeta; direction: string; extraText?: string }
  ): Promise<{ project: Project; addedCount: number; skipped: string[] }>;
  /** AI 对比 2~4 个知识点（不落库） */
  compareNodes(projectId: string, nodeIds: string[]): Promise<CompareResult>;
  /** 保存对比记录 */
  saveComparison(
    projectId: string,
    input: { nodeNames: string[]; text: string }
  ): Promise<Project>;
  /** 删除对比记录 */
  deleteComparison(projectId: string, comparisonId: string): Promise<Project>;
  /** 导出全部数据为 JSON 字符串（备份/迁移用），两种模式都支持 */
  exportAll(): Promise<string>;
  /** 导入备份 JSON（仅本地模式支持，覆盖现有数据） */
  importAll(jsonText: string): Promise<number>;
}
