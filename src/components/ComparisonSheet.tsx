import { useEffect, useState } from "react";
import type { Mastery } from "../types";
import StudyQuizSheet from "./StudyQuizSheet";

export default function ComparisonSheet({
  nodeNames,
  text,
  questions,
  mode,
  busy,
  onClose,
  onSave,
  onDelete,
  onSetMasteryBoth,
  currentAllMastered,
  currentAllPartial,
}: {
  nodeNames: string[];
  text: string;
  /** 对比自测题（新对比必有；旧记录可能没有） */
  questions?: { q: string; a: string }[];
  mode: "new" | "view";
  busy?: boolean;
  onClose: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  /** 自测完成后由用户选择是否更新掌握度（作用于对比的全部知识点） */
  onSetMasteryBoth?: (m: Mastery | "keep") => void;
  currentAllMastered?: boolean;
  currentAllPartial?: boolean;
}) {
  const [showQuiz, setShowQuiz] = useState(false);

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
      <div className="sheet-enter relative mx-auto flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white pb-6">
        <div className="sticky top-0 border-b border-slate-100 bg-white/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold">⚖️ 知识点对比</h3>
              <p className="mt-0.5 truncate text-xs text-slate-400">{nodeNames.join(" × ")}</p>
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
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4">
          <div
            className={`rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {text
              .split("\n")
              .filter((l) => l.trim())
              .map((line, i) => {
                const isHeading = /^[【\[]/.test(line.trim());
                return (
                  <p key={i} className={isHeading ? "mt-3 font-bold text-slate-900" : "mt-1"}>
                    {line}
                  </p>
                );
              })}
          </div>
        </div>

        <div className="space-y-2 px-5 pt-4">
          {questions && questions.length > 0 && onSetMasteryBoth && (
            <button
              onClick={() => setShowQuiz(true)}
              disabled={busy}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white active:bg-slate-700 disabled:opacity-50"
            >
              🃏 用这份对比自测（{questions.length} 题）→ 决定掌握度
            </button>
          )}
          {mode === "new" && onSave && (
            <button
              onClick={onSave}
              disabled={busy}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white active:bg-indigo-700 disabled:bg-slate-300"
            >
              保存到项目（可在菜单「对比记录」回看）
            </button>
          )}
          {mode === "view" && onDelete && (
            <button
              onClick={onDelete}
              disabled={busy}
              className="w-full rounded-xl border border-rose-200 py-2.5 text-xs font-medium text-rose-600 active:bg-rose-50"
            >
              删除该对比记录
            </button>
          )}
        </div>

        {/* 对比自测卡片流 */}
        {showQuiz && questions && (
          <StudyQuizSheet
            nodeName={`对比 · ${nodeNames.join(" × ")}`}
            card={{ summary: "", questions, generatedAt: 0 }}
            busy={Boolean(busy)}
            onClose={() => setShowQuiz(false)}
            onFinish={() => {
              /* 结果在完成页由用户选择 */
            }}
            onSetMastery={(m) => onSetMasteryBoth?.(m)}
            masteryTargetLabel={`这两个知识点`}
            currentAllMastered={currentAllMastered}
            currentAllPartial={currentAllPartial}
          />
        )}
      </div>
    </div>
  );
}
