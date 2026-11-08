// 检测学术文献 API 的浏览器跨域支持
const checks = [
  { name: "OpenAlex", url: "https://api.openalex.org/works?search=test&per-page=1" },
  { name: "Crossref", url: "https://api.crossref.org/works?query=test&rows=1" },
  { name: "EuropePMC", url: "https://www.ebi.ac.uk/europepmc/ws/rest/SEARCH?query=test&format=json&pageSize=1" },
];

for (const c of checks) {
  try {
    const res = await fetch(c.url, {
      headers: { Origin: "http://localhost:4173" },
      signal: AbortSignal.timeout(25000),
    });
    const aco = res.headers.get("access-control-allow-origin");
    console.log(`${c.name}: status=${res.status} allow-origin=${aco || "无"}`);
  } catch (e) {
    console.log(`${c.name}: 请求失败 ${e.message}`);
  }
}
