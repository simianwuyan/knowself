// 文献检索：OpenAlex 学术数据库（浏览器可直连，免费无 Key，收录 arXiv/PubMed 等 2.5 亿+ 论文）
import type { PaperMeta } from "../shared/types";

export interface PaperHit {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  citations?: number;
  landingUrl?: string; // DOI 或出版方页面
  pdfUrl?: string; // 开放获取 PDF 直链
}

const OPENALEX = "https://api.openalex.org/works";

export async function searchPapers(query: string, limit = 10): Promise<PaperHit[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    search: q,
    "per-page": String(Math.min(25, Math.max(1, limit))),
    select: "display_name,authorships,publication_year,primary_location,cited_by_count,doi,open_access,best_oa_location",
  });
  const res = await fetch(`${OPENALEX}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`文献检索失败（${res.status}），请稍后重试`);
  }
  const data = (await res.json()) as {
    results?: Array<{
      display_name?: string;
      authorships?: Array<{ author?: { display_name?: string } }>;
      publication_year?: number;
      primary_location?: { source?: { display_name?: string } | null };
      cited_by_count?: number;
      doi?: string | null;
      open_access?: { oa_url?: string | null };
      best_oa_location?: { pdf_url?: string | null } | null;
    }>;
  };
  return (data.results || [])
    .filter((r) => r.display_name)
    .map((r) => ({
      title: r.display_name as string,
      authors: (r.authorships || [])
        .map((a) => a.author?.display_name || "")
        .filter(Boolean)
        .slice(0, 3),
      year: r.publication_year,
      venue: r.primary_location?.source?.display_name || undefined,
      citations: r.cited_by_count,
      landingUrl: r.doi || undefined,
      pdfUrl: r.best_oa_location?.pdf_url || r.open_access?.oa_url || undefined,
    }));
}

// ---------- 论文元数据获取（用于「从论文提取知识点」） ----------

export type PaperLookup =
  | { kind: "doi"; doi: string }
  | { kind: "arxiv"; id: string }
  | { kind: "title"; title: string };

/** 识别输入：DOI / arXiv ID / 论文标题；返回 null 表示按粘贴文本处理 */
export function detectPaperLookup(raw: string): PaperLookup | null {
  const s = raw.trim();
  if (!s) return null;
  // 长文本 → 视为粘贴的摘要/正文
  if (s.length > 260) return null;
  const doi = s.match(/10\.\d{4,9}\/[^\s"'<>，。；]+/i);
  if (doi) return { kind: "doi", doi: doi[0].replace(/[.,;)]+$/, "") };
  const arx = s.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  if (arx) return { kind: "arxiv", id: arx[1] };
  if (s.length >= 6) return { kind: "title", title: s };
  return null;
}

interface OaWork {
  display_name?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  publication_year?: number;
  primary_location?: { source?: { display_name?: string | null } | null };
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]> | null;
  referenced_works?: string[] | null;
}

function rebuildAbstract(inv: Record<string, number[]> | null | undefined): string | undefined {
  if (!inv) return undefined;
  const words: string[] = [];
  for (const [w, positions] of Object.entries(inv)) {
    for (const p of positions) words[p] = w;
  }
  const text = words.filter(Boolean).join(" ");
  return text || undefined;
}

const WORK_SELECT =
  "display_name,authorships,publication_year,primary_location,cited_by_count,abstract_inverted_index,referenced_works";

/** 按 DOI / arXiv ID / 标题从 OpenAlex 取论文元数据（含参考文献题录） */
export async function fetchPaperMeta(lookup: PaperLookup): Promise<PaperMeta> {
  let work: OaWork | undefined;
  if (lookup.kind === "doi") {
    work = await getWork(`https://api.openalex.org/works/doi:${lookup.doi}`);
  } else if (lookup.kind === "arxiv") {
    work = await getWork(
      `https://api.openalex.org/works/doi:10.48550/arxiv.${lookup.id.toLowerCase()}`
    );
  } else {
    work = await searchByTitle(lookup.title);
  }
  if (!work || !work.display_name) {
    throw new Error("OpenAlex 未找到该论文：可改用 DOI / arXiv ID / 准确标题，或直接粘贴摘要文本");
  }
  const meta: PaperMeta = {
    title: work.display_name,
    authors: (work.authorships || [])
      .map((a) => a.author?.display_name || "")
      .filter(Boolean)
      .slice(0, 5),
    year: work.publication_year,
    venue: work.primary_location?.source?.display_name || undefined,
    citations: work.cited_by_count,
    abstract: rebuildAbstract(work.abstract_inverted_index),
    refs: [],
    source: "openalex",
  };
  // 参考文献题录：referenced_works 是 OpenAlex ID 列表，批量解析标题
  const refIds = (work.referenced_works || [])
    .map((u) => u.split("/").pop() || "")
    .filter(Boolean)
    .slice(0, 30);
  if (refIds.length) {
    try {
      const res = await fetch(
        `https://api.openalex.org/works?filter=ids.openalex:${refIds.join("|")}&per-page=50&select=id,display_name,publication_year`
      );
      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{ display_name?: string; publication_year?: number }>;
        };
        meta.refs = (data.results || [])
          .filter((r) => r.display_name)
          .map((r) => ({ title: r.display_name as string, year: r.publication_year }));
      }
    } catch {
      // 引文解析失败不影响主流程，refs 留空
    }
  }
  return meta;
}

async function getWork(url: string): Promise<OaWork | undefined> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`OpenAlex 请求失败（${res.status}）`);
  return (await res.json()) as OaWork;
}

async function searchByTitle(title: string): Promise<OaWork | undefined> {
  const params = new URLSearchParams({
    filter: `title.search:${title.slice(0, 200)}`,
    "per-page": "5",
    select: WORK_SELECT,
  });
  const res = await fetch(`https://api.openalex.org/works?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`OpenAlex 请求失败（${res.status}）`);
  const data = (await res.json()) as { results?: OaWork[] };
  return data.results?.[0];
}
