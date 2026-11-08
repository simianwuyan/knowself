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
    if (/学习卡/.test(userMsg)) {
      // 知识点学习卡：概括 + 自测题
      const name = (userMsg.match(/知识节点：(.+?)（/) || [])[1] || "该知识点";
      content = JSON.stringify({
        summary: `（Mock 演示）${name} 是知识链条中的关键一环：先建立核心直觉，再记忆精确定义，最后动手推一个小例子验证理解。在论文语境中，它出现在方法部分的关键推导处——读论文遇到它时应能立刻对应到这里学的内容。常见误区是只记结论不记适用条件，套用前要逐条核对前提。`,
        questions: [
          { q: `用一句话概括：${name} 解决的核心问题是什么？`, a: "（Mock 参考答案）点出问题场景与改进点两个要素。" },
          { q: `${name} 的关键假设或适用条件有哪些？`, a: "（Mock 参考答案）至少说出 2 条前提，并解释假设不成立的后果。" },
          { q: `它在论文方法流程中的位置与上下游是什么？`, a: "（Mock 参考答案）指出上游输入、下游输出、对应论文的哪一节。" },
        ],
      });
    } else if (/以读懂这篇论文为中心/.test(userMsg)) {
      // 论文精读计划
      const title = (userMsg.match(/论文标题：(.+)/) || [])[1]?.trim() || "Mock 论文";
      const ref1 = (userMsg.match(/^1\. (.+)$/m) || [])[1] || "Mock 引文A：领域奠基工作";
      const ref2 = (userMsg.match(/^2\. (.+)$/m) || [])[1] || "Mock 引文B：方法前置论文";
      const abs = (userMsg.match(/摘要：(.+)/) || [])[1]?.trim() || "";
      const excerpt = abs.slice(0, 100) || "（Mock）摘要示意句子，用于演示原文对应功能。";
      content = JSON.stringify({
        title: title.slice(0, 10),
        summary: `（Mock 提取）以《${title}》为中心的论文精读路线演示，连接真实 AI 后将逐节拆解并摘录原文片段。`,
        nodes: [
          { name: "论文背景与动机", description: "论文要解决什么问题（Mock）", kind: "concept", importance: "core", prereqs: [], estHours: 1, resources: [], excerpt },
          { name: "方法总体框架", description: "方法模块划分与数据流（Mock）", kind: "model", importance: "core", prereqs: ["论文背景与动机"], estHours: 2, resources: [], excerpt },
          { name: "关键公式推导", description: "最重要公式及推导主线（Mock）", kind: "formula", importance: "core", prereqs: ["方法总体框架"], estHours: 1.5, resources: [], excerpt },
          { name: "实验设计与指标", description: "实验如何验证主张（Mock）", kind: "concept", importance: "recommended", prereqs: ["关键公式推导"], estHours: 1, resources: [], excerpt },
          { name: ref1, description: "（Mock）论文方法的直接基础", kind: "paper", importance: "recommended", prereqs: [], estHours: 3, resources: [], excerpt: "" },
          { name: ref2, description: "（Mock）前置论文与 baseline", kind: "paper", importance: "recommended", prereqs: [], estHours: 3, resources: [], excerpt: "" },
          { name: title, description: "（Mock）论文本身：整篇精读，重点对照实验部分", kind: "paper", importance: "core", prereqs: ["论文背景与动机", "方法总体框架", "关键公式推导", ref1, ref2], estHours: 4, resources: [], excerpt: "" },
        ],
      });
    } else if (/参考文献题录/.test(userMsg)) {
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
      // 知识点对比：text + 对比自测题
      content = JSON.stringify({
        text: `【共同点】（Mock 演示）所选知识点同属一条知识链条，服务于同一类研究问题。

【关键差异】
前者侧重建立概念与直觉；后者引入可操作的模型/公式，直接对应论文方法部分。

【联系与依赖】后者建立在前者之上，学习顺序应先概念后公式。

【常见混淆点】两者适用条件不同，套用前需逐条核对前提。

【怎么选/怎么学】先掌握概念再攻推导，最后互相推导一遍检验理解。

（Mock 演示数据，连接真实 AI 后将生成真实对比）`,
        questions: [
          { q: "不看上文：说出两者的核心差异（至少 2 条）", a: "（Mock 参考答案）① 定位：概念直觉 vs 可操作模型；② 层次：后者建立在前者之上。" },
          { q: "两者的学习顺序应如何安排？为什么？", a: "（Mock 参考答案）先概念后公式：公式的推导依赖概念基础。" },
        ],
      });
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
