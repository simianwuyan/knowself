import { useEffect, useState } from "react";
import { fetchProjects } from "../api";
import type { ProjectSummary } from "../types";

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch((e) => {
        setError(e.message);
        setProjects([]);
      });
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-slate-900 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div>
          <h1 className="text-xl font-bold tracking-wide">KnowSelf</h1>
          <p className="mt-0.5 text-xs text-slate-400">AI 帮你规划科研学习路线</p>
        </div>
        <a
          href="#/settings"
          aria-label="设置"
          className="rounded-full p-2.5 text-slate-300 active:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </a>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        {projects === null && !error && (
          <p className="py-16 text-center text-sm text-slate-400">加载中…</p>
        )}
        {projects !== null && projects.length === 0 && (
          <div className="mt-16 rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">🧭</div>
            <h2 className="mt-3 text-lg font-semibold">开始你的第一个学习计划</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              输入你的科研方向，AI 会生成所需的知识清单；
              <br />
              标注掌握情况后，自动排出分阶段学习路线。
            </p>
            <a
              href="#/new"
              className="mt-5 inline-block rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white active:bg-indigo-700"
            >
              新建学习计划
            </a>
          </div>
        )}
        {error && (
          <div className="mt-8 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}

        <div className="space-y-3">
          {projects?.map((p) => (
            <a
              key={p.id}
              href={`#/project/${p.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm active:bg-slate-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{p.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{p.direction}</p>
                </div>
                <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                  {p.total === 0
                    ? "待生成"
                    : `进度 ${p.total ? Math.round((p.mastered / p.total) * 100) : 0}%`}
                </span>
              </div>
              {p.total > 0 && (
                <>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${p.total ? (p.mastered / p.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="mt-2 flex gap-3 text-xs text-slate-400">
                    <span>{p.total} 个知识点</span>
                    <span>已掌握 {p.mastered}</span>
                    {p.partial > 0 && <span>待复习 {p.partial}</span>}
                    <span>剩余约 {p.remainingHours}h</span>
                  </div>
                </>
              )}
            </a>
          ))}
        </div>
      </main>

      <a
        href="#/new"
        aria-label="新建学习计划"
        className="safe-bottom fixed bottom-5 left-1/2 z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-indigo-600 text-3xl font-light text-white shadow-lg shadow-indigo-600/30 active:bg-indigo-700"
        style={{ marginLeft: "max(0px, 0px)" }}
      >
        +
      </a>
    </div>
  );
}
