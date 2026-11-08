// 文献检索：OpenAlex 学术数据库（浏览器可直连，免费无 Key，收录 arXiv/PubMed 等 2.5 亿+ 论文）
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
