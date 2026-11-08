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
      userMsg = parsed?.messages?.map((m) => m.content).join("\n") || "";
    } catch {
      /* ignore */
    }
    let content;
    if (/科研方向/.test(userMsg) && /学习目标|已有背景|（未提供/.test(userMsg)) {
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
