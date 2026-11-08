import { useEffect, useState } from "react";
import type { PaperMeta, ProjectPaper } from "../types";
import { backendMode, createProject, generateTree, fetchSettings } from "../api";
import { detectPaperLookup, fetchPaperMeta } from "../literature";
import { useToast } from "../toast";

const STATUS_TEXTS = [
  "正在精读论文结构…",
  "拆解方法链条与公式…",
  "挑选必读引文…",
  "摘录论文原文片段…",
  "即将完成，正在整理路线…",
];

type PaperPhase = "input" | "loadingMeta" | "confirm";

export default function CreateProject() {
  const toast = useToast();
  const [mode, setMode] = useState<"direction" | "paper">("direction");
  const [direction, setDirection] = useState("");
  const [background, setBackground] = useState("");
  const [goal, setGoal] = useState("");
  const [isMock, setIsMock] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);

  // 论文模式
  const [paperInput, setPaperInput] = useState("");
  const [paperPhase, setPaperPhase] = useState<PaperPhase>("input");
  const [paperMeta, setPaperMeta] = useState<PaperMeta | null>(null);
  const [paperError, setPaperError] = useState("");
  const [extraText, setExtraText] = useState("");

  useEffect(() => {
    fetchSettings()
      .then((s) => setIsMock(s.isMock))
      .catch(() => setIsMock(false));
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(
      () => setStatusIdx((i) => (i + 1) % STATUS_TEXTS.length),
      4000
    );
    return () => clearInterval(t);
  }, [busy]);

  async function lookupPaper() {
    if (!paperInput.trim()) {
      toast("请先粘贴论文网址、DOI、arXiv ID 或标题", "error");
      return;
    }
    setPaperError("");
    const lookup = detectPaperLookup(paperInput);
    if (!lookup) {
      // 长文本 → 直接作为素材
      setPaperMeta({
        title: paperInput.trim().slice(0, 60).split("\n")[0] || "粘贴的论文内容",
        authors: [],
        refs: [],
        source: "text",
        abstract: paperInput.trim().slice(0, 6000),
      });
      setPaperPhase("confirm");
      return;
    }
    setPaperPhase("loadingMeta");
    try {
      const m = await fetchPaperMeta(lookup);
      setPaperMeta(m);
      setPaperPhase("confirm");
    } catch (e) {
      setPaperError(e instanceof Error ? e.message : "查询失败");
      setPaperPhase("input");
    }
  }

  async function submit() {
    if (busy) return;
    if (mode === "paper") {
      if (!paperMeta) {
        toast("请先查询论文", "error");
        return;
      }
    } else if (!direction.trim()) {
      toast("请先填写科研方向", "error");
      return;
    }
    setBusy(true);
    setStatusIdx(0);
    try {
      const paper: ProjectPaper | undefined =
        mode === "paper" && paperMeta
          ? {
              title: paperMeta.title,
              authors: paperMeta.authors,
              year: paperMeta.year,
              venue: paperMeta.venue,
              abstract: paperMeta.abstract,
              extraText: extraText.trim() || undefined,
              refs: paperMeta.refs,
              source: paperMeta.source,
            }
          : undefined;
      const project = await createProject({
        direction:
          mode === "paper" && paperMeta ? paperMeta.title : direction.trim(),
        background: background.trim(),
        goal: goal.trim(),
        paper,
      });
      await generateTree(project.id);
      toast(mode === "paper" ? "论文学习路线已生成" : "知识清单已生成", "success");
      window.location.hash = `#/project/${project.id}`;
    } catch (e) {
      toast(e instanceof Error ? e.message : "生成失败", "error");
      setBusy(false);
    }
  }

  const submitting = busy;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-slate-900 px-3 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <a href="#/" aria-label="返回" className="rounded-full p-2 active:bg-white/10">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-lg font-semibold">新建学习计划</h1>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-32 pt-4">
        {/* 模式切换 */}
        <div className="flex rounded-xl bg-slate-200/60 p-1">
          {(
            [
              ["direction", "🔬 科研方向"],
              ["paper", "📄 论文精读"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                mode === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "direction" ? (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium">
              科研方向 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="例如：扩散模型在图像生成中的应用"
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
            />
            <p className="mt-1 text-xs text-slate-400">越具体，AI 生成的内容越贴合你的方向</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <label className="block text-sm font-medium">
                要精读的论文 <span className="text-rose-500">*</span>
              </label>
              {paperPhase !== "confirm" && (
                <>
                  <textarea
                    value={paperInput}
                    onChange={(e) => setPaperInput(e.target.value)}
                    rows={2}
                    placeholder={"支持：arXiv ID（如 2006.11239）/ DOI / 论文链接 / 论文标题"}
                    className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                  />
                  {paperError && (
                    <div className="mt-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{paperError}</div>
                  )}
                  <button
                    onClick={lookupPaper}
                    disabled={paperPhase === "loadingMeta"}
                    className="mt-3 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white active:bg-slate-700 disabled:opacity-60"
                  >
                    {paperPhase === "loadingMeta" ? "正在 OpenAlex 查询论文…" : "查询论文题录与参考文献"}
                  </button>
                </>
              )}
              {paperPhase === "confirm" && paperMeta && (
                <>
                  <div className="mt-2 rounded-xl bg-slate-50 p-3.5">
                    <h4 className="text-sm font-bold leading-snug">{paperMeta.title}</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      {paperMeta.authors.join(", ")}
                      {paperMeta.authors.length ? " · " : ""}
                      {[paperMeta.year, paperMeta.venue, paperMeta.citations !== undefined ? `被引 ${paperMeta.citations}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {paperMeta.abstract && (
                      <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-slate-600">{paperMeta.abstract}</p>
                    )}
                    <p className="mt-2 text-xs font-medium text-indigo-700">
                      📚 已获取 {paperMeta.refs.length} 篇参考文献题录
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setPaperPhase("input");
                      setPaperMeta(null);
                    }}
                    className="mt-2 text-xs text-indigo-600 active:text-indigo-700"
                  >
                    ← 换一篇论文
                  </button>
                </>
              )}
              <p className="mt-1.5 text-xs text-slate-400">
                将以这篇论文为中心生成完整学习路线，并尽量摘录每个知识点对应的论文原文片段
              </p>
            </div>

            {paperPhase === "confirm" && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <label className="block text-sm font-medium">
                  正文片段（强烈建议，用于摘录原文对应片段）
                </label>
                <textarea
                  value={extraText}
                  onChange={(e) => setExtraText(e.target.value)}
                  rows={5}
                  maxLength={20000}
                  placeholder="粘贴论文的引言、方法部分等（只有摘要时，AI 只能摘录摘要中的句子）"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                />
              </div>
            )}
          </>
        )}

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium">已有背景（可选）</label>
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="例如：本科数学系，会 Python，没接触过深度学习"
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          />
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium">学习目标（可选）</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="例如：半年内能读懂顶会论文并复现 baseline"
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          />
        </div>

        {isMock && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
            当前未配置 AI 接口，将使用演示数据。
            {backendMode() === "local"
              ? "可在「设置」中配置支持浏览器直连的接口（DeepSeek / Kimi / OpenAI）。"
              : "可在「设置」中配置 OpenAI 兼容接口获得个性化内容。"}
          </div>
        )}
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-2xl bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent px-4 pb-5 pt-6">
        {submitting ? (
          <div className="flex items-center justify-center gap-3 rounded-full bg-slate-900 py-3.5 text-sm text-white">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {STATUS_TEXTS[statusIdx]}
          </div>
        ) : (
          <button
            onClick={submit}
            className="w-full rounded-full bg-indigo-600 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 active:bg-indigo-700"
          >
            {mode === "paper" ? "AI 生成论文学习路线" : "AI 生成知识清单"}
          </button>
        )}
      </div>
    </div>
  );
}
