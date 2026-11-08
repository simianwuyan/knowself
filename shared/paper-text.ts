// arXiv 论文全文自动抓取（前后端共用）
// arXiv 官方 HTML 版（arxiv.org/html/{id}）带 CORS 头，浏览器可直连；
// 抓取后转为纯文本供 AI 整理重要流程与摘录原文片段。

const MAX_CHARS = 30000;

/** 从任意输入（ID/DOI/链接）中提取 arXiv ID */
export function extractArxivId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  if (m) return m[1];
  const doi = s.match(/10\.48550\/arxiv\.(\d{4}\.\d{4,5})/i);
  if (doi) return doi[1];
  return null;
}

/** HTML → 纯文本：浏览器用 DOMParser，Node 用正则剥离 */
function htmlToText(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc
      .querySelectorAll(
        "script,style,nav,footer,header,.ltx_page_header,.ltx_page_footer,.ltx_bibliography,.ltx_role_footnote"
      )
      .forEach((e) => e.remove());
    const main = doc.querySelector(".ltx_page_main") || doc.body || doc.documentElement;
    return (main.textContent || "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  }
  // Node 端正则兜底
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z]+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * 抓取 arXiv 论文 HTML 全文并转为纯文本。
 * 部分老论文没有 HTML 版（404）→ 返回 null，由调用方降级为仅摘要。
 */
export async function fetchArxivFullText(arxivId: string): Promise<string | null> {
  const url = `https://arxiv.org/html/${arxivId}`;
  let html: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }
  if (!html || html.length < 2000) return null;
  const text = htmlToText(html);
  if (text.length < 1500) return null;
  return text.slice(0, MAX_CHARS);
}
