// 本地模式：数据存浏览器 localStorage，AI 由浏览器直连（无需任何服务器）
import type { Backend, KeyLockState, TestResult } from "./types";
import type {
  AISettings,
  CompareResult,
  KnowledgeNode,
  Mastery,
  Project,
  ProjectSummary,
  SettingsView,
} from "../types";
import {
  expandNodeAI,
  generateTreeAI,
  generatePaperPlanAI,
  recommendResourcesAI,
  testConnectionAI,
  analyzePaperAI,
  compareNodesAI,
  generateStudyCardAI,
} from "../../shared/ai-client";
import { mergePaperAnalysis, normName } from "../../shared/merge";
import { encryptWithPin, decryptWithPin } from "../crypto";

const LS_SETTINGS = "knowself:settings";
const LS_PROJECTS = "knowself:projects";
const SS_KEY_SKIP = "knowself:keySkip";

interface LocalSettings {
  baseUrl: string;
  model: string;
  useMock: boolean;
  /** 加密保存的 API Key（PIN 加密，格式 salt.iv.ct） */
  keyEnc?: string;
  /** 旧版本的明文 Key（兼容读取，重新保存后升级为加密） */
  apiKey?: string;
}

/** 解锁后的 Key 只保存在内存中，页面关闭即消失 */
let memKey: string | null = null;

function loadSettingsRaw(): LocalSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) return { useMock: false, ...JSON.parse(raw) };
  } catch {
    /* 损坏则重置 */
  }
  return { baseUrl: "", model: "", useMock: false };
}

function saveSettingsRaw(s: LocalSettings) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
}

/** 当前 Key 的锁定状态 */
export function keyLockState(): KeyLockState {
  const s = loadSettingsRaw();
  if (s.keyEnc) {
    if (memKey) return "unlocked";
    return sessionStorage.getItem(SS_KEY_SKIP) ? "none" : "locked";
  }
  if (s.apiKey) return "unlocked"; // 旧版明文，兼容可用
  return "none";
}

/** 用 PIN 解锁已加密保存的 Key（解密结果仅存内存） */
export async function unlockKey(pin: string): Promise<void> {
  const s = loadSettingsRaw();
  if (!s.keyEnc) throw new Error("未设置加密保存的 Key");
  memKey = await decryptWithPin(pin, s.keyEnc);
  sessionStorage.removeItem(SS_KEY_SKIP);
}

/** 本会话跳过解锁（进入 Mock 模式） */
export function skipUnlock(): void {
  sessionStorage.setItem(SS_KEY_SKIP, "1");
}

function currentKey(): string {
  const s = loadSettingsRaw();
  return memKey ?? s.apiKey ?? "";
}

function toView(s: LocalSettings): SettingsView {
  const hasKey = Boolean(s.keyEnc || s.apiKey || memKey);
  const legacyPlainKey = Boolean(s.apiKey && !s.keyEnc);
  const locked = keyLockState() === "locked";
  return {
    baseUrl: s.baseUrl,
    model: s.model,
    useMock: s.useMock,
    hasKey,
    legacyPlainKey,
    isMock: s.useMock || !s.baseUrl || !hasKey || locked,
  };
}

function loadAllProjects(): Record<string, Project> {
  try {
    const raw = localStorage.getItem(LS_PROJECTS);
    if (raw) return JSON.parse(raw);
  } catch {
    /* 损坏则重置 */
  }
  return {};
}

function saveAllProjects(all: Record<string, Project>) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(all));
}

function loadProject(id: string): Project {
  const p = loadAllProjects()[id];
  if (!p) throw new Error("项目不存在");
  return p;
}

function putProject(p: Project): Project {
  const all = loadAllProjects();
  all[p.id] = p;
  saveAllProjects(all);
  return p;
}

function toSummary(p: Project): ProjectSummary {
  const nodes = p.nodes || [];
  return {
    id: p.id,
    title: p.title || p.direction || "未命名项目",
    direction: p.direction || "",
    createdAt: p.createdAt || 0,
    total: nodes.length,
    mastered: nodes.filter((n) => n.mastery === "mastered").length,
    partial: nodes.filter((n) => n.mastery === "partial").length,
    remainingHours: nodes
      .filter((n) => n.mastery !== "mastered")
      .reduce((s, n) => s + (Number(n.estHours) || 0), 0),
  };
}

function settingsWith(patch?: Partial<AISettings>): { settings: AISettings; useMock: boolean } {
  const s = loadSettingsRaw();
  const settings: AISettings = {
    baseUrl: patch?.baseUrl !== undefined ? patch.baseUrl : s.baseUrl,
    apiKey: patch?.apiKey !== undefined ? patch.apiKey : currentKey(),
    model: patch?.model !== undefined ? patch.model : s.model,
  };
  return { settings, useMock: s.useMock };
}

