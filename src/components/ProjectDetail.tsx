import { useEffect, useMemo, useState } from "react";
import type { Mastery, Project } from "../types";
import type { PaperHit } from "../literature";
import {
  addResource,
  deleteNode,
  deleteProject,
  expandNode,
  fetchProject,
  generateTree,
  recommendResources,
  renameProject,
  setNodeMastery,
} from "../api";
import { computeRoute, importanceLabel } from "../route";
import { useToast } from "../toast";
import NodeCard from "./NodeCard";
import NodeSheet from "./NodeSheet";
import KnowledgeGraph from "./KnowledgeGraph";
import LiteraturePanel from "./LiteraturePanel";

const IMPORTANCE_CLS: Record<string, string> = {
  core: "bg-rose-50 text-rose-600",
  recommended: "bg-sky-50 text-sky-600",
  extension: "bg-slate-100 text-slate-500",
};

function exportMarkdown(project: Project) {
  const { stages } = computeRoute(project.nodes);
  const lines: string[] = [
    `# ${project.title} · 学习路线`,
    "",
    `> 科研方向：${project.direction}`,
    "",
  ];
  if (project.summary) lines.push(project.summary, "");
  if (stages.length === 0) {
    lines.push("_当前没有需要学习的内容（全部已掌握）_");
  }
  for (const stage of stages) {
    lines.push(`## 阶段 ${stage.index}`, "");
    for (const n of stage.nodes) {
      lines.push(
        `- [${n.mastery === "mastered" ? "x" : " "}] **${n.name}**（${importanceLabel(n.importance)}，约 ${n.estHours}h）`
      );
      if (n.description) lines.push(`  - ${n.description}`);
      if (n.prereqs.length) lines.push(`  - 前置：${n.prereqs.join("、")}`);
      for (const r of n.resources) {
        lines.push(`  - 资料《${r.title}》〔${r.type}〕${r.note ? `—— ${r.note}` : ""}`);
      }
    }
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.title}-学习路线.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProjectDetail({ id }: { id: string }) {
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"route" | "graph" | "all">("route");
  const [sheetNodeId, setSheetNodeId] = useState<string | null>(null);
  const [litNodeId, setLitNodeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const route = useMemo(
    () => (project ? computeRoute(project.nodes) : null),
    [project]
  );

  useEffect(() => {
    let cancelled = false;
    fetchProject(id)
      .then((p) => {
        if (!cancelled) {
          setProject(p);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const sheetNode =
    project && sheetNodeId ? project.nodes.find((n) => n.id === sheetNodeId) : null;
  const litNode =
    project && litNodeId ? project.nodes.find((n) => n.id === litNodeId) : null;

  async function run(fn: () => Promise<Project>, okMsg?: string) {
    setBusy(true);
    try {
      const p = await fn();
      setProject(p);
      if (okMsg) toast(okMsg, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (
      !window.confirm(
        "重新生成会替换当前知识清单（相同名称的知识点会保留掌握状态）。继续？"
      )
    )
      return;
    setGenerating(true);
    try {
      const p = await generateTree(id);
      setProject(p);
      toast("知识清单已更新", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "生成失败", "error");
    } finally {
      setGenerating(false);
      setMenuOpen(false);
    }
  }

  async function doRename() {
    if (!project) return;
    const title = window.prompt("修改计划名称", project.title);
    if (!title || !title.trim() || title.trim() === project.title) return;
    try {
      const p = await renameProject(id, title.trim());
      setProject(p);
      toast("已重命名", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "重命名失败", "error");
    }
  }

  async function doDeleteProject() {
    if (!project) return;
    if (!window.confirm(`确定删除学习计划「${project.title}」？此操作不可恢复。`)) return;
    try {
      await deleteProject(id);
      toast("已删除", "success");
      window.location.hash = "#/";
    } catch (e) {
      toast(e instanceof Error ? e.message : "删除失败", "error");
    }
  }

  if (error) {
    return (
      <div className="p-6 pt-16 text-center">
        <p className="text-sm text-rose-600">{error}</p>
        <a href="#/" className="mt-4 inline-block text-sm text-indigo-600">
          返回首页
        </a>
      </div>
    );
  }

  if (!project || !route) {
    return <p className="py-20 text-center text-sm text-slate-400">加载中…</p>;
  }

  const { stats } = route;

  return (
    <div className="flex min-h-full flex-col">
      {/* 顶栏 */}
      <header className="sticky top-0 z-20 bg-slate-900 px-3 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center gap-1">
          <a href="#/" aria-label="返回" className="rounded-full p-2 active:bg-white/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </a>
          <button onClick={doRename} className="min-w-0 flex-1 text-left">
            <h1 className="truncate text-lg font-semibold">{project.title}</h1>
            <p className="truncate text-xs text-slate-400">{project.direction}</p>
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="更多操作"
              className="rounded-full p-2 text-slate-300 active:bg-white/10"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="12" cy="19" r="1.6" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl bg-white text-sm text-slate-700 shadow-xl">
                  <button
                    onClick={() => {
                      exportMarkdown(project);
                      setMenuOpen(false);
                    }}
                    className="block w-full px-4 py-3 text-left active:bg-slate-100"
                  >
                    📤 导出 Markdown
                  </button>
                  <button
                    onClick={regenerate}
                    disabled={generating}
                    className="block w-full px-4 py-3 text-left active:bg-slate-100 disabled:opacity-50"
                  >
                    🔄 AI 重新生成
                  </button>
                  <button
                    onClick={doDeleteProject}
                    className="block w-full px-4 py-3 text-left text-rose-600 active:bg-rose-50"
                  >
                    🗑 删除计划
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 进度 */}
        <div className="mt-3 px-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>
              已掌握 {stats.mastered}/{stats.total}
              {stats.partial > 0 && ` · 待复习 ${stats.partial}`}
            </span>
            <span>剩余约 {stats.remainingHours} 小时</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {generating && (
        <div className="flex items-center justify-center gap-3 bg-indigo-50 py-3 text-xs text-indigo-700">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
          AI 正在重新生成知识清单…
        </div>
      )}

      {/* 摘要 */}
      {project.summary && (
        <div className="mx-4 mt-4 rounded-2xl bg-indigo-50/70 p-4 text-xs leading-relaxed text-indigo-900">
          <span className="mr-1 font-semibold">AI 概览</span>
          {project.summary}
        </div>
      )}

      {/* 空状态 */}
      {project.nodes.length === 0 && (
        <div className="mt-10 px-8 text-center">
          <div className="text-4xl">✨</div>
          <p className="mt-3 text-sm text-slate-500">知识清单尚未生成</p>
          <button
            onClick={regenerate}
            className="mt-4 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white active:bg-indigo-700"
          >
            立即生成
          </button>
        </div>
      )}

      {/* Tab 切换 */}
      {project.nodes.length > 0 && (
        <>
          <div className="sticky top-[104px] z-10 mt-4 bg-slate-50/95 px-4 py-2 backdrop-blur">
            <div className="flex rounded-xl bg-slate-200/60 p-1">
              {(
                [
                  ["route", `路线`],
                  ["graph", "图谱"],
                  ["all", `全部（${project.nodes.length}）`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                    tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <main className="flex-1 space-y-6 px-4 pb-24 pt-2">
            {tab === "route" && (
              <>
                {route.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-700"
                  >
                    ⚠️ {w}
                  </div>
                ))}
                {route.stages.length === 0 ? (
                  <div className="mt-12 rounded-2xl bg-white p-8 text-center shadow-sm">
                    <div className="text-4xl">🎉</div>
                    <p className="mt-3 text-sm font-medium">全部知识点都已掌握！</p>
                    <p className="mt-1 text-xs text-slate-400">
                      可以在「AI 重新生成」中规划更进阶的内容
                    </p>
                  </div>
                ) : (
                  route.stages.map((stage) => (
                    <section key={stage.index}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                          {stage.index}
                        </span>
                        <h3 className="text-sm font-bold">阶段 {stage.index}</h3>
                        <span className="text-xs text-slate-400">
                          {stage.nodes.length} 项 · 约{" "}
                          {stage.nodes.reduce((s, n) => s + n.estHours, 0)}h
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {stage.nodes.map((n) => (
                          <NodeCard
                            key={n.id}
                            node={n}
                            busy={busy}
                            onOpen={() => setSheetNodeId(n.id)}
                            onMasteryChange={(m: Mastery) =>
                              run(() => setNodeMastery(id, n.id, m))
                            }
                          />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </>
            )}

            {tab === "graph" && (
              <KnowledgeGraph
                nodes={project.nodes}
                onOpen={(n) => setSheetNodeId(n.id)}
              />
            )}

            {tab === "all" && (
              <>
                {(["core", "recommended", "extension"] as const).map((imp) => {
                  const group = project.nodes.filter((n) => n.importance === imp);
                  if (!group.length) return null;
                  return (
                    <section key={imp}>
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${IMPORTANCE_CLS[imp]}`}
                        >
                          {importanceLabel(imp)}
                        </span>
                        <span className="text-xs text-slate-400">{group.length} 项</span>
                      </div>
                      <div className="space-y-2.5">
                        {group.map((n) => (
                          <NodeCard
                            key={n.id}
                            node={n}
                            busy={busy}
                            onOpen={() => setSheetNodeId(n.id)}
                            onMasteryChange={(m: Mastery) =>
                              run(() => setNodeMastery(id, n.id, m))
                            }
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </>
            )}
          </main>
        </>
      )}

      {/* 节点详情抽屉 */}
      {sheetNode && (
        <NodeSheet
          node={sheetNode}
          allNodes={project.nodes}
          busy={busy}
          onClose={() => setSheetNodeId(null)}
          onMasteryChange={(m) => run(() => setNodeMastery(id, sheetNode.id, m))}
          onJumpNode={(n) => setSheetNodeId(n.id)}
          onExpand={() => {
            if (
              window.confirm(
                `将「${sheetNode.name}」细化为若干子知识点？原知识点会被子知识点替换。`
              )
            ) {
              run(() => expandNode(id, sheetNode.id), "已细化").then(() =>
                setSheetNodeId(null)
              );
            }
          }}
          onMoreResources={() => run(() => recommendResources(id, sheetNode.id), "资料已追加")}
          onLiterature={() => {
            setLitNodeId(sheetNode.id);
            setSheetNodeId(null);
          }}
          onDelete={() => {
            if (window.confirm(`删除知识点「${sheetNode.name}」？`)) {
              run(() => deleteNode(id, sheetNode.id), "已删除").then(() =>
                setSheetNodeId(null)
              );
            }
          }}
        />
      )}

      {/* 文献检索面板 */}
      {litNode && (
        <LiteraturePanel
          initialQuery={`${litNode.name} ${project.direction || ""}`.trim()}
          savedTitles={(litNode.resources || []).map((r) => r.title)}
          busy={busy}
          onClose={() => setLitNodeId(null)}
          onSave={(p: PaperHit) =>
            run(() =>
              addResource(id, litNode.id, {
                title: p.title,
                type: "paper",
                note: [
                  p.authors[0] ? `${p.authors[0]} 等` : "",
                  p.year ? String(p.year) : "",
                  p.citations !== undefined ? `被引 ${p.citations}` : "",
                ]
                  .filter(Boolean)
                  .join(" · "),
              })
            )
          }
        />
      )}
    </div>
  );
}
