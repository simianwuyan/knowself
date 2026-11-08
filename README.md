# KnowSelf · 科研学习路线规划

**线上版（手机独立使用）**：https://simianwuyan.github.io/knowself/

输入科研方向 → AI 生成该方向所需的知识清单（细粒度：概念/模型/公式/经典论文/工具，含依赖关系、重要程度、推荐资料、预计学时）→ 你逐项标注掌握情况 → 自动过滤已掌握内容，按依赖顺序排出**短周期分阶段学习路线**，并有**知识图谱视图**与**在线文献检索**（OpenAlex，可看原文/下载 PDF/一键收藏）。

- **两种运行模式**（自动检测，同一套代码）：
  - 📱 **本地模式**：纯前端，数据存浏览器、AI 浏览器直连，部署到 GitHub Pages 后手机完全独立使用，不依赖电脑
  - 🖥 **服务器模式**：Express 后端，数据集中存电脑端 JSON 文件，手机/电脑经局域网访问同一份数据
- 支持任意 OpenAI 兼容接口；浏览器直连需服务商允许跨域（实测 **DeepSeek / Kimi / OpenAI 可直连，智谱 GLM 需服务器模式**）
- 未配置 AI 时自动使用 Mock 演示数据，可先体验完整流程

## 手机独立使用（推荐，GitHub Pages）

1. 创建 GitHub PAT（classic，勾选 `repo` 权限）：https://github.com/settings/tokens
2. Token 保存到项目根目录 `.gh-token` 文件（已被 gitignore，不会上传）
3. 构建并部署：

```bash
npm run build
node scripts/deploy-github.mjs knowself   # 仓库名可自定，不存在会自动创建
```

4. 等 1~2 分钟，手机浏览器打开 `https://<你的用户名>.github.io/knowself/`，
   「添加到主屏幕」即可像 App 一样使用（PWA，离线可打开界面）

线上是公开网址，但应用不含任何密钥；你的 API Key 和学习数据都只存在你自己手机的浏览器里。
换手机/清除浏览器数据前，用「设置 → 数据备份」导出 JSON，再在新设备导入。

## 本机服务器模式

要求：Node.js ≥ 18（本机已装便携版 `D:\WADINE\tools\node-v26.13.0-win-x64`，已加入用户 PATH）。

```bash
npm install
npm run build
npm start          # 控制台会打印手机访问用的局域网地址
```

- 本机访问 `http://localhost:3000`；手机连同一 Wi-Fi 访问打印的局域网地址
- 数据保存在 `data/`（`projects/*.json`、`settings.json`），Key 不下发到浏览器
- 开发模式：`npm run dev`（前端 http://localhost:5173 热更新，/api 自动代理到 3000）

## 配置 AI

进「设置」页：

1. 点预设（DeepSeek / Kimi / OpenAI / 智谱 GLM）自动填 Base URL 和默认模型
2. 填 API Key → 「测试连接」→ 「保存设置」
3. 本地模式选「可直连」的服务商；智谱 GLM 只能用在服务器模式

## 主要功能

| 功能 | 说明 |
| --- | --- |
| AI 生成知识清单 | 15~30 个知识点，含前置依赖 / 重要程度（核心·进阶·拓展）/ 预计学时 / 推荐资料 |
| 掌握度标注 | 每个知识点三态：已掌握 / 部分掌握 / 未掌握，进度与路线实时联动 |
| 分阶段学习路线 | 拓扑排序 + 按依赖深度分阶段，被依赖项在前；已掌握项自动隐藏，部分掌握标记「建议复习」 |
| AI 细化知识点 | 把大知识点拆成更小的子知识点（子节点自动继承前置关系） |
| AI 推荐资料 | 为任意知识点追加更多教材 / 课程 / 论文 / 教程 |
| 导出 Markdown | 一键导出分阶段学习路线清单（Markdown checkbox 格式） |
| 数据备份（本地模式） | 导出/导入 JSON，跨设备迁移数据 |
| 多项目管理 | 支持多个科研方向分别建计划；重新生成会按名称继承旧的掌握状态 |

## 目录结构

```
shared/         前后端共享代码（类型、AI 提示词、AI 调用客户端、Mock）
src/            前端 React + TS（页面组件、路由规划算法 route.ts、双模式后端抽象 backend/）
server/         Express 后端（API、JSON 存储；AI 逻辑复用 shared/）
public/         PWA manifest、图标、Service Worker
scripts/        冒烟测试 / CORS 检测 / mock AI 服务器 / GitHub 部署脚本
data/           服务器模式运行时数据（gitignore）
```

## 技术说明

- 运行模式检测：启动时请求 `/api/settings`，返回 JSON 则为服务器模式，否则为本地模式（`src/api.ts`）
- 学习路线算法：`src/route.ts` — prereq 名称归一化匹配 → Kahn 拓扑排序（遇环自动从低重要度节点断边）→ 按最长路径深度分阶段
- AI 调用：`shared/ai-client.ts` — OpenAI 兼容 `/chat/completions`，优先 `json_object` 输出，解析失败自动带错误重试一次，120 秒超时；server 与浏览器共用同一实现
- PWA：`public/sw.js` — 导航 network-first、构建产物 cache-first，离线可打开应用界面

## 常见问题

- **本地模式 AI 报「网络请求失败/CORS」**：所选服务商不允许浏览器跨域（如智谱 GLM），改用 DeepSeek / Kimi，或改用服务器模式。
- **手机打不开（服务器模式）**：确认同一局域网、防火墙允许 3000 端口入站。
- **端口被占用**：`set PORT=3001 && npm start`。
- **GitHub Pages 404**：部署后等 1~2 分钟；确认 Pages 来源是 gh-pages 分支（仓库 Settings → Pages）。
