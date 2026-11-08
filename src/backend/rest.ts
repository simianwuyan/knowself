// 服务器模式的 REST 客户端（调用本机 Express 后端）
import type {
  CompareResult,
  PaperMeta,
  Project,
  ProjectPaper,
  ProjectSummary,
  Resource,
  SettingsView,
} from "../types";

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new Error("网络请求失败，请确认服务已启动");
  }
  let body: { ok?: boolean; data?: T; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `请求失败（${res.status}）`);
  }
  return body.data as T;
}

export const fetchSettings = () => request<SettingsView>("/api/settings");

export function saveSettings(patch: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  useMock?: boolean;
}) {
  return request<SettingsView>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function testConnection(patch: { baseUrl?: string; apiKey?: string; model?: string }) {
  return request<{ reply: string; ms: number; model?: string }>("/api/settings/test", {
    method: "POST",
    body: JSON.stringify(patch),
  });
}

export const fetchProjects = () => request<ProjectSummary[]>("/api/projects");

export const fetchProject = (id: string) => request<Project>(`/api/projects/${id}`);

export function createProject(input: {
  direction: string;
  background?: string;
  goal?: string;
  paper?: ProjectPaper;
}) {
  return request<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export const generateTree = (id: string) =>
  request<Project>(`/api/projects/${id}/generate`, { method: "POST" });

export function renameProject(id: string, title: string) {
  return request<Project>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export const deleteProject = (id: string) =>
  request<null>(`/api/projects/${id}`, { method: "DELETE" });

export function setNodeMastery(projectId: string, nodeId: string, mastery: string) {
  return request<Project>(`/api/projects/${projectId}/nodes/${nodeId}`, {
    method: "PATCH",
    body: JSON.stringify({ mastery }),
  });
}

export function addNode(
  projectId: string,
  input: { name: string; description?: string; importance?: string; estHours?: number }
) {
  return request<Project>(`/api/projects/${projectId}/nodes`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export const deleteNode = (projectId: string, nodeId: string) =>
  request<Project>(`/api/projects/${projectId}/nodes/${nodeId}`, { method: "DELETE" });

export const expandNode = (projectId: string, nodeId: string) =>
  request<Project>(`/api/projects/${projectId}/nodes/${nodeId}/expand`, { method: "POST" });

export const recommendResources = (projectId: string, nodeId: string) =>
  request<Project>(`/api/projects/${projectId}/nodes/${nodeId}/resources`, {
    method: "POST",
  });

export function addResource(projectId: string, nodeId: string, resource: Resource) {
  return request<Project>(`/api/projects/${projectId}/nodes/${nodeId}/resources/add`, {
    method: "POST",
    body: JSON.stringify(resource),
  });
}

export function analyzePaper(
  projectId: string,
  input: { meta: PaperMeta; direction: string; extraText?: string }
) {
  return request<{ project: Project; addedCount: number; skipped: string[] }>(
    `/api/projects/${projectId}/analyze-paper`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function compareNodes(projectId: string, nodeIds: string[]) {
  return request<CompareResult>(`/api/projects/${projectId}/compare`, {
    method: "POST",
    body: JSON.stringify({ nodeIds }),
  });
}

export function saveComparison(
  projectId: string,
  input: { nodeNames: string[]; text: string }
) {
  return request<Project>(`/api/projects/${projectId}/comparisons`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteComparison(projectId: string, comparisonId: string) {
  return request<Project>(`/api/projects/${projectId}/comparisons/${comparisonId}`, {
    method: "DELETE",
  });
}
