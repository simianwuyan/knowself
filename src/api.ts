// 前端统一入口：启动时探测运行环境，自动选择 服务器模式 / 本地模式
// 组件层只 import 本模块，不感知底层实现
import type { Backend } from "./backend/types";
import type { CompareResult, PaperMeta, Resource } from "./types";
import { serverBackend } from "./backend/server";
import { localBackend } from "./backend/local";

let active: Backend | null = null;

export async function detectBackend(): Promise<"server" | "local"> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    const res = await fetch("/api/settings", { signal: ctl.signal });
    clearTimeout(timer);
    // 服务器模式：/api/settings 返回 JSON；静态托管下通常返回 404 或 HTML
    const ct = res.headers.get("content-type") || "";
    active = res.ok && ct.includes("application/json") ? serverBackend : localBackend;
  } catch {
    active = localBackend;
  }
  return active.mode;
}

export function backendMode(): "server" | "local" {
  return active?.mode ?? "server";
}

function b(): Backend {
  if (!active) {
    // 兜底：组件在检测完成前调用的极端情况
    active = localBackend;
  }
  return active;
}

// ---------- 与旧版 api.ts 同名的转发导出（组件零改动） ----------

export const fetchSettings = () => b().fetchSettings();

export const saveSettings = (patch: Parameters<Backend["saveSettings"]>[0]) =>
  b().saveSettings(patch);

export const testConnection = (patch: Parameters<Backend["testConnection"]>[0]) =>
  b().testConnection(patch);

export const fetchProjects = () => b().fetchProjects();

export const fetchProject = (id: string) => b().fetchProject(id);

export const createProject = (input: Parameters<Backend["createProject"]>[0]) =>
  b().createProject(input);

export const generateTree = (id: string) => b().generateTree(id);

export const renameProject = (id: string, title: string) => b().renameProject(id, title);

export const deleteProject = (id: string) => b().deleteProject(id);

export const setNodeMastery = (pid: string, nid: string, mastery: string) =>
  b().setNodeMastery(pid, nid, mastery);

export const addNode = (pid: string, input: Parameters<Backend["addNode"]>[1]) =>
  b().addNode(pid, input);

export const deleteNode = (pid: string, nid: string) => b().deleteNode(pid, nid);

export const expandNode = (pid: string, nid: string) => b().expandNode(pid, nid);

export const recommendResources = (pid: string, nid: string) =>
  b().recommendResources(pid, nid);

export const addResource = (pid: string, nid: string, resource: Resource) =>
  b().addResource(pid, nid, resource);

export const analyzePaper = (
  pid: string,
  input: { meta: PaperMeta; direction: string; extraText?: string }
) => b().analyzePaper(pid, input);

export const compareNodes = (pid: string, nodeIds: string[]) =>
  b().compareNodes(pid, nodeIds) as Promise<CompareResult>;

export const saveComparison = (pid: string, input: { nodeNames: string[]; text: string }) =>
  b().saveComparison(pid, input);

export const deleteComparison = (pid: string, comparisonId: string) =>
  b().deleteComparison(pid, comparisonId);

// ---------- 备份 / 迁移 ----------

export const exportAllData = () => b().exportAll();

export const importAllData = (jsonText: string) => b().importAll(jsonText);
