import { useEffect, useRef, useState } from "react";
import {
  backendMode,
  exportAllData,
  fetchSettings,
  importAllData,
  saveSettings,
  testConnection,
} from "../api";
import type { SettingsView } from "../types";
import { useToast } from "../toast";

const PRESETS: { name: string; baseUrl: string; model: string; direct: boolean }[] = [
  { name: "DeepSeek（可直连）", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", direct: true },
  { name: "Kimi（可直连）", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", direct: true },
  { name: "OpenAI（可直连）", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", direct: true },
  { name: "智谱 GLM（仅服务器模式）", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.5-flash", direct: false },
];

export default function SettingsPage() {
  const toast = useToast();
  const [info, setInfo] = useState<SettingsView | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [useMock, setUseMock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [mode] = useState<"server" | "local">(() => backendMode());
  const [pin, setPin] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setInfo(s);
        setBaseUrl(s.baseUrl);
        setModel(s.model);
        setUseMock(s.useMock);
      })
      .catch((e) => toast(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave() {
    if (mode === "local" && apiKey.trim() && pin.trim().length < 4) {
      toast("请设置 4~6 位解锁码（用于加密保存 API Key）", "error");
      return;
    }
    setSaving(true);
    try {
      const s = await saveSettings({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(), // 留空 = 不修改已保存的 Key
        model: model.trim(),
        useMock,
        pin: mode === "local" && apiKey.trim() ? pin.trim() : undefined,
      });
      setInfo(s);
      setApiKey("");
      setPin("");
      toast("设置已保存", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    setTestResult("");
    try {
      const r = await testConnection({
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        model: model.trim() || undefined,
      });
      setTestResult(`✅ 连接成功（${r.ms}ms）：${r.reply}`);
    } catch (e) {
      setTestResult(`❌ ${e instanceof Error ? e.message : "连接失败"}`);
    } finally {
      setTesting(false);
    }
  }

  function downloadText(filename: string, text: string) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onExport() {
    try {
      const text = await exportAllData();
      const date = new Date().toISOString().slice(0, 10);
      downloadText(`knowself-backup-${date}.json`, text);
      toast("备份已导出", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "导出失败", "error");
    }
  }

  async function onImportFile(file: File) {
    try {
      const text = await file.text();
      if (!window.confirm("导入将覆盖本机当前所有学习计划数据，继续？")) return;
      const count = await importAllData(text);
      toast(`已导入 ${count} 个项目，即将刷新`, "success");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast(e instanceof Error ? e.message : "导入失败", "error");
    }
  }

  async function onClearKey() {
    if (
      !window.confirm(
        "将立即从本机彻底清除 API Key（学习计划数据不受影响），下次使用需重新填写。确认清除？"
      )
    )
      return;
    try {
      const s = await saveSettings({ apiKey: "" });
      setInfo(s);
      setApiKey("");
      setPin("");
      toast("API Key 已彻底清除。建议定期清理，保持用完即清的习惯。", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "清除失败", "error");
    }
  }

  const isMockNow = info?.isMock ?? false;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-slate-900 px-3 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <a href="#/" aria-label="返回" className="rounded-full p-2 active:bg-white/10">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-lg font-semibold">设置</h1>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-16 pt-4">
        <div className="rounded-xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600">
          {mode === "server"
            ? "🖥 服务器模式：数据保存在电脑端，AI 经电脑代理（手机与电脑需同局域网）"
            : `📱 本地模式：数据保存在本机浏览器，AI 由浏览器直连${
                info?.hasKey && !info?.legacyPlainKey ? " · 🔒 Key 已加密保存" : ""
              }`}
        </div>

        <div
          className={`rounded-xl p-3 text-xs leading-relaxed ${
            isMockNow ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {isMockNow
            ? "当前为 Mock 演示模式（未配置接口或已开启模拟）。配置以下信息后即可使用真实 AI。"
            : `已连接 AI：${info?.model || "默认模型"}`}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">AI 接口（OpenAI 兼容）</h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  if (!p.direct && mode === "local") {
                    toast("智谱 GLM 有跨域限制，浏览器无法直连；本地模式请用 DeepSeek / Kimi", "error");
                    return;
                  }
                  setBaseUrl(p.baseUrl);
                  setModel(p.model);
                }}
                className={`rounded-full px-3 py-1.5 text-xs active:brightness-95 ${
                  p.direct || mode === "server"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-slate-50 text-slate-400 line-through"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-xs font-medium text-slate-500">接口地址 Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          />

          <label className="mt-3 block text-xs font-medium text-slate-500">
            API Key {info?.hasKey && <span className="text-emerald-600">（已保存，留空则不修改）</span>}
          </label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder={info?.hasKey ? "••••••••" : "sk-..."}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          />

          {mode === "local" && apiKey.trim() !== "" && (
            <>
              <label className="mt-3 block text-xs font-medium text-slate-500">
                🔒 解锁码（4~6 位，用于加密保存 Key；启动时需输入解锁）
              </label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="例如 582913"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm tracking-[0.4em] outline-none focus:border-indigo-400 focus:bg-white"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Key 将以解锁码加密后存储，明文不落盘；忘记解锁码可清除后重填
              </p>
            </>
          )}
          {mode === "local" && info?.legacyPlainKey && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-700">
              ⚠️ 当前 Key 为旧版明文存储。重新填写 Key 并设置解锁码即可升级为加密保存。
            </p>
          )}

          <label className="mt-3 block text-xs font-medium text-slate-500">模型名称</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="例如 deepseek-chat / glm-4.5-flash"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          />

          <label className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <span>
              <span className="block text-sm font-medium">Mock 演示模式</span>
              <span className="block text-xs text-slate-400">开启后不调用真实 AI，用于体验流程</span>
            </span>
            <button
              onClick={() => setUseMock((v) => !v)}
              aria-label="切换 Mock 模式"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                useMock ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  useMock ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={onTest}
              disabled={testing}
              className="rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 active:bg-slate-100 disabled:opacity-50"
            >
              {testing ? "测试中…" : "测试连接"}
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存设置"}
            </button>
          </div>

          {testResult && (
            <p className="mt-3 break-all rounded-xl bg-slate-50 p-3 text-xs leading-relaxed">
              {testResult}
            </p>
          )}
        </div>

        {mode === "local" && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold">数据备份</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              本地模式的数据只保存在此设备的浏览器中，清除浏览器数据会导致丢失；换手机或重装浏览器前请先导出备份（备份文件不含 API Key）。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={onExport}
                className="rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 active:bg-slate-100"
              >
                📤 导出备份
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 active:bg-slate-100"
              >
                📥 导入备份
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImportFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        )}

        {mode === "local" && info?.hasKey && (
          <button
            onClick={onClearKey}
            className="w-full rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-4 text-left shadow-sm active:bg-rose-100"
          >
            <span className="block text-sm font-bold text-rose-700">🗑 彻底清除 API Key</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-rose-500">
              立即删除本机保存的 Key（学习数据不受影响）。建议学习结束、更换设备或使用公共网络后及时清除。
            </span>
          </button>
        )}

        <div className="rounded-2xl bg-white p-4 text-xs leading-relaxed text-slate-500 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-slate-700">说明</h2>
          {mode === "server" ? (
            <p>
              · Key 仅保存在本机服务端 data/settings.json，不会下发到页面
              <br />
              · 学习计划数据保存在本机 data/projects/ 目录
              <br />· 手机访问时请与电脑连接同一 Wi-Fi，使用启动服务时打印的局域网地址
            </p>
          ) : (
            <p>
              · API Key 加密保存在本机浏览器（解锁码保护），请勿在公共设备上保存
              <br />
              · <b>建议用完即清</b>：学习结束或更换环境时，点上方「彻底清除 API Key」
              <br />· 浏览器直连需选择支持跨域的 AI 服务（DeepSeek / Kimi / OpenAI 可直连，智谱 GLM 不行）
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
