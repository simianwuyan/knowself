import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { detectBackend } from "./api";
import "./styles.css";

async function bootstrap() {
  // 先探测运行环境（服务器模式 / 本地模式），再渲染
  await detectBackend();
  const root = ReactDOM.createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  // 生产环境注册 Service Worker（PWA 离线可用；开发模式不注册避免干扰）
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* 注册失败不影响使用 */
    });
  }
}

void bootstrap();
