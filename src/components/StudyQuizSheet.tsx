import { useEffect, useState } from "react";
import type { Mastery, StudyCard } from "../types";

type Phase = "quiz" | "done";

/**
 * 背单词式自测卡片流：
 * 问题面 → 用户思考 → 翻面看答案/解析 → 自评（答上/没答上）→ 下一题 → 结果与掌握度建议
 */
export default function StudyQuizSheet({
  nodeName,
  card,
  busy,
  onClose,
  onFinish,
  onSetMastery,
  masteryTargetLabel,
  currentMastery,
  currentAllMastered,
  currentAllPartial,
}: {
  nodeName: string;
  card: StudyCard;
  busy: boolean;
  onClose: () => void;
  /** 自测完成：全部答对 true / 有不会的 false */
  onFinish: (allCorrect: boolean, correctCount: number, total: number) => void;
  /** 完成页的掌握度选择（是否改变由用户决定） */
  onSetMastery?: (m: Mastery | "keep") => void;
  /** 掌握度作用对象说明（如「这两个知识点」），缺省为该知识点 */
  masteryTargetLabel?: string;
  currentMastery?: Mastery;
  currentAllMastered?: boolean;
  currentAllPartial?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [phase, setPhase] = useState<Phase>("quiz");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const questions = card.questions;
  const total = questions.length;
  const q = questions[idx];

  function answer(knewIt: boolean) {
    const c = knewIt ? correct + 1 : correct;
    setCorrect(c);
    setRevealed(false);
    if (idx + 1 >= total) {
      setPhase("done");
      onFinish(total === c, c, total);
    } else {
      setIdx(idx + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="fade-enter absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="sheet-enter relative mx-auto flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white pb-8">
        {/* 顶栏 */}
        <div className="sticky top-0 border-b border-slate-100 bg-white/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-3">
              <h3 className="text-base font-bold">🃏 自测 · {nodeName}</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {phase === "quiz" ? `第 ${idx + 1} / ${total} 题 · 答对 ${correct}` : `完成 · 答对 ${correct}/${total}`}
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
          {phase === "quiz" && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${(idx / total) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className={`flex-1 overflow-y-auto px-5 pt-4 ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {phase === "quiz" && q && (
            <>
              {/* 问题面 */}
              <div className="rounded-2xl bg-slate-900 p-5 text-white">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Question</p>
                <p className="mt-2 text-base font-semibold leading-relaxed">{q.q}</p>
                {!revealed && (
                  <p className="mt-4 text-xs text-slate-400">先在心里作答（或说出来），再翻面对照答案</p>
                )}
              </div>

              {/* 翻面后：答案/解析 */}
              {revealed && (
                <div className="sheet-enter mt-3 rounded-2xl bg-emerald-50 p-5">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-600">Answer · 解析</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{q.a}</p>
                </div>
              )}
            </>
          )}

          {phase === "done" && (
            <div className="py-6 text-center">
              <div className="text-5xl">{correct === total ? "🎉" : correct >= total / 2 ? "👍" : "💪"}</div>
              <h4 className="mt-3 text-lg font-bold">
                答对 {correct} / {total}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {correct === total
                  ? "全部答对！说明这个知识点你已经掌握，可以标记为「已掌握」"
                  : correct >= total / 2
                    ? "大体掌握，还有薄弱点。建议标记为「部分掌握」，隔天再测一次"
                    : "掌握还不够扎实，建议保持「未掌握」，回看概括与原文片段后再测"}
              </p>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="space-y-2 px-5 pt-4">
          {phase === "quiz" &&
            (revealed ? (
              <>
                <button
                  onClick={() => answer(true)}
                  className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white active:bg-emerald-700"
                >
                  ✓ 答上来了
                </button>
                <button
                  onClick={() => answer(false)}
                  className="w-full rounded-xl border border-rose-200 py-3 text-sm font-medium text-rose-600 active:bg-rose-50"
                >
                  ✗ 没答上 / 答错了
                </button>
              </>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white active:bg-indigo-700"
              >
                翻面看答案
              </button>
            ))}
          {phase === "done" && (
            <>
              <p className="text-center text-xs font-medium text-slate-500">
                自测完成，是否更新{masteryTargetLabel || "该知识点"}的掌握程度？（由你决定）
              </p>
              {onSetMastery && (
                <div className="space-y-2">
                  <button
                    onClick={() => onSetMastery("mastered")}
                    disabled={busy || currentMastery === "mastered" || currentAllMastered === true}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
                  >
                    {currentMastery === "mastered" || currentAllMastered === true
                      ? "✓ 已是已掌握，无需更改"
                      : `✓ 更新为「已掌握」${masteryTargetLabel ? `（${masteryTargetLabel}）` : ""}`}
                  </button>
                  <button
                    onClick={() => onSetMastery("partial")}
                    disabled={busy || currentMastery === "partial" || currentAllPartial === true}
                    className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white active:bg-amber-600 disabled:opacity-50"
                  >
                    {currentMastery === "partial" || currentAllPartial === true
                      ? "✓ 已是部分掌握，无需更改"
                      : `◐ 更新为「部分掌握」${masteryTargetLabel ? `（${masteryTargetLabel}）` : ""}`}
                  </button>
                  <button
                    onClick={() => onSetMastery("keep")}
                    className="w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-600 active:bg-slate-100"
                  >
                    保持现状不改变
                  </button>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white active:bg-slate-700"
              >
                完成
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
