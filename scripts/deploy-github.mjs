// GitHub Pages 部署脚本（无需本地 git，直接走 GitHub REST API）
// 用法：
//   1. 准备 PAT（classic token，勾选 repo 权限）保存到项目根目录 .gh-token 文件，或设 GH_TOKEN 环境变量
//   2. node scripts/deploy-github.mjs <repo名>   （默认 knowself）
// 行为：
//   - 若仓库不存在则自动创建（公开仓库，Pages 免费版要求公开）
//   - 源代码推到 main 分支，dist 构建产物推到 gh-pages 分支
//   - 自动开启 GitHub Pages（来源 gh-pages）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const repoName = process.argv[2] || "knowself";
const token =
  process.env.GH_TOKEN ||
  (() => {
    const f = path.join(ROOT, ".gh-token");
    return fs.existsSync(f) ? fs.readFileSync(f, "utf-8").trim() : "";
  })();
if (!token) {
  console.error("缺少 GitHub Token：请把 PAT 保存到 .gh-token 文件或设置 GH_TOKEN 环境变量");
  process.exit(1);
}

const API = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "knowself-deploy",
};

async function gh(method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`GitHub API ${method} ${url} -> ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------- 1. 验证 token，确定 owner ----------
const me = await gh("GET", "/user");
const owner = me.login;
console.log(`✓ Token 有效，账号: ${owner}`);
const fullRepo = `${owner}/${repoName}`;

// ---------- 2. 获取/创建仓库 ----------
try {
  await gh("GET", `/repos/${fullRepo}`);
  console.log(`✓ 仓库已存在: ${fullRepo}`);
} catch (err) {
  if (err.status !== 404) throw err;
  await gh("POST", "/user/repos", {
    name: repoName,
    private: false,
    description: "KnowSelf · AI 科研学习路线规划（纯前端版）",
    auto_init: false,
  });
  console.log(`✓ 已创建公开仓库: ${fullRepo}`);
}

// ---------- 3. 空仓库引导（Git database API 在空仓库上会 409） ----------
async function ensureMainBranch() {
  try {
    await gh("GET", `/repos/${fullRepo}/git/ref/heads/main`);
    return; // 已有 main 分支
  } catch (err) {
    if (err.status !== 404 && err.status !== 409) throw err;
  }
  await gh("PUT", `/repos/${fullRepo}/contents/README.md`, {
    message: "初始化仓库",
    content: Buffer.from(
      "# KnowSelf\n\n科研学习路线规划工具（源码由部署脚本自动推送）。\n"
    ).toString("base64"),
  });
  console.log("✓ 空仓库已初始化 main 分支");
}
await ensureMainBranch();

// ---------- 4. 收集文件 ----------
function walk(dir, baseDir, ignore) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(baseDir, full).replace(/\\/g, "/");
    if (ignore.some((i) => rel === i || rel.startsWith(i + "/"))) continue;
    if (entry.isDirectory()) out.push(...walk(full, baseDir, ignore));
    else out.push(rel);
  }
  return out;
}

async function pushBranch(files, baseDir, branch, message) {
  // 1) 批量创建 blob
  const treeItems = [];
  for (const rel of files) {
    const content = fs.readFileSync(path.join(baseDir, rel));
    const blob = await gh("POST", `/repos/${fullRepo}/git/blobs`, {
      content: content.toString("base64"),
      encoding: "base64",
    });
    treeItems.push({ path: rel, mode: "100644", type: "blob", sha: blob.sha });
  }
  // 2) 基于分支当前 commit 建树（无分支则建根树）
  let baseTree;
  let parentCommit;
  try {
    const ref = await gh("GET", `/repos/${fullRepo}/git/ref/heads/${branch}`);
    parentCommit = await gh("GET", `/repos/${fullRepo}/git/commits/${ref.object.sha}`);
    baseTree = parentCommit.tree.sha;
  } catch (err) {
    if (err.status !== 404 && err.status !== 409) throw err;
  }
  const tree = await gh("POST", `/repos/${fullRepo}/git/trees`, {
    ...(baseTree ? { base_tree: baseTree } : {}),
    tree: treeItems,
  });
  // 3) 创建 commit
  const commit = await gh("POST", `/repos/${fullRepo}/git/commits`, {
    message,
    tree: tree.sha,
    ...(parentCommit ? { parents: [parentCommit.sha] } : {}),
  });
  // 4) 创建/更新分支引用
  try {
    await gh("POST", `/repos/${fullRepo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
  } catch (err) {
    if (err.status !== 422) throw err; // 已存在则更新
    await gh("PATCH", `/repos/${fullRepo}/git/refs/heads/${branch}`, {
      sha: commit.sha,
      force: true,
    });
  }
  console.log(`✓ 分支 ${branch} 已更新（${files.length} 个文件）`);
}

const SOURCE_IGNORE = [
  "node_modules",
  "dist",
  "data",
  ".gh-token",
  ".git",
  "scripts/ts-probe.ts",
];
const sourceFiles = walk(ROOT, ROOT, SOURCE_IGNORE);
await pushBranch(sourceFiles, ROOT, "main", "KnowSelf 源码");

const distDir = path.join(ROOT, "dist");
if (!fs.existsSync(distDir)) {
  console.error("dist 不存在，请先 npm run build");
  process.exit(1);
}
const distFiles = walk(distDir, distDir, []);
await pushBranch(distFiles, distDir, "gh-pages", "KnowSelf 网页构建产物");

// ---------- 6. 开启 GitHub Pages ----------
try {
  await gh("POST", `/repos/${fullRepo}/pages`, {
    source: { branch: "gh-pages", path: "/" },
  });
  console.log("✓ GitHub Pages 已开启（来源 gh-pages 分支）");
} catch (err) {
  if (err.status === 409) {
    console.log("✓ GitHub Pages 已处于开启状态");
  } else if (err.status === 403) {
    console.log("⚠ Token 无 Pages 权限，跳过开启步骤（若站点已开过则不影响；首次部署需在仓库 Settings → Pages 手动开启）");
  } else {
    throw err;
  }
}

console.log(`\n🎉 部署完成，稍等 1~2 分钟后访问:`);
console.log(`   https://${owner}.github.io/${repoName}/`);
