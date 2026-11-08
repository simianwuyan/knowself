// 服务器模式新端点冒烟测试：analyze-paper / compare / comparisons
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

// 1. 建一个测试项目
let p = await j("POST", "/projects", { direction: "冒烟测试论文导入", background: "", goal: "" });
const pid = p.id;
console.log("✓ 项目已创建", pid);

// 2. 论文分析（服务器当前为 Mock 模式 → mockAnalyzePaper）
p = await j("POST", `/projects/${pid}/analyze-paper`, {
  meta: {
    title: "Denoising Diffusion Probabilistic Models",
    authors: ["Jonathan Ho"],
    year: 2020,
    refs: [
      { title: "Smoke Ref One", year: 2015 },
      { title: "Smoke Ref Two", year: 2017 },
    ],
    source: "openalex",
  },
});
console.log("✓ analyze-paper:", JSON.stringify({ added: p.addedCount, skipped: p.skipped.length, total: p.project.nodes.length }));
if (p.addedCount < 4) throw new Error("论文分析添加节点过少");
const paperNode = p.project.nodes.find((n) => n.name.includes("Denoising"));
if (!paperNode || !paperNode.refs || paperNode.refs.length !== 2) throw new Error("论文节点 refs 缺失");

// 3. 对比（取前两个节点）
const two = p.project.nodes.slice(0, 2).map((n) => n.id);
const cmp = await j("POST", `/projects/${pid}/compare`, { nodeIds: two });
console.log("✓ compare: text 长度", cmp.text.length, "含【共同点】:", cmp.text.includes("【共同点】"));

// 4. 保存 + 删除对比记录
p = await j("POST", `/projects/${pid}/comparisons`, { nodeNames: ["A", "B"], text: "测试对比" });
const cid = p.comparisons[0].id;
console.log("✓ comparisons 保存:", p.comparisons.length);
p = await j("DELETE", `/projects/${pid}/comparisons/${cid}`);
console.log("✓ comparisons 删除后:", (p.comparisons || []).length);

// 5. 老功能回归：生成清单
p = await j("POST", `/projects/${pid}/generate`);
console.log("✓ generate 回归: 节点数", p.nodes.length);

// 6. 清理
await j("DELETE", `/projects/${pid}`);
console.log("\n服务器模式冒烟测试全部通过 ✅");