function newId(): string {
  return crypto.randomUUID();
}

export const localBackend: Backend = {
  mode: "local",

  keyLockState,

  unlockKey,

  skipUnlock,

  async fetchSettings() {
    return toView(loadSettingsRaw());
  },

  async saveSettings(patch) {
    const s = loadSettingsRaw();
    if (typeof patch.baseUrl === "string") s.baseUrl = patch.baseUrl.trim();
    if (typeof patch.model === "string") s.model = patch.model.trim();
    if (typeof patch.useMock === "boolean") s.useMock = patch.useMock;
    if (typeof patch.apiKey === "string") {
      const k = patch.apiKey.trim();
      if (k === "") {
        // 空 = 清除
        delete s.keyEnc;
        delete s.apiKey;
        memKey = null;
        sessionStorage.removeItem(SS_KEY_SKIP);
      } else if (typeof patch.pin === "string" && patch.pin.length >= 4) {
        // 加密保存（本地模式）
        s.keyEnc = await encryptWithPin(patch.pin, k);
        delete s.apiKey;
        memKey = k;
        sessionStorage.removeItem(SS_KEY_SKIP);
      } else {
        // 无 PIN：明文保存（服务器模式习惯 / 兜底）
        s.apiKey = k;
        delete s.keyEnc;
        memKey = k;
      }
    }
    saveSettingsRaw(s);
    return toView(s);
  },

  async testConnection(patch) {
    const { settings, useMock } = settingsWith(patch);
    return testConnectionAI(settings, useMock) as Promise<TestResult>;
  },

  async fetchProjects() {
    return Object.values(loadAllProjects())
      .map(toSummary)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async fetchProject(id) {
    return loadProject(id);
  },

  async createProject(input) {
    const now = Date.now();
    const project: Project = {
      id: newId(),
      title: input.direction.trim().slice(0, 40),
      direction: input.direction.trim(),
      background: (input.background || "").trim(),
      goal: (input.goal || "").trim(),
      summary: "",
      nodes: [],
      paper: input.paper,
      createdAt: now,
      updatedAt: now,
    };
    return putProject(project);
  },

  async generateTree(id) {
    const project = loadProject(id);
    const { settings, useMock } = settingsWith();
    const tree = project.paper
      ? await generatePaperPlanAI(settings, useMock, {
          meta: project.paper,
          direction: project.direction,
          background: project.background,
          goal: project.goal,
        })
      : await generateTreeAI(settings, useMock, {
          direction: project.direction,
          background: project.background,
          goal: project.goal,
        });
    // 重新生成时按名称继承旧的掌握状态
    const oldMastery = new Map(
      (project.nodes || []).map((n) => [normName(n.name), n.mastery])
    );
    project.nodes = tree.nodes.map((n) => ({
      ...n,
      id: newId(),
      mastery: (oldMastery.get(normName(n.name)) || "unknown") as Mastery,
    }));
    project.title = tree.title || project.title;
    project.summary = tree.summary || "";
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async renameProject(id, title) {
    const project = loadProject(id);
    project.title = title.trim().slice(0, 60);
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async deleteProject(id) {
    const all = loadAllProjects();
    delete all[id];
    saveAllProjects(all);
    return null;
  },

  async setNodeMastery(pid, nid, mastery) {
    const project = loadProject(pid);
    const node = project.nodes.find((n) => n.id === nid);
    if (!node) throw new Error("节点不存在");
    if (!["unknown", "partial", "mastered"].includes(mastery)) {
      throw new Error("非法的掌握状态");
    }
    node.mastery = mastery as Mastery;
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async addNode(pid, input) {
    const project = loadProject(pid);
    if (!input.name || !input.name.trim()) throw new Error("请填写知识点名称");
    project.nodes.push({
      id: newId(),
      name: input.name.trim().slice(0, 80),
      description: (input.description || "").trim(),
      importance: (["core", "recommended", "extension"].includes(input.importance || "")
        ? input.importance
        : "recommended") as KnowledgeNode["importance"],
      kind: (["concept", "model", "formula", "paper", "tool"].includes(input.kind || "")
        ? input.kind
        : undefined) as KnowledgeNode["kind"] | undefined,
      fromPaper: input.fromPaper,
      prereqs: [],
      estHours: Math.max(0, Math.round(Number(input.estHours)) || 5),
      resources: [],
      mastery: "unknown",
    });
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async deleteNode(pid, nid) {
    const project = loadProject(pid);
    const before = project.nodes.length;
    project.nodes = project.nodes.filter((n) => n.id !== nid);
    if (project.nodes.length === before) throw new Error("节点不存在");
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async expandNode(pid, nid) {
    const project = loadProject(pid);
    const idx = project.nodes.findIndex((n) => n.id === nid);
    if (idx === -1) throw new Error("节点不存在");
    const node = project.nodes[idx];
    const { settings, useMock } = settingsWith();
    const { children } = await expandNodeAI(settings, useMock, node, project);
    const newNodes: KnowledgeNode[] = children.map((c) => ({
      ...c,
      // 子节点继承原节点的上游前置 + 子节点间依赖
      prereqs: Array.from(new Set([...(node.prereqs || []), ...c.prereqs])).filter(
        (p) => p !== node.name
      ),
      id: newId(),
      mastery: "unknown",
    }));
    project.nodes.splice(idx, 1, ...newNodes);
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async recommendResources(pid, nid) {
    const project = loadProject(pid);
    const node = project.nodes.find((n) => n.id === nid);
    if (!node) throw new Error("节点不存在");
    const { settings, useMock } = settingsWith();
    const { resources } = await recommendResourcesAI(settings, useMock, node, project);
    const existing = new Set((node.resources || []).map((r) => normName(r.title)));
    node.resources = [...(node.resources || []), ...resources.filter((r) => !existing.has(normName(r.title)))];
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async addResource(pid, nid, resource) {
    const project = loadProject(pid);
    const node = project.nodes.find((n) => n.id === nid);
    if (!node) throw new Error("节点不存在");
    if (!resource || !resource.title?.trim()) throw new Error("资料标题为空");
    const existing = new Set((node.resources || []).map((r) => normName(r.title)));
    if (!existing.has(normName(resource.title))) {
      node.resources = [...(node.resources || []), { ...resource, title: resource.title.trim() }];
    }
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async analyzePaper(pid, input) {
    const project = loadProject(pid);
    const { settings, useMock } = settingsWith();
    const analysis = await analyzePaperAI(settings, useMock, {
      meta: input.meta,
      direction: input.direction || project.direction,
      extraText: input.extraText,
    });
    const outcome = mergePaperAnalysis(project, analysis, input.meta);
    putProject(project);
    return { project: { ...project }, addedCount: outcome.addedCount, skipped: outcome.skipped };
  },

  async compareNodes(pid, nodeIds) {
    const project = loadProject(pid);
    const nodes = nodeIds
      .map((id) => project.nodes.find((n) => n.id === id))
      .filter((n): n is KnowledgeNode => Boolean(n));
    const { settings, useMock } = settingsWith();
    return compareNodesAI(settings, useMock, nodes) as Promise<CompareResult>;
  },

  async generateStudyCard(pid, nid) {
    const project = loadProject(pid);
    const node = project.nodes.find((n) => n.id === nid);
    if (!node) throw new Error("节点不存在");
    const { settings, useMock } = settingsWith();
    const card = await generateStudyCardAI(settings, useMock, node, project);
    node.study = card;
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async saveComparison(pid, input) {
    const project = loadProject(pid);
    if (!project.comparisons) project.comparisons = [];
    project.comparisons.unshift({
      id: crypto.randomUUID(),
      nodeNames: input.nodeNames,
      text: input.text,
      questions: input.questions,
      createdAt: Date.now(),
    });
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async deleteComparison(pid, cid) {
    const project = loadProject(pid);
    project.comparisons = (project.comparisons || []).filter((c) => c.id !== cid);
    project.updatedAt = Date.now();
    return putProject(project);
  },

  async exportAll() {
    return JSON.stringify(
      {
        version: 1,
        mode: "local",
        exportedAt: new Date().toISOString(),
        settings: (() => {
          const s = loadSettingsRaw();
          // 备份不含 API Key，避免明文泄露
          return { baseUrl: s.baseUrl, model: s.model, useMock: s.useMock };
        })(),
        projects: Object.values(loadAllProjects()),
      },
      null,
      2
    );
  },

  async importAll(jsonText) {
    const parsed = JSON.parse(jsonText) as {
      projects?: Project[];
      settings?: { baseUrl?: string; model?: string; useMock?: boolean };
    };
    const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    if (!projects.length) throw new Error("备份文件中没有项目数据");
    for (const p of projects) {
      if (!p || typeof p.id !== "string" || !Array.isArray(p.nodes)) {
        throw new Error("备份文件格式不正确");
      }
    }
    const all: Record<string, Project> = {};
    for (const p of projects) all[p.id] = p;
    saveAllProjects(all);
    if (parsed.settings) {
      const s = loadSettingsRaw();
      if (typeof parsed.settings.baseUrl === "string") s.baseUrl = parsed.settings.baseUrl;
      if (typeof parsed.settings.model === "string") s.model = parsed.settings.model;
      if (typeof parsed.settings.useMock === "boolean") s.useMock = parsed.settings.useMock;
      saveSettingsRaw(s);
    }
    return projects.length;
  },
};
