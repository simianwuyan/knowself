import { useEffect, useState } from "react";
import type { PaperHit } from "../literature";
import { searchPapers } from "../literature";
import { useToast } from "../toast";

export default function LiteraturePanel({
  initialQuery,
  savedTitles,
  busy,
  onClose,
  onSave,
}: {
  initialQuery: string;
  savedTitles: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (paper: PaperHit) => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<PaperHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function run(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    setError("");
    try {
      const results = await searchPapers(q, 12);
      setHits(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "检索失败");
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    void run(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开时锁定背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function isSaved(p: PaperHit): boolean {
    return savedTitles.some((t) => t.trim().toLowerCase() === p.title.trim().toLowerCase());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fade-enter absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="sheet-enter relative mx-auto flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white pb-6">
        <div className="sticky top-0 border-b border-slate-100 bg-white/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">文献检索 · OpenAlex</h3>
            <button
              onClick={onClose}
              aria-label="关闭"
              className="rounded-full bg-slate-100 p-2 text-slate-500 active:bg-slate-200"
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
              placeholder="关键词，英文效果更佳"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white"
            />
            <button
              onClick={() => void run(query)}
              disabled={searching}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white active:bg-indigo-700 disabled:opacity-50"
            >
              {searching ? "…" : "搜索"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-3">
          {searching && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
              正在检索…
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
          )}
          {!searching && hits && hits.length === 0 && !error && (
            <p className="py-10 text-center text-sm text-slate-400">没有找到相关文献，换个关键词试试</p>
          )}
          <div className="space-y-2.5 pb-4">
            {hits?.map((p, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 p-3.5">
                <h4 className="text-sm font-semibold leading-snug">{p.title}</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {p.authors.join(", ")}
                  {p.authors.length ? " · " : ""}
                  {[p.year, p.venue, p.citations !== undefined ? `被引 ${p.citations}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {p.landingUrl && (
                    <a
                      href={p.landingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-slate-200/70 px-2.5 py-1.5 text-xs font-medium text-slate-700 active:brightness-95"
                    >
                      原文 ↗
                    </a>
                  )}
                  {p.pdfUrl && (
                    <a
                      href={p.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700 active:brightness-95"
                    >
                      ⬇ PDF
                    </a>
                  )}
                  <button
                    onClick={() => {
                      onSave(p);
                      toast("已加入学习资料", "success");
                    }}
                    disabled={busy || isSaved(p)}
                    className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white active:bg-indigo-700 disabled:bg-slate-300 disabled:text-white"
                  >
                    {isSaved(p) ? "已收藏" : "＋ 收藏为学习资料"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
