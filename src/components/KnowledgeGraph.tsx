import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { KnowledgeNode } from "../types";
import { computeLevels } from "../route";

const KIND_ICON: Record<string, string> = {
  concept: "🧩",
  model: "🧠",
  formula: "∑",
  paper: "📄",
  tool: "🛠",
};

const NODE_W = 112;
const NODE_H = 44;
const ROW_H = 92;
const SLOT_W = 128;

const MASTERY_STYLE: Record<string, { fill: string; stroke: string; label: string }> = {
  mastered: { fill: "#d1fae5", stroke: "#10b981", label: "已掌握" },
  partial: { fill: "#fef3c7", stroke: "#f59e0b", label: "待复习" },
  unknown: { fill: "#f1f5f9", stroke: "#94a3b8", label: "未学" },
};

/** 核心类型节点用专属描边色：公式紫、论文蓝，图谱中一眼可辨 */
const KIND_STROKE: Record<string, string> = {
  formula: "#7c3aed",
  paper: "#2563eb",
};

function strokeFor(node: KnowledgeNode): string {
  return KIND_STROKE[node.kind || ""] || MASTERY_STYLE[node.mastery]?.stroke || "#94a3b8";
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function KnowledgeGraph({
  nodes,
  onOpen,
}: {
  nodes: KnowledgeNode[];
  onOpen: (node: KnowledgeNode) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 10, y: 10 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);

  const { positioned, edges, canvasW, canvasH } = useMemo(() => {
    const level = computeLevels(nodes);
    const byLevel = new Map<number, KnowledgeNode[]>();
    for (const n of nodes) {
      const lv = level.get(n.id) ?? 0;
      if (!byLevel.has(lv)) byLevel.set(lv, []);
      byLevel.get(lv)!.push(n);
    }
    const maxLevel = Math.max(0, ...Array.from(byLevel.keys()));
    const maxCount = Math.max(1, ...Array.from(byLevel.values()).map((a) => a.length));
    const cw = Math.max(360, maxCount * SLOT_W + 20);
    const ch = (maxLevel + 1) * ROW_H + 10;
    const positioned = nodes.map((n) => {
      const lv = level.get(n.id) ?? 0;
      const group = byLevel.get(lv)!;
      const idx = group.indexOf(n);
      const slotW = cw / group.length;
      return {
        node: n,
        level: lv,
        x: idx * slotW + slotW / 2 - NODE_W / 2,
        y: lv * ROW_H + 24,
      };
    });
    const posById = new Map(positioned.map((p) => [p.node.id, p]));
    const idByName = new Map(
      nodes.map((n) => [n.name.toLowerCase().replace(/\s+/g, ""), n.id])
    );
    const edges: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
    for (const n of nodes) {
      const target = posById.get(n.id);
      if (!target) continue;
      for (const p of n.prereqs || []) {
        const pid = idByName.get(p.toLowerCase().replace(/\s+/g, ""));
        const src = pid ? posById.get(pid) : undefined;
        if (!src) continue;
        edges.push({
          from: { x: src.x + NODE_W / 2, y: src.y + NODE_H },
          to: { x: target.x + NODE_W / 2, y: target.y },
        });
      }
    }
    return { positioned, edges, canvasW: cw, canvasH: ch };
  }, [nodes]);

  // 初始缩放：适配容器宽度
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth - 20;
    setScale(Math.min(1, Math.max(0.45, w / canvasW)));
    setOffset({ x: 10, y: 10 });
  }, [canvasW]);

  function onPointerDown(e: ReactPointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.current.moved = true;
    setOffset({ x: drag.current.ox + dx, y: drag.current.oy + dy });
  }
  function onPointerUp() {
    drag.current = null;
  }

  function openIfTap(node: KnowledgeNode) {
    if (drag.current?.moved) return;
    onOpen(node);
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[62vh] touch-none overflow-hidden rounded-2xl bg-slate-100/70"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          style={{
            width: canvasW * scale,
            height: canvasH * scale,
            position: "relative",
          }}
        >
          <svg
            width={canvasW}
            height={canvasH}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const d = `M ${e.from.x} ${e.from.y} C ${e.from.x} ${e.from.y + 34}, ${e.to.x} ${e.to.y - 34}, ${e.to.x} ${e.to.y}`;
              const sameCol = Math.abs(e.from.x - e.to.x) < 2;
              return (
                <path
                  key={i}
                  d={sameCol ? `M ${e.from.x} ${e.from.y} L ${e.to.x} ${e.to.y}` : d}
                  stroke="#cbd5e1"
                  strokeWidth="1.6"
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              );
            })}
            {positioned.map((p) => {
              const st = MASTERY_STYLE[p.node.mastery] || MASTERY_STYLE.unknown;
              const stroke = strokeFor(p.node);
              const isFormula = p.node.kind === "formula";
              return (
                <g
                  key={p.node.id}
                  transform={`translate(${p.x}, ${p.y})`}
                  onClick={() => openIfTap(p.node)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx="10"
                    fill={st.fill}
                    stroke={stroke}
                    strokeWidth={isFormula ? 2.6 : p.node.importance === "core" ? 2 : 1.2}
                  />
                  {isFormula && (
                    <circle cx={NODE_W - 9} cy={9} r="7" fill="#7c3aed" />
                  )}
                  {isFormula && (
                    <text x={NODE_W - 9} y={12.5} fontSize="9" fill="#ffffff" textAnchor="middle" fontWeight="bold">
                      ∑
                    </text>
                  )}
                  <text x="8" y="17" fontSize="10">
                    {KIND_ICON[p.node.kind || "concept"]}
                  </text>
                  <text x="8" y="33" fontSize="11" fill="#0f172a" fontWeight="600">
                    {trunc(p.node.name, 9)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 缩放按钮 */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          aria-label="放大"
          onClick={() => setScale((s) => Math.min(1.6, s + 0.15))}
          className="h-9 w-9 rounded-full bg-white text-lg font-bold text-slate-600 shadow-md active:bg-slate-100"
        >
          +
        </button>
        <button
          aria-label="缩小"
          onClick={() => setScale((s) => Math.max(0.45, s - 0.15))}
          className="h-9 w-9 rounded-full bg-white text-lg font-bold text-slate-600 shadow-md active:bg-slate-100"
        >
          −
        </button>
      </div>

      {/* 图例 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-slate-500">
        {Object.entries(MASTERY_STYLE).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: v.fill, border: `1.5px solid ${v.stroke}` }}
            />
            {v.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ border: "2px solid #7c3aed" }}
          />
          核心公式
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ border: "2px solid #2563eb" }}
          />
          论文/引文
        </span>
        <span className="ml-auto">🧩概念 🧠模型 ∑公式 📄论文 🛠工具 · 单指拖动平移</span>
      </div>
    </div>
  );
}
