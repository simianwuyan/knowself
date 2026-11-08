import { useEffect, useState } from "react";
import type { KnowledgeNode, Mastery, PaperRef, Resource } from "../types";
import MasteryControl from "./MasteryControl";
import StudyQuizSheet from "./StudyQuizSheet";
import { importanceLabel } from "../route";

const TYPE_META: Record<Resource["type"], { label: string; cls: string; icon: string }> = {
  book: { label: "教材", cls: "bg-violet-50 text-violet-600", icon: "📖" },
  course: { label: "课程", cls: "bg-sky-50 text-sky-600", icon: "🎓" },
  paper: { label: "论文", cls: "bg-emerald-50 text-emerald-600", icon: "📄" },
  tutorial: { label: "教程", cls: "bg-amber-50 text-amber-600", icon: "🛠" },
};

export default function NodeSheet({
  node,
  allNodes,
  busy,
  onClose,
  onMasteryChange,
  onJumpNode,
  onExpand,
  onMoreResources,
  onLiterature,
  onAddRefNode,
  onGenerateStudy,
  onDelete,
}: {
  node: KnowledgeNode;
  allNodes: KnowledgeNode[];
  busy: boolean;
  onClose: () => void;
  onMasteryChange: (m: Mastery) => void;
  onJumpNode: (n: KnowledgeNode) => void;
  onExpand: () => void;
  onMoreResources: () => void;
  onLiterature: () => void;
  onAddRefNode: (ref: PaperRef) => void;
  onGenerateStudy: () => void;
  onDelete: () => void;
}) {
  const [showQuiz, setShowQuiz] = useState(false);
  // 打开时锁定背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const prereqNodes = node.prereqs
    .map((p) => allNodes.find((n) => n.name === p))
    .filter((n): n is KnowledgeNode => Boolean(n));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fade-enter absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="sheet-enter relative mx-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white pb-8">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="min-w-0 pr-3">
            <span className="text-[11px] font-medium text-slate-400">
              {importanceLabel(node.importance)} · 约 {node.estHours} 小时
            </span>
            <h3 className="truncate text-base font-bold">{node.name}</h3>
            {node.fromPaper && (
              <p className="mt-0.5 truncate text-[11px] text-indigo-500">📄 来自论文：{node.fromPaper}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 rounded-full bg-slate-100 p-2 text-slate-500 active:bg-slate-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={`space-y-5 px-5 pt-4 ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {node.description && (
            <p className="text-sm leading-relaxed text-slate-600">{node.description}</p>
          )}

          {node.excerpt && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400">📌 论文对应片段</h4>
              <blockquote
                className={`mt-2 rounded-xl border-l-4 bg-indigo-50/70 p-3 text-sm leading-relaxed text-slate-700 ${
                  node.kind === "formula"
                    ? "border-violet-400 font-mono text-[13px]"
                    : "border-indigo-300"
                }`}
              >
                {node.excerpt}
              </blockquote>
              {node.fromPaper && (
                <p className="mt-1 text-[11px] text-slate-400">摘自：《{node.fromPaper}》</p>
              )}
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-slate-400">掌握状态</h4>
            <div className="mt-2">
              <MasteryControl value={node.mastery} onChange={onMasteryChange} disabled={busy} />
            </div>
          </div>

          {/* 学习卡：概括 + 自测（按需生成） */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400">🃏 学习卡（AI 概括 + 自测）</h4>
            {node.study ? (
              <>
                <details className="mt-2 rounded-xl bg-indigo-50/70 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-indigo-700">
                    查看 AI 概括
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {node.study.summary}
                  </p>
                </details>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowQuiz(true)}
                    disabled={busy || node.study.questions.length === 0}
                    className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white active:bg-slate-700 disabled:bg-slate-300"
                  >
                    ▶ 开始自测（{node.study.questions.length} 题）
                  </button>
                  <button
                    onClick={onGenerateStudy}
                    disabled={busy}
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-600 active:bg-slate-100 disabled:opacity-50"
                  >
                    🔄 重新生成
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={onGenerateStudy}
                disabled={busy}
                className="mt-2 w-full rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 px-3 py-3 text-xs font-semibold text-indigo-700 active:bg-indigo-100 disabled:opacity-50"
              >
                ✨ 生成学习卡（AI 概括 + 自测题，像背单词一样检验掌握程度）
              </button>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400">
              前置知识（{node.prereqs.length}）
            </h4>
            {prereqNodes.length === 0 ? (
              <p className="mt-1.5 text-sm text-slate-400">无</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {prereqNodes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onJumpNode(p)}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 active:bg-slate-200"
                  >
                    {p.name}
                    <span className="ml-1 text-slate-400">
                      {p.mastery === "mastered" ? "✓" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {(node.resources.length > 0 || node.fromPaper) && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400">
                推荐资料（{node.resources.length}）
              </h4>
              {node.resources.length === 0 ? (
                <p className="mt-1.5 text-sm text-slate-400">暂无，可点击下方让 AI 推荐</p>
              ) : (
              <ul className="mt-2 space-y-2">
                {node.resources.map((r, i) => {
                  const meta = TYPE_META[r.type] || TYPE_META.book;
                  const href = r.url || `https://www.bing.com/search?q=${encodeURIComponent(r.title)}`;
                  return (
                    <li key={i} className="rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${meta.cls}`}>
                          {meta.icon} {meta.label}
                        </span>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1 truncate text-sm font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 active:text-indigo-900"
                        >
                          {r.title} ↗
                        </a>
                        {r.pdfUrl && (
                          <a
                            href={r.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
                          >
                            PDF
                          </a>
                        )}
                      </div>
                      {r.note && <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.note}</p>}
                    </li>
                  );
                })}
              </ul>
              )}
            </div>
          )}

          {node.kind === "paper" && (node.refs?.length || 0) > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400">
                参考文献（{node.refs!.length}）— 可将必读引文加入学习路线
              </h4>
              <ul className="mt-2 space-y-2">
                {node.refs!.map((ref, i) => {
                  // 名称比较时去掉年份括号：引文节点名可能带/不带年份
                  const strip = (s: string) =>
                    s.toLowerCase().replace(/\s+/g, "").replace(/[（(]\d{4}[)）]/g, "");
                  const exists = allNodes.some((n) => strip(n.name) === strip(ref.title));
                  return (
                    <li key={i} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-medium leading-snug text-slate-700">
                        {i + 1}. {ref.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {ref.year && <span className="text-[11px] text-slate-400">{ref.year}</span>}
                        {exists ? (
                          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-600">
                            ✓ 已在路线中
                          </span>
                        ) : (
                          <button
                            onClick={() => onAddRefNode(ref)}
                            disabled={busy}
                            className="rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white active:bg-indigo-700 disabled:bg-slate-300"
                          >
                            ＋ 加入学习路线
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onExpand}
              disabled={busy || node.mastery === "mastered"}
              className="rounded-xl bg-indigo-600 px-3 py-3 text-xs font-semibold text-white active:bg-indigo-700 disabled:bg-slate-300"
            >
              ✨ AI 细化为子知识点
            </button>
            <button
              onClick={onMoreResources}
              disabled={busy}
              className="rounded-xl bg-slate-900 px-3 py-3 text-xs font-semibold text-white active:bg-slate-700 disabled:bg-slate-300"
            >
              📚 AI 推荐更多资料
            </button>
          </div>

          <button
            onClick={onLiterature}
            className="w-full rounded-xl border-2 border-indigo-200 bg-indigo-50/60 px-3 py-3 text-xs font-semibold text-indigo-700 active:bg-indigo-100"
          >
            🔍 检索相关文献（在线搜索 / 下载 PDF / 收藏）
          </button>

          <button
            onClick={onDelete}
            disabled={busy}
            className="w-full rounded-xl border border-rose-200 px-3 py-2.5 text-xs font-medium text-rose-600 active:bg-rose-50"
          >
            删除该知识点
          </button>
        </div>

        {/* 背单词式自测卡片流 */}
        {showQuiz && node.study && (
          <StudyQuizSheet
            nodeName={node.name}
            card={node.study}
            busy={busy}
            onClose={() => setShowQuiz(false)}
            onFinish={() => {
              /* 结果已在完成页展示 */
            }}
            onSetMastery={(m) => {
              if (m !== "keep") onMasteryChange(m);
            }}
            masteryTargetLabel="该知识点"
            currentMastery={node.mastery}
          />
        )}
      </div>
    </div>
  );
}
