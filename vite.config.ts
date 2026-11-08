import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base 用相对路径：同时兼容根路径（本机服务器）与子路径（GitHub Pages）托管
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
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
