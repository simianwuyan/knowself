// 服务器模式：论文精读计划冒烟（创建带 paper 的项目 → generate 走论文 prompt → excerpt 存在）
const base = "http://localhost:3000/api";

async function j(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(`${method} ${url} -> ${res.status} ${data.error || ""}`);
  return data.data;
}

// 1. 创建论文精读计划
let p = await j("POST", "/projects", {
  direction: "Denoising Diffusion Probabilistic Models",
  background: "",
  goal: "",
  paper: {
    title: "Denoising Diffusion Probabilistic Models",
    authors: ["Jonathan Ho"],
    year: 2020,
    abstract: "We present high quality images generated using denoising diffusion probabilistic models.",
    extraText: "The training objective can be simplified to a weighted variational bound.",
    refs: [
      { title: "Smoke Ref One", year: 2015 },
      { title: "Smoke Ref Two", year: 2017 },
    ],
    source: "openalex",
  },
});
console.log("✓ 论文计划已创建, paper.title =", p.paper?.title?.slice(0, 30));

// 2. 生成（Mock 模式 → mockPaperPlan）
p = await j("POST", `/projects/${p.id}/generate`);
const excerptNodes = p.nodes.filter((n) => n.excerpt);
const paperNodes = p.nodes.filter((n) => n.kind === "paper");
console.log(
  "✓ generate:",
  JSON.stringify({
    nodes: p.nodes.length,
    excerptNodes: excerptNodes.length,
    paperNodes: paperNodes.length,
    hasRefNodes: p.nodes.some((n) => n.name.includes("Smoke Ref")),
    paperAnchor: p.nodes.some((n) => n.name.includes("Denoising")),
  })
);
if (!excerptNodes.length) throw new Error("excerpt 节点缺失");
if (!paperNodes.length) throw new Error("论文锚点节点缺失");

// 3. 清理
await j("DELETE", `/projects/${p.id}`);
console.log("\n服务器模式论文计划冒烟通过 ✅");
