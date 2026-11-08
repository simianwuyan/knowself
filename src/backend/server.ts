// 服务器模式：数据存电脑端 JSON 文件，AI 经 Express 代理调用
import type { Backend, TestResult } from "./types";
import type { Project, ProjectSummary } from "../types";
import * as rest from "./rest";

export const serverBackend: Backend = {
  mode: "server",

  fetchSettings: () => rest.fetchSettings(),

  saveSettings: (patch) => rest.saveSettings(patch),

  testConnection: (patch) => rest.testConnection(patch) as Promise<TestResult>,

  fetchProjects: () => rest.fetchProjects(),

  fetchProject: (id) => rest.fetchProject(id),

  createProject: (input) => rest.createProject(input),

  generateTree: (id) => rest.generateTree(id),

  renameProject: (id, title) => rest.renameProject(id, title),

  deleteProject: (id) => rest.deleteProject(id),

  setNodeMastery: (pid, nid, mastery) => rest.setNodeMastery(pid, nid, mastery),

  addNode: (pid, input) => rest.addNode(pid, input),

  deleteNode: (pid, nid) => rest.deleteNode(pid, nid),

  expandNode: (pid, nid) => rest.expandNode(pid, nid),

  recommendResources: (pid, nid) => rest.recommendResources(pid, nid),

  addResource: (pid, nid, resource) => rest.addResource(pid, nid, resource),

  // 服务器模式导出：客户端拉取全部项目，组织成与本地模式相同的备份格式
  async exportAll() {
    const list = await rest.fetchProjects();
    const projects: Project[] = [];
    for (const item of list as ProjectSummary[]) {
      try {
        projects.push(await rest.fetchProject(item.id));
      } catch {
        /* 单个项目拉取失败则跳过 */
      }
    }
    return JSON.stringify(
      { version: 1, mode: "server", exportedAt: new Date().toISOString(), projects },
      null,
      2
    );
  },

  async importAll() {
    throw new Error("导入仅支持本地模式；服务器模式的数据在电脑端 data/ 目录中");
  },
};
