// 测试 arXiv 全文获取备选路径
async function test(label, url) {
  try {
    const res = await fetch(url, {
      headers: { Origin: "http://localhost:4173" },
      signal: AbortSignal.timeout(60000),
    });
    const aco = res.headers.get("access-control-allow-origin");
    const text = await res.text();
    console.log(`${label}: status=${res.status} aco=${aco || "无"} len=${text.length}`);
    if (res.status === 200) {
      console.log(`  has-formula/method: ${/algorithm|training|experiment|\\frac|begin{equation}/i.test(text)}`);
      console.log(`  head: ${text.slice(0, 120).replace(/\n/g, " ")}`);
    }
  } catch (e) {
    console.log(`${label}: FAIL ${e.message}`);
  }
}

await test("ar5iv 直接", "https://ar5iv.labs.arxiv.org/html/2006.11239");
await test("arxiv html 直接", "https://arxiv.org/html/2006.11239");
await test("allorigins→ar5iv", "https://api.allorigins.win/raw?url=https%3A%2F%2Far5iv.labs.arxiv.org%2Fhtml%2F2006.11239");
