import type { KnowledgeNode, Mastery } from "../types";
import MasteryControl from "./MasteryControl";
import { importanceLabel } from "../route";

const KIND_ICON: Record<string, string> = {
  concept: "🧩",
  model: "🧠",
  formula: "∑",
  paper: "📄",
  tool: "🛠",
};

function hoursText(h: number): string {
  return Number.isInteger(h) ? `${h}h` : `${h}h`;
}

const IMPORTANCE_CLS: Record<string, string> = {
  core: "bg-rose-50 text-rose-600",
  recommended: "bg-sky-50 text-sky-600",
  extension: "bg-slate-100 text-slate-500",
};

export default function NodeCard({
  node,
  onMasteryChange,
  onOpen,
  busy,
}: {
  node: KnowledgeNode;
  onMasteryChange: (m: Mastery) => void;
  onOpen: () => void;
  busy?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-3.5 shadow-sm transition-opacity ${
        node.mastery === "mastered" ? "opacity-60" : ""
      } ${busy ? "pointer-events-none" : ""}`}
    >
      <div onClick={onOpen} className="cursor-pointer">
        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${IMPORTANCE_CLS[node.importance]}`}
          >
            {importanceLabel(node.importance)}
          </span>
          <h4
            className={`min-w-0 flex-1 truncate text-sm font-semibold ${
              node.mastery === "mastered" ? "line-through decoration-slate-300" : ""
            }`}
          >
            <span className="mr-1">{KIND_ICON[node.kind || "concept"]}</span>
            {node.name}
          </h4>
          <span className="shrink-0 text-xs text-slate-400">{hoursText(node.estHours)}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-300">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {node.mastery === "partial" && (
          <p className="mt-1.5 text-xs text-amber-600">◐ 部分掌握，建议安排复习</p>
        )}
        {node.prereqs.length > 0 && (
          <p className="mt-1.5 truncate text-xs text-slate-400">
            前置：{node.prereqs.join("、")}
          </p>
        )}
      </div>
      <div className="mt-3">
        <MasteryControl value={node.mastery} onChange={onMasteryChange} disabled={busy} />
      </div>
    </div>
  );
}
