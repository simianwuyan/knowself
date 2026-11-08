import { useState } from "react";
import { saveSettings, skipUnlock, unlockKey } from "../api";
import { useToast } from "../toast";

export default function UnlockGate({ onUnlocked }: { onUnlocked: () => void }) {
  const toast = useToast();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!pin.trim()) {
      setError("请输入解锁码");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await unlockKey(pin.trim());
      onUnlocked();
    } catch (e) {
      setError(e instanceof Error && e.message !== "The operation failed." ? e.message : "解锁码不正确");
    } finally {
      setBusy(false);
    }
  }

  async function clearKey() {
    if (!window.confirm("忘记解锁码将清除已保存的 API Key（清除后需重新填写），继续？")) return;
    await saveSettings({ apiKey: "" });
    toast("已清除，请重新在设置中填写 Key", "info");
    onUnlocked();
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-slate-800 p-7 text-white shadow-2xl">
        <div className="text-center text-4xl">🔒</div>
        <h1 className="mt-3 text-center text-lg font-bold">KnowSelf 已锁定</h1>
        <p className="mt-1.5 text-center text-xs leading-relaxed text-slate-400">
          API Key 已加密保存，输入解锁码后本会话内使用
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="解锁码（4~6 位）"
          autoFocus
          className="mt-5 w-full rounded-xl border border-slate-600 bg-slate-700 p-3.5 text-center text-lg tracking-[0.5em] outline-none focus:border-indigo-400"
        />
        {error && <p className="mt-2 text-center text-xs text-rose-400">{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "解锁中…" : "解锁"}
        </button>
        <div className="mt-4 flex justify-between text-xs text-slate-400">
          <button onClick={clearKey} className="active:text-slate-200">
            忘记解锁码？
          </button>
          <button
            onClick={() => {
              skipUnlock();
              onUnlocked();
            }}
            className="active:text-slate-200"
          >
            暂用演示模式 →
          </button>
        </div>
      </div>
    </div>
  );
}
