import { useEffect, useState } from "react";
import { backendMode, createProject, generateTree, fetchSettings } from "../api";
import { useToast } from "../toast";

const STATUS_TEXTS = [
  "正在分析科研方向…",
  "梳理基础与核心知识…",
  "构建知识依赖关系…",
  "挑选推荐学习资料…",
  "即将完成，正在整理清单…",
];

export default function CreateProject() {
  const toast = useToast();
  const [direction, setDirection] = useState("");
  const [background, setBackground] = useState("");
  const [goal, setGoal] = useState("");
  const [isMock, setIsMock] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);

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

  async function submit() {
    if (!direction.trim()) {
      toast("请先填写科研方向", "error");
      return;
    }
    setBusy(true);
    setStatusIdx(0);
    try {
      const project = await createProject({
        direction: direction.trim(),
        background: background.trim(),
        goal: goal.trim(),
      });
      const full = await generateTree(project.id);
      toast("知识清单已生成", "success");
      window.location.hash = `#/project/${full.id}`;
    } catch (e) {
      toast(e instanceof Error ? e.message : "生成失败", "error");
      setBusy(false);
    }
  }

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
          <p className="mt-1 text-xs text-slate-400">AI 会据此标注你可能已掌握的内容</p>
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
              : "可在「设置」中配置 OpenAI 兼容接口（智谱 GLM / DeepSeek / Kimi / OpenAI 均可）获得个性化内容。"}
          </div>
        )}
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-2xl bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent px-4 pb-5 pt-6">
        {busy ? (
          <div className="flex items-center justify-center gap-3 rounded-full bg-slate-900 py-3.5 text-sm text-white">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {STATUS_TEXTS[statusIdx]}
          </div>
        ) : (
          <button
            onClick={submit}
            className="w-full rounded-full bg-indigo-600 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 active:bg-indigo-700"
          >
            AI 生成知识清单
          </button>
        )}
      </div>
    </div>
  );
}
