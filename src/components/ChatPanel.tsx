import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";

/**
 * AI 讨论面板：消息流 + 输入框（Enter 发送）。
 * 对话内容与持久化由父级管理，本组件只负责展示与收集输入。
 */
export default function ChatPanel({
  messages,
  onSend,
  busy,
  placeholder = "追问任何细节：概念直觉、公式推导、与论文的关系…",
  hint = "与 AI 讨论这个知识点，对话会保存在学习计划里",
  maxH = "240px",
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  busy: boolean;
  placeholder?: string;
  hint?: string;
  maxH?: string;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  function send() {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    onSend(t);
  }

  return (
    <div>
      {messages.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-400">{hint}</p>
      ) : (
        <div
          ref={scrollRef}
          className="space-y-2.5 overflow-y-auto rounded-xl bg-slate-50 p-3"
          style={{ maxHeight: maxH }}
        >
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-400">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 align-middle" />
                <span className="ml-2 align-middle">AI 思考中…</span>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white active:bg-indigo-700 disabled:bg-slate-300"
        >
          发送
        </button>
      </div>
    </div>
  );
}
