// API 冒烟测试脚本（node scripts/smoke.mjs）
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

const pid = process.argv[2];
if (!pid) {
  console.error("用法: node scripts/smoke.mjs <projectId>");
  process.exit(1);
}

let p = await j("GET", `/projects/${pid}`);
console.log("项目:", p.title, "节点数:", p.nodes.length);

for (const n of p.nodes.slice(0, 3)) {
  p = await j("PATCH", `/projects/${pid}/nodes/${n.id}`, { mastery: "mastered" });
}
p = await j("PATCH", `/projects/${pid}/nodes/${p.nodes[3].id}`, { mastery: "partial" });
console.log(
  "已掌握:",
  p.nodes.filter((n) => n.mastery === "mastered").length,
  "部分掌握:",
  p.nodes.filter((n) => n.mastery === "partial").length
);

const expandTarget = p.nodes[5];
const before = p.nodes.length;
p = await j("POST", `/projects/${pid}/nodes/${expandTarget.id}/expand`);
console.log(`expand「${expandTarget.name}」: ${before} -> ${p.nodes.length} 节点`);

p = await j("POST", `/projects/${pid}/nodes/${p.nodes[0].id}/resources`);
console.log("追加资料:", p.nodes[0].resources.map((r) => r.title).join(" | "));

const bad = await fetch(base + "/projects/nope");
console.log("404 测试:", bad.status === 404 ? "PASS" : "FAIL " + bad.status);

const list = await j("GET", "/projects");
console.log("项目列表:", list.map((x) => `${x.title}(进度${x.total ? Math.round((x.mastered / x.total) * 100) : 0}%)`).join(", "));
console.log("\n全部通过 ✅");
