import type { Mastery } from "../types";

const OPTIONS: { value: Mastery; label: string; activeCls: string }[] = [
  { value: "mastered", label: "已掌握", activeCls: "bg-emerald-500 text-white" },
  { value: "partial", label: "部分掌握", activeCls: "bg-amber-500 text-white" },
  { value: "unknown", label: "未掌握", activeCls: "bg-slate-400 text-white" },
];

export default function MasteryControl({
  value,
  onChange,
  disabled,
}: {
  value: Mastery;
  onChange: (m: Mastery) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex overflow-hidden rounded-lg bg-slate-100 p-0.5 ${disabled ? "opacity-60" : ""}`}
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (opt.value !== value) onChange(opt.value);
          }}
          className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value ? opt.activeCls : "text-slate-500"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
