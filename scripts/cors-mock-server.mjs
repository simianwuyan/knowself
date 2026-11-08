// 本地验证用：模拟一个支持浏览器跨域直连的 OpenAI 兼容 AI 服务
// 用法：node scripts/cors-mock-server.mjs  [端口默认3010]
import http from "node:http";

const PORT = Number(process.argv[2]) || 3010;

function treeJson(direction) {
  return {
    title: (direction || "测试方向").slice(0, 10),
    summary: "CORS 端到端测试生成的知识清单（细粒度）。",
    nodes: [
      { name: "基础概念A", description: "基础概念A", kind: "concept", importance: "core", prereqs: [], estHours: 1, resources: [{ title: "资料A1", type: "book", note: "测试" }] },
      { name: "基础概念B", description: "基础概念B", kind: "concept", importance: "core", prereqs: [], estHours: 1, resources: [] },
      { name: "关键公式C", description: "公式C", kind: "formula", importance: "recommended", prereqs: ["基础概念A"], estHours: 0.5, resources: [] },
      { name: "模型D", description: "模型D", kind: "model", importance: "recommended", prereqs: ["基础概念B"], estHours: 2, resources: [] },
      { name: "论文：测试经典论文E", description: "论文E的贡献", kind: "paper", importance: "core", prereqs: ["关键公式C", "模型D"], estHours: 3, resources: [] },
      { name: "复现实践F", description: "依赖论文E", kind: "tool", importance: "core", prereqs: ["论文：测试经典论文E"], estHours: 2, resources: [] },
    ],
  };
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let userMsg = "";
    try {
      const parsed = JSON.parse(body);
      // 只取最后一条 user 消息：避免系统提示词中的编号行被误匹配
      const msgs = parsed?.messages || [];
      userMsg = [...msgs].reverse().find((m) => m.role === "user")?.content || "";
    } catch {
      /* ignore */
    }
    let content;
    if (/参考文献题录/.test(userMsg)) {
      // 论文分析
      const title = (userMsg.match(/论文标题：(.+)/) || [])[1]?.trim() || "Mock 论文";
      const ref1 = (userMsg.match(/^1\. (.+)$/m) || [])[1] || "Mock 引文A：领域奠基工作";
      const ref2 = (userMsg.match(/^2\. (.+)$/m) || [])[1] || "Mock 引文B：方法前置论文";
      content = JSON.stringify({
        paperNode: {
          name: title,
          description: `（Mock 提取）该论文是方向内关键工作，提出的方法建立在引文之上；读懂它需要先掌握以下概念与公式。`,
          kind: "paper",
          importance: "core",
          prereqs: ["论文核心问题", "方法总体框架", "论文关键公式", ref1],
          estHours: 4,
        },
        nodes: [
          { name: "论文核心问题", description: "论文要解决的问题定义与动机（Mock）", kind: "concept", importance: "core", prereqs: [], estHours: 0.5, resources: [] },
          { name: "方法总体框架", description: "方法的模块划分与数据流（Mock）", kind: "model", importance: "core", prereqs: ["论文核心问题"], estHours: 1.5, resources: [] },
          { name: "论文关键公式", description: "最重要的目标函数及其含义（Mock）", kind: "formula", importance: "core", prereqs: ["方法总体框架"], estHours: 1, resources: [] },
        ],
        keyRefs: [
          { title: ref1, why: "（Mock）论文方法的直接基础" },
          { title: ref2, why: "（Mock）前置论文与 baseline" },
        ],
      });
    } else if (/请对比以下知识点/.test(userMsg)) {
      // 知识点对比：返回纯文本（compareNodesAI 直接使用消息正文）
      content = `【共同点】（Mock 演示）所选知识点同属一条知识链条，服务于同一类研究问题。

【关键差异】
前者侧重建立概念与直觉；后者引入可操作的模型/公式，直接对应论文方法部分。

【联系与依赖】后者建立在前者之上，学习顺序应先概念后公式。

【常见混淆点】两者适用条件不同，套用前需逐条核对前提。

【怎么选/怎么学】先掌握概念再攻推导，最后互相推导一遍检验理解。

（Mock 演示数据，连接真实 AI 后将生成真实对比）`;
    } else if (/科研方向/.test(userMsg) && /学习目标|已有背景|（未提供/.test(userMsg)) {
      const dir = (userMsg.match(/科研方向：(.+)/) || [])[1] || "测试方向";
      content = JSON.stringify(treeJson(dir.trim()));
    } else if (/子知识点|细化/.test(userMsg)) {
      content = JSON.stringify({
        children: [
          { name: "子点1", description: "子知识点1", importance: "core", prereqs: [], estHours: 5, resources: [] },
          { name: "子点2", description: "子知识点2", importance: "recommended", prereqs: ["子点1"], estHours: 5, resources: [] },
        ],
      });
    } else if (/资料|推荐/.test(userMsg)) {
      content = JSON.stringify({ resources: [{ title: "直连测试资料", type: "course", note: "CORS mock" }] });
    } else {
      content = "OK";
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ choices: [{ message: { role: "assistant", content } }] })
    );
  });
});

server.listen(PORT, () => console.log(`CORS mock AI server on http://localhost:${PORT}/v1/chat/completions`));
