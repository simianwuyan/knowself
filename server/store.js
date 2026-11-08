import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "..", "data");
export const PROJECTS_DIR = path.join(DATA_DIR, "projects");

function ensureDirs() {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf-8");
}

// ---------- settings ----------

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const DEFAULT_SETTINGS = {
  baseUrl: "",
  apiKey: "",
  model: "",
  useMock: false,
};

export function getSettings() {
  ensureDirs();
  return { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_FILE, {}) };
}

export function saveSettings(patch) {
  const current = getSettings();
  const next = { ...current };
  for (const key of ["baseUrl", "apiKey", "model", "useMock"]) {
    if (key in patch) next[key] = patch[key];
  }
  // 空字符串 apiKey 视为「清除」
  writeJson(SETTINGS_FILE, next);
  return next;
}

// ---------- projects ----------

const idRe = /^[a-f0-9-]{8,40}$/i;

function isValidId(id) {
  return idRe.test(id);
}

export function newId() {
  return crypto.randomUUID();
}

export function listProjects() {
  ensureDirs();
  const files = fs.existsSync(PROJECTS_DIR) ? fs.readdirSync(PROJECTS_DIR) : [];
  const items = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const p = readJson(path.join(PROJECTS_DIR, f), null);
    if (!p || !p.id) continue;
    const nodes = Array.isArray(p.nodes) ? p.nodes : [];
    items.push({
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
    });
  }
  items.sort((a, b) => b.createdAt - a.createdAt);
  return items;
}

export function getProject(id) {
  if (!isValidId(id)) return null;
  return readJson(projectFile(id), null);
}

export function saveProject(project) {
  writeJson(projectFile(project.id), project);
  return project;
}

export function deleteProject(id) {
  if (!isValidId(id)) return false;
  const file = projectFile(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return true;
}

function projectFile(id) {
  return path.join(PROJECTS_DIR, `${id}.json`);
}
