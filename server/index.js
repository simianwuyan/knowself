import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSettings,
  saveSettings,
  listProjects,
  getProject,
  saveProject,
  deleteProject,
  newId,
} from "./store.js";
import {
  generateTree,
  expandNode,
  recommendResources,
  testConnection,
  analyzePaper,
  compareNodes,
} from "./ai.js";
import { mergePaperAnalysis } from "../shared/merge.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: "2mb" }));

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const ok = (res, data) => res.json({ ok: true, data });

// ---------- settings ----------

app.get("/api/settings", (req, res) => {
  const s = getSettings();
  ok(res, {
    baseUrl: s.baseUrl,
    model: s.model,
    useMock: s.useMock,
    hasKey: Boolean(s.apiKey),
    isMock: s.useMock || !s.apiKey || !s.baseUrl,
  });
});

app.put("/api/settings", wrap(async (req, res) => {
  const { baseUrl, apiKey, model, useMock } = req.body || {};
  const patch = {};
  if (typeof baseUrl === "string") patch.baseUrl = baseUrl.trim();
  if (typeof model === "string") patch.model = model.trim();
  if (typeof useMock === "boolean") patch.useMock = useMock;
  // apiKey 为空字符串时表示清除；undefined 表示不修改
  if (typeof apiKey === "string") patch.apiKey = apiKey.trim();
  const next = saveSettings(patch);
  ok(res, {
    baseUrl: next.baseUrl,
    model: next.model,
    useMock: next.useMock,
    hasKey: Boolean(next.apiKey),
    isMock: next.useMock || !next.apiKey || !next.baseUrl,
  });
}));

app.post("/api/settings/test", wrap(async (req, res) => {
  const overrides = {};
  if (typeof req.body?.baseUrl === "string" && req.body.baseUrl.trim())
    overrides.baseUrl = req.body.baseUrl.trim();
  if (typeof req.body?.apiKey === "string" && req.body.apiKey.trim())
    overrides.apiKey = req.body.apiKey.trim();
  if (typeof req.body?.model === "string" && req.body.model.trim())
    overrides.model = req.body.model.trim();
  const result = await testConnection(overrides);
  ok(res, result);
}));

// ---------- projects ----------

app.get("/api/projects", (req, res) => ok(res, listProjects()));

app.post("/api/projects", wrap(async (req, res) => {
  const { direction, background = "", goal = "" } = req.body || {};
  if (!direction || !direction.trim()) {
    return res.status(400).json({ error: "请填写科研方向" });
  }
  const now = Date.now();
  const project = {
    id: newId(),
    title: direction.trim().slice(0, 40),
    direction: direction.trim(),
    background: String(background || "").trim(),
    goal: String(goal || "").trim(),
    summary: "",
    nodes: [],
    createdAt: now,
    updatedAt: now,
  };
  saveProject(project);
  ok(res, project);
}));

app.get("/api/projects/:id", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  ok(res, project);
}));

app.patch("/api/projects/:id", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const { title } = req.body || {};
  if (typeof title === "string" && title.trim()) project.title = title.trim().slice(0, 60);
  project.updatedAt = Date.now();
  saveProject(project);
  ok(res, project);
}));

app.delete("/api/projects/:id", wrap(async (req, res) => {
  deleteProject(req.params.id);
  ok(res, null);
}));

// 生成/重新生成知识清单
app.post("/api/projects/:id/generate", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const tree = await generateTree({
    direction: project.direction,
    background: project.background,
    goal: project.goal,
  });
  // 重新生成时按名称继承旧的掌握状态
  const oldMastery = new Map(
    (project.nodes || []).map((n) => [normalizeName(n.name), n.mastery])
  );
  project.nodes = tree.nodes.map((n) => ({
    ...n,
    id: newId(),
    mastery: oldMastery.get(normalizeName(n.name)) || "unknown",
  }));
  project.title = tree.title || project.title;
  project.summary = tree.summary || "";
  project.updatedAt = Date.now();
  saveProject(project);
  ok(res, project);
}));

// 新增节点
app.post("/api/projects/:id/nodes", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const { name, description = "", importance = "recommended", prereqs = [], estHours = 5, kind, fromPaper } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "请填写知识点名称" });
  project.nodes.push({
    id: newId(),
    name: name.trim().slice(0, 80),
    description: String(description || "").trim(),
    importance: ["core", "recommended", "extension"].includes(importance) ? importance : "recommended",
    kind: ["concept", "model", "formula", "paper", "tool"].includes(kind) ? kind : undefined,
    fromPaper: typeof fromPaper === "string" && fromPaper.trim() ? fromPaper.trim() : undefined,
    prereqs: Array.isArray(prereqs) ? prereqs.filter((p) => typeof p === "string") : [],
    estHours: Math.max(0, Math.round(Number(estHours)) || 5),
    resources: [],
    mastery: "unknown",
  });
  project.updatedAt = Date.now();
  saveProject(project);
  ok(res, project);
}));

