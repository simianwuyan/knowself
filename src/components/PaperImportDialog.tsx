import { useEffect, useState } from "react";
import type { PaperMeta } from "../types";
import { detectPaperLookup, fetchPaperMeta } from "../literature";
import { useToast } from "../toast";

type Phase = "input" | "loadingMeta" | "confirm" | "analyzing";

export default function PaperImportDialog({
  direction,
  isMock,
  onClose,
  onAnalyze,
}: {
  direction: string;
  isMock: boolean;
  onClose: () => void;
  onAnalyze: (input: { meta: PaperMeta; extraText?: string }) => Promise<{ addedCount: number; skipped: string[] }>;
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState("");
  const [meta, setMeta] = useState<PaperMeta | null>(null);
  const [extraText, setExtraText] = useState("");
  const [error, setError] = useState("");

  // 打开时锁定背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function close() {
    document.body.style.overflow = "";
    onClose();
  }

  async function submitInput() {
    if (!input.trim()) {
      toast("请先粘贴论文链接、标题或摘要", "error");
      return;
    }
    setError("");
    const lookup = detectPaperLookup(input);
    if (!lookup) {
      // 长文本 → 直接作为分析素材
      const m: PaperMeta = {
        title: input.trim().slice(0, 60).split("\n")[0] || "粘贴的论文内容",
        authors: [],
        refs: [],
        source: "text",
        abstract: input.trim().slice(0, 6000),
      };
      await analyze(m);
      return;
    }
    setPhase("loadingMeta");
    try {
      const m = await fetchPaperMeta(lookup);
      setMeta(m);
      setPhase("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "查询失败");
      setPhase("input");
    }
  }

  async function analyze(m: PaperMeta, extra?: string) {
    setPhase("analyzing");
    try {
      const result = await onAnalyze({ meta: m, extraText: extra });
      toast(
        `已添加 ${result.addedCount} 个知识点${result.skipped.length ? `，${result.skipped.length} 个因重名跳过` : ""}`,
        "success"
      );
      close();
    } catch (e) {
      toast(e instanceof Error ? e.message : "分析失败", "error");
      setPhase(m.source === "text" ? "input" : "confirm");
    }
  }

  const busy = phase === "loadingMeta" || phase === "analyzing";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fade-enter absolute inset-0 bg-black/40" onClick={busy ? undefined : close} />
      <div className="sheet-enter relative mx-auto max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white pb-8">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 pb-3 pt-4 backdrop-blur">
          <h3 className="text-base font-bold">📄 从论文提取知识点</h3>
          {!busy && (
            <button
              onClick={close}
              aria-label="关闭"
              className="rounded-full bg-slate-100 p-2 text-slate-500 active:bg-slate-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className={`space-y-4 px-5 pt-4 ${busy ? "pointer-events-none opacity-70" : ""}`}>
          <p className="text-xs leading-relaxed text-slate-500">
            粘贴 <b>DOI / arXiv ID / 论文链接 / 论文标题</b>（自动从 OpenAlex 取题录与参考文献），
            或直接粘贴<b>摘要 / 正文片段</b>。AI 将拆解出读懂这篇论文所需的知识点并入当前学习计划。
          </p>

          {(phase === "input" || phase === "loadingMeta") && (
            <>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={4}
                placeholder={"例如：\n2006.11239\n或 10.48550/arxiv.2006.11239\n或 Denoising Diffusion Probabilistic Models\n或直接粘贴摘要…"}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              />
              {error && <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
              <button
                onClick={submitInput}
                disabled={busy}
                className="w-full rounded-full bg-indigo-600 py-3.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:bg-slate-300"
              >
                {phase === "loadingMeta" ? "正在 OpenAlex 查询论文…" : "下一步"}
              </button>
            </>
          )}

          {phase === "confirm" && meta && (
            <>
              <div className="rounded-2xl bg-slate-50 p-4">
                <h4 className="text-sm font-bold leading-snug">{meta.title}</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {meta.authors.join(", ")}
                  {meta.authors.length ? " · " : ""}
                  {[meta.year, meta.venue, meta.citations !== undefined ? `被引 ${meta.citations}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {meta.abstract && (
                  <p className="mt-2 line-clamp-6 text-xs leading-relaxed text-slate-600">{meta.abstract}</p>
                )}
                <p className="mt-2 text-xs font-medium text-indigo-700">
                  📚 已获取 {meta.refs.length} 篇参考文献题录（AI 将从中挑选必读引文）
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">
                  正文片段（可选，帮助 AI 更准确地拆解）
                </label>
                <textarea
                  value={extraText}
                  onChange={(e) => setExtraText(e.target.value)}
                  rows={4}
                  placeholder="可粘贴方法部分、引言等关键段落"
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setPhase("input");
                    setMeta(null);
                  }}
                  className="rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 active:bg-slate-100"
                >
                  上一步
                </button>
                <button
                  onClick={() => analyze(meta, extraText.trim() || undefined)}
                  className="rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white active:bg-indigo-700"
                >
                  AI 提取知识点
                </button>
              </div>
            </>
          )}

          {phase === "analyzing" && (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-500">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              AI 正在分析论文并拆解知识点，通常需要 10~60 秒…
            </div>
          )}

          {isMock && phase !== "analyzing" && (
            <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
              当前为 Mock 模式：OpenAlex 题录查询仍是真实的，但知识点拆解为演示数据。
            </div>
          )}
          <p className="pb-2 text-center text-[11px] text-slate-400">
            分析目标方向：{direction || "（未设置）"}
          </p>
        </div>
      </div>
    </div>
  );
}
