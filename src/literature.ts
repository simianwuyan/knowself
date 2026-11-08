// 文献检索：OpenAlex 为主 + Crossref 兜底（浏览器可直连，免费无 Key）
import type { PaperMeta } from "../shared/types";
import { searchWorks, fetchWithRetry, OPENALEX_MAILTO } from "../shared/lit-search";

export interface PaperHit {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  citations?: number;
  landingUrl?: string; // DOI 或出版方页面
  pdfUrl?: string; // 开放获取 PDF 直链
}

/** 文献检索：OpenAlex 限流/失败时自动降级 Crossref */
export function searchPapers(query: string, limit = 10): Promise<PaperHit[]> {
  return searchWorks(query, limit);
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
        `https://api.openalex.org/works?filter=ids.openalex:${refIds.join("|")}&per-page=50&select=id,display_name,publication_year&mailto=${OPENALEX_MAILTO}`
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
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetchWithRetry(`${url}${sep}mailto=${OPENALEX_MAILTO}`).catch((e) => {
    if ((e as { status?: number }).status === 404) return undefined;
    throw e;
  });
  return res as OaWork | undefined;
}

async function searchByTitle(title: string): Promise<OaWork | undefined> {
  const params = new URLSearchParams({
    filter: `title.search:${title.slice(0, 200)}`,
    "per-page": "5",
    select: WORK_SELECT,
    mailto: OPENALEX_MAILTO,
  });
  const data = await fetchWithRetry(`https://api.openalex.org/works?${params.toString()}`);
  return data?.results?.[0] as OaWork | undefined;
}
