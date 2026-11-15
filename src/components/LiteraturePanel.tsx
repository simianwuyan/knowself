import { useEffect, useState } from "react";
import type { KnowledgeNode, Project } from "../types";
import type { LiteratureGroup, LiteratureItem } from "../../shared/lit-recommend";
import { smartLiterature } from "../api";

function ItemCard({
  item,
  savedTitles,
  busy,
  onSave,
}: {
  item: LiteratureItem;
  savedTitles: string[];
  busy: boolean;
  onSave: (item: LiteratureItem) => void;
}) {
  const isSaved = savedTitles.some(
    (t) => t.trim().toLowerCase() === item.title.trim().toLowerCase()
  );
  return (
    <div className="rounded-2xl bg-slate-50 p-3.5">
      <h4 className="text-sm font-semibold leading-snug">{item.title}</h4>
      <p className="mt-1 text-xs text-slate-500">
        {item.authors.join(", ")}
        {item.authors.length ? " · " : ""}
        {[item.year, item.venue, item.citations !== undefined ? `被引 ${item.citations}` : ""]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {item.why && <p className="mt-1.5 text-xs leading-relaxed text-indigo-700">💡 {item.why}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {item.landingUrl && (
          <a
            href={item.landingUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-slate-200/70 px-2.5 py-1.5 text-xs font-medium text-slate-700 active:brightness-95"
          >
            原文 ↗
          </a>
        )}
        {item.pdfUrl && (
          <a
            href={item.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700 active:brightness-95"
          >
            ⬇ PDF
          </a>
        )}
        <button
          onClick={() => onSave(item)}
          disabled={busy || isSaved}
          className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white active:bg-indigo-700 disabled:bg-slate-300 disabled:text-white"
        >
          {isSaved ? "已收藏" : "＋ 收藏为学习资料"}
        </button>
      </div>
    </div>
  );
}

export default function LiteraturePanel({
  node,
  project,
  savedTitles,
  busy,
  onClose,
  onSave,
}: {
  node: KnowledgeNode;
  project: Project;
  savedTitles: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (item: LiteratureItem) => void;
}) {
  const [query, setQuery] = useState(node.name);
  const [groups, setGroups] = useState<LiteratureGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function run(q?: string) {
    setLoading(true);
    setError("");
    try {
      const g = await smartLiterature(project.id, node.id, q);
      setGroups(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "检索失败");
      setGroups({ prereq: [], extension: [] });
    } finally {
      setLoading(false);
    }
  }

  // 打开即执行智能检索（引文网络 + 关键词 + AI 分类）
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fade-enter absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="sheet-enter relative mx-auto flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white pb-6">
        <div className="sticky top-0 border-b border-slate-100 bg-white/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold">📚 智能文献推荐</h3>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {node.name} · 前置取自论文真实引文网络，AI 筛选分类
              </p>
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
          <div className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void run(query);
              }}
              placeholder="调整检索关键词（英文效果更佳）"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white"
            />
            <button
              onClick={() => void run(query)}
              disabled={loading}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white active:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "…" : "重新检索"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-3">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-400">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
              正在检索引文网络与相关文献，并由 AI 分类（约 10~30 秒）…
            </div>
          )}
          {error && !loading && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
          )}
          {groups?.notice && !loading && (
            <div className="mb-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">⚠️ {groups.notice}</div>
          )}
          {!loading && !error && groups && (
            <>
              <section className="mt-1">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs text-violet-700">前置</span>
                  先读这些（论文依赖的基础文献）
                </h4>
                {groups.prereq.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">
                    AI 未从候选中筛选出确定的前置文献；可参考论文节点的「参考文献」区块
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {groups.prereq.map((item, i) => (
                      <ItemCard key={i} item={item} savedTitles={savedTitles} busy={busy} onSave={onSave} />
                    ))}
                  </div>
                )}
              </section>
              <section className="mt-5">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs text-sky-700">拓展</span>
                  延伸视野（相关应用与综述）
                </h4>
                {groups.extension.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">暂无拓展推荐</p>
                ) : (
                  <div className="space-y-2.5">
                    {groups.extension.map((item, i) => (
                      <ItemCard key={i} item={item} savedTitles={savedTitles} busy={busy} onSave={onSave} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
