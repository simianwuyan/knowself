// 检测各 AI 提供商是否允许浏览器跨域直连（CORS preflight）
const endpoints = {
  DeepSeek: "https://api.deepseek.com/v1/chat/completions",
  "智谱GLM": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  OpenAI: "https://api.openai.com/v1/chat/completions",
  Kimi: "https://api.moonshot.cn/v1/chat/completions",
};

for (const [name, url] of Object.entries(endpoints)) {
  try {
    const res = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
      signal: AbortSignal.timeout(15000),
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    const allowHeaders = res.headers.get("access-control-allow-headers");
    console.log(
      `${name}: status=${res.status} allow-origin=${allowOrigin || "无"} allow-headers=${allowHeaders ? "有" : "无"}`
    );
  } catch (e) {
    console.log(`${name}: 请求失败 ${e.message}`);
  }
}