// 更新节点（掌握状态 / 内容编辑）
app.patch("/api/projects/:id/nodes/:nodeId", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const node = project.nodes.find((n) => n.id === req.params.nodeId);
  if (!node) return res.status(404).json({ error: "节点不存在" });
  const { mastery, name, description, estHours } = req.body || {};
  if (mastery !== undefined) {
    if (!["unknown", "partial", "mastered"].includes(mastery)) {
      return res.status(400).json({ error: "非法的掌握状态" });
    }
    node.mastery = mastery;
  }
  if (typeof name === "string" && name.trim()) node.name = name.trim().slice(0, 80);
  if (typeof description === "string") node.description = description.trim();
  if (estHours !== undefined) node.estHours = Math.max(0, Math.round(Number(estHours)) || 0);
  project.updatedAt = Date.now();
  saveProject(project);
  ok(res, project);
}));

// 删除节点
app.delete("/api/projects/:id/nodes/:nodeId", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const before = project.nodes.length;
  project.nodes = project.nodes.filter((n) => n.id !== req.params.nodeId);
  if (project.nodes.length === before) return res.status(404).json({ error: "节点不存在" });
  project.updatedAt = Date.now();
  saveProject(project);
  ok(res, project);
}));

// AI 分析论文并合并进项目
app.post("/api/projects/:id/analyze-paper", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const { meta, extraText } = req.body || {};
  if (!meta || !meta.title) return res.status(400).json({ error: "缺少论文题录" });
  const analysis = await analyzePaper({
    meta,
    direction: project.direction,
    extraText: typeof extraText === "string" ? extraText : undefined,
  });
  const outcome = mergePaperAnalysis(project, analysis, meta);
  saveProject(project);
  ok(res, { project, addedCount: outcome.addedCount, skipped: outcome.skipped });
}));

// AI 对比知识点（不落库）
app.post("/api/projects/:id/compare", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const nodeIds = Array.isArray(req.body?.nodeIds) ? req.body.nodeIds : [];
  const nodes = nodeIds
    .map((id) => project.nodes.find((n) => n.id === id))
    .filter(Boolean);
  if (nodes.length < 2) return res.status(400).json({ error: "请选择 2~4 个知识点" });
  const result = await compareNodes(nodes);
  ok(res, result);
}));

// 保存对比记录
app.post("/api/projects/:id/comparisons", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const { nodeNames, text } = req.body || {};
  if (!Array.isArray(nodeNames) || !text) {
    return res.status(400).json({ error: "参数不完整" });
  }
  if (!project.comparisons) project.comparisons = [];
  project.comparisons.unshift({
    id: newId(),
    nodeNames,
    text: String(text),
    createdAt: Date.now(),
  });
  project.updatedAt = Date.now();
  saveProject(project);
  ok(res, project);
}));

// 删除对比记录
app.delete("/api/projects/:id/comparisons/:cid", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  project.comparisons = (project.comparisons || []).filter((c) => c.id !== req.params.cid);
  project.updatedAt = Date.now();
  saveProject(project);
  ok(res, project);
}));

// AI 细化节点：用子知识点替换原节点
app.post("/api/projects/:id/nodes/:nodeId/expand", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const idx = project.nodes.findIndex((n) => n.id === req.params.nodeId);
  if (idx === -1) return res.status(404).json({ error: "节点不存在" });
  const node = project.nodes[idx];
  const { children } = await expandNode(node, project);
  const newNodes = children.map((c) => ({
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
  saveProject(project);
  ok(res, project);
}));

// AI 推荐更多资料：追加到节点
app.post("/api/projects/:id/nodes/:nodeId/resources", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const node = project.nodes.find((n) => n.id === req.params.nodeId);
  if (!node) return res.status(404).json({ error: "节点不存在" });
  const { resources } = await recommendResources(node, project);
  const existing = new Set((node.resources || []).map((r) => normalizeName(r.title)));
  const added = resources.filter((r) => !existing.has(normalizeName(r.title)));
  node.resources = [...(node.resources || []), ...added];
  project.updatedAt = Date.now();
  saveProject(project);
  ok(res, project);
}));

// 手动追加一条资料（如收藏的文献）
app.post("/api/projects/:id/nodes/:nodeId/resources/add", wrap(async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "项目不存在" });
  const node = project.nodes.find((n) => n.id === req.params.nodeId);
  if (!node) return res.status(404).json({ error: "节点不存在" });
  const { title, type = "paper", note = "" } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: "资料标题为空" });
  const existing = new Set((node.resources || []).map((r) => normalizeName(r.title)));
  if (!existing.has(normalizeName(title))) {
    node.resources = [
      ...(node.resources || []),
      {
        title: title.trim(),
        type: ["book", "course", "paper", "tutorial"].includes(type) ? type : "paper",
        note: String(note || "").trim(),
      },
    ];
  }
  project.updatedAt = Date.now();
  saveProject(project);
  ok(res, project);
}));

function normalizeName(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "");
}

// ---------- 静态托管 & SPA 回退 ----------

app.use(express.static(DIST_DIR));
app.get(/^\/(?!api(\/|$)).*/, (req, res) => {
  const indexFile = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  res
    .status(503)
    .send("前端尚未构建：请先运行 npm run build，或开发模式下访问 http://localhost:5173");
});

// ---------- 错误处理 & 启动 ----------

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[API Error]", err.message);
  res.status(500).json({ error: err.message || "服务器内部错误" });
});

function lanAddresses() {
  const result = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) result.push(iface.address);
    }
  }
  return result;
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✦ KnowSelf 服务已启动`);
  console.log(`  本机访问:   http://localhost:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`  手机访问:   http://${ip}:${PORT}  （需与电脑同一局域网）`);
  }
  console.log("");
});
