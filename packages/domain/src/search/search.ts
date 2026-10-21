import { DEFAULT_WEIGHTS, compareHits, evaluate, type ExcludeReason, type Weights } from './ranking';
import type { Candidate, SearchHit, SearchQuery, SellerInfo } from './types';

export const MAX_PAGE_SIZE = 24;
export const DEFAULT_PAGE_SIZE = 12;

export interface SearchOutcome {
  total: number;
  exactCount: number;
  alternativeCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  hits: SearchHit[];
  /** Aggregate counts of why candidates were excluded (no product details) — powers honest empty states. */
  excluded: Partial<Record<ExcludeReason, number>>;
  nearMisses: SearchHit[];
}

/**
 * Pure, category-agnostic search: eligibility → scoring → ordering → pagination.
 * `candidates` come from the trusted backend; nothing here touches a database.
 */
export function runSearch(
  candidates: Candidate[],
  sellers: Map<string, SellerInfo>,
  q: SearchQuery,
  opt: { nowMs: number; page?: number; pageSize?: number; weights?: Weights },
): SearchOutcome {
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(opt.pageSize ?? DEFAULT_PAGE_SIZE)));
  const page = Math.max(1, Math.floor(opt.page ?? 1));
  const weights = opt.weights ?? DEFAULT_WEIGHTS;

  const hits: SearchHit[] = [];
  const excluded: SearchOutcome['excluded'] = {};
  for (const c of candidates) {
    const r = evaluate(c, c.sellerId ? sellers.get(c.sellerId) : undefined, q, { nowMs: opt.nowMs, weights });
    if (r.eligible) hits.push(r.hit); else excluded[r.why] = (excluded[r.why] ?? 0) + 1;
  }
  hits.sort(compareHits);

  let nearMisses: SearchHit[] = [];
  if (!hits.length) {
    for (const c of candidates) {
      const r = evaluate(c, c.sellerId ? sellers.get(c.sellerId) : undefined, q, { nowMs: opt.nowMs, weights, relaxed: true });
      if (r.eligible) nearMisses.push({ ...r.hit, tier: 'near_miss' });
    }
    nearMisses.sort(compareHits);
    nearMisses = nearMisses.slice(0, 5);
  }

  const start = (page - 1) * pageSize;
  return {
    total: hits.length,
    exactCount: hits.filter((h) => h.tier === 'exact').length,
    alternativeCount: hits.filter((h) => h.tier === 'alternative').length,
    page, pageSize,
    hasMore: start + pageSize < hits.length,
    hits: hits.slice(start, start + pageSize),
    excluded,
    nearMisses,
  };
}
