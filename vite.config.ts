import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 生产构建注入 CSP：禁止外部脚本注入，收窄 XSS 偷 Key 的攻击面
// （dev 模式不注入，避免影响 Vite 的内联 HMR 脚本）
const cspPlugin: Plugin = {
  name: "inject-csp",
  apply: "build",
  transformIndexHtml(html) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
      "manifest-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
    ].join("; ");
    return html.replace("</title>", `</title>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
  },
};

// base 用相对路径：同时兼容根路径（本机服务器）与子路径（GitHub Pages）托管
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), cspPlugin],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  // preview 默认继承 server.proxy，这里清空以便纯静态预览（触发本地模式）
  preview: {
    proxy: {},
  },
});
