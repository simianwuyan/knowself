// 学术文献检索（前后端共用）：OpenAlex 为主，Crossref 兜底降级
// - OpenAlex 带 mailto 进入 polite pool；429 时退避重试一次
// - OpenAlex 不可用时自动降级 Crossref（同样 CORS 开放、免 Key）

export interface WorkHit {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  citations?: number;
  landingUrl?: string;
  pdfUrl?: string;
}

const OA_MAILTO = "knowself.app.user@gmail.com"; // OpenAlex polite pool 标识

async function fetchJson(url: string, timeoutMs = 20000): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429) {
    const err = new Error("RATE_LIMITED") as Error & { status: number };
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** 带限流退避重试的 JSON 请求（供论文题录查询复用） */
export async function fetchWithRetry(url: string): Promise<any> {
  try {
    return await fetchJson(url);
  } catch (err) {
    if (err && (err as { status?: number }).status === 429) {
      // 限流：退避 2.5 秒后重试一次
      await new Promise((r) => setTimeout(r, 2500));
      return await fetchJson(url);
    }
    throw err;
  }
}

export const OPENALEX_MAILTO = OA_MAILTO;

interface OaWork {
  display_name?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  publication_year?: number;
  primary_location?: { source?: { display_name?: string | null } | null };
  cited_by_count?: number;
  doi?: string | null;
  open_access?: { oa_url?: string | null };
  best_oa_location?: { pdf_url?: string | null } | null;
}

function mapOpenAlex(r: OaWork): WorkHit | null {
  if (!r.display_name) return null;
  return {
    title: r.display_name,
    authors: (r.authorships || [])
      .map((a) => a.author?.display_name || "")
      .filter(Boolean)
      .slice(0, 3),
    year: r.publication_year,
    venue: r.primary_location?.source?.display_name || undefined,
    citations: r.cited_by_count,
    landingUrl: r.doi || undefined,
    pdfUrl: r.best_oa_location?.pdf_url || r.open_access?.oa_url || undefined,
  };
}

async function searchOpenAlex(query: string, limit: number): Promise<WorkHit[]> {
  const params = new URLSearchParams({
    search: query,
    "per-page": String(Math.min(25, limit)),
    select:
      "display_name,authorships,publication_year,primary_location,cited_by_count,doi,open_access,best_oa_location",
    mailto: OA_MAILTO,
  });
  const data = await fetchWithRetry(`https://api.openalex.org/works?${params.toString()}`);
  return ((data?.results || []) as OaWork[]).map(mapOpenAlex).filter(Boolean) as WorkHit[];
}

interface CrWork {
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  "is-referenced-by-count"?: number;
  DOI?: string;
  link?: Array<{ "content-type"?: string; URL?: string }>;
}

function mapCrossref(r: CrWork): WorkHit | null {
  if (!r.title?.[0]) return null;
  const pdf = (r.link || []).find((l) => l["content-type"] === "application/pdf")?.URL;
  return {
    title: r.title[0],
    authors: (r.author || [])
      .map((a) => [a.given, a.family].filter(Boolean).join(" "))
      .filter(Boolean)
      .slice(0, 3),
    year: r.issued?.["date-parts"]?.[0]?.[0],
    venue: r["container-title"]?.[0] || undefined,
    citations: r["is-referenced-by-count"],
    landingUrl: r.DOI ? `https://doi.org/${r.DOI}` : undefined,
    pdfUrl: pdf || undefined,
  };
}

async function searchCrossref(query: string, limit: number): Promise<WorkHit[]> {
  const params = new URLSearchParams({
    query: query,
    rows: String(Math.min(20, limit)),
    select: "title,author,issued,container-title,is-referenced-by-count,DOI,link",
  });
  const data = await fetchWithRetry(`https://api.crossref.org/works?${params.toString()}`);
  return ((data?.message?.items || []) as CrWork[]).map(mapCrossref).filter(Boolean) as WorkHit[];
}

/**
 * 检索学术论文：OpenAlex → 失败/限流时降级 Crossref
 */
export async function searchWorks(query: string, limit = 10): Promise<WorkHit[]> {
  const q = query.trim();
  if (!q) return [];
  let lastErr: unknown = null;
  try {
    const hits = await searchOpenAlex(q, limit);
    if (hits.length) return hits;
  } catch (e) {
    lastErr = e;
  }
  try {
    const hits = await searchCrossref(q, limit);
    if (hits.length) return hits;
  } catch (e) {
    lastErr = e;
  }
  if (lastErr) {
    const status = (lastErr as { status?: number }).status;
    throw new Error(
      status === 429
        ? "文献服务暂时限流，请稍后再试（已尝试两个数据源）"
        : `文献检索失败（${(lastErr as Error).message}）`
    );
  }
  return [];
}
