import type { Firestore } from 'firebase-admin/firestore';
import {
  MAX_PAGE_SIZE, MAX_QUERY_CHARS, ValidationError, QueryValidationError, categoryByKey, clarificationFor, parseQueryRules,
  reconcile, runSearch, validateSearchQuery, availabilityOf,
  type Candidate, type SearchOutcome, type SearchQuery, type SellerInfo,
} from '../../packages/domain/src';
import type { AiParser } from './ai-parser';
import { consume, type Limits } from './limits';

export class SearchError extends Error {
  constructor(public status: number, public code: 'disabled' | 'rate_limited' | 'category_disabled' | 'unavailable', message: string) { super(message); }
}

export interface SearchDeps {
  db: Firestore;
  ai: AiParser | null;
  limits: Limits;
  enabled: boolean;
  enabledCategories: string[];
  nowMs: number;
  callerKey: string;
  uid: string | null;
  cache?: boolean;
  candidateCap?: number;
}

export interface SearchRequest { q: string; page: number; pageSize: number; filters: Partial<Pick<SearchQuery, 'budgetMin' | 'budgetMax' | 'condition'>> }

export function parseSearchRequest(raw: unknown): SearchRequest {
  if (typeof raw !== 'object' || raw === null) throw new ValidationError('Invalid request');
  const r = raw as Record<string, unknown>;
  if (typeof r.q !== 'string') throw new ValidationError('q is required');
  const q = r.q.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (q.length < 2) throw new ValidationError('Query is too short');
  if (q.length > MAX_QUERY_CHARS) throw new ValidationError(`Query must be at most ${MAX_QUERY_CHARS} characters`);
  const int = (v: unknown, d: number, lo: number, hi: number) => (v === undefined ? d : typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : (() => { throw new ValidationError('Invalid paging'); })());
  // Filters from the UI go through the same strict validator as AI output.
  const f = (r.filters ?? {}) as Record<string, unknown>;
  const checked = validateSearchQuery({ budgetMin: f.budgetMin ?? null, budgetMax: f.budgetMax ?? null, condition: f.condition ?? null });
  return { q, page: int(r.page, 1, 1, 500), pageSize: int(r.pageSize, 12, 1, MAX_PAGE_SIZE), filters: { budgetMin: checked.budgetMin, budgetMax: checked.budgetMax, condition: checked.condition } };
}

const cache = new Map<string, { at: number; docs: Candidate[] }>();
export const clearSearchCache = () => cache.clear();
const CACHE_MS = 60_000;

const ms = (t: unknown): number | undefined => (t && typeof (t as { toMillis?: () => number }).toMillis === 'function' ? (t as { toMillis: () => number }).toMillis() : undefined);

export function toCandidate(id: string, d: Record<string, unknown>): Candidate {
  const updated = ms(d.updatedAt) ?? ms(d.createdAt);
  return {
    id, name: d.name as string, category: d.category as string, categoryKey: d.categoryKey as string | undefined, brand: d.brand as string | undefined,
    model: d.model as string | undefined, aliases: Array.isArray(d.aliases) ? (d.aliases as string[]).slice(0, 10) : undefined, condition: d.condition as string | undefined,
    description: typeof d.description === 'string' ? d.description.slice(0, 600) : undefined, price: d.price as number, originalPrice: d.originalPrice as number | null,
    stock: d.stock as number, status: d.status as string, sellerId: d.sellerId as string, sellerName: d.sellerName as string, imageUrl: d.imageUrl as string,
    emoji: d.emoji as string, deliveryCharge: d.deliveryCharge as number, updatedAtMs: updated,
  };
}

async function loadCandidates(deps: SearchDeps, categoryKey: string): Promise<Candidate[]> {
  const hit = deps.cache !== false && cache.get(categoryKey);
  if (hit && deps.nowMs - hit.at < CACHE_MS) return hit.docs;
  const def = categoryByKey(categoryKey)!;
  const cap = deps.candidateCap ?? 200;
  const col = deps.db.collection('products');
  // Equality-only filters: served by Firestore's automatic single-field indexes (no composite index needed).
  const [byKey, byName] = await Promise.all([
    col.where('status', '==', 'active').where('categoryKey', '==', categoryKey).limit(cap).get(),
    col.where('status', '==', 'active').where('category', 'in', def.catalogNames).limit(cap).get(),
  ]);
  const map = new Map<string, Candidate>();
  for (const s of [...byKey.docs, ...byName.docs]) map.set(s.id, toCandidate(s.id, s.data()));
  const docs = [...map.values()];
  if (deps.cache !== false) cache.set(categoryKey, { at: deps.nowMs, docs });
  return docs;
}

async function loadSellers(db: Firestore, ids: string[]): Promise<Map<string, SellerInfo>> {
  const out = new Map<string, SellerInfo>();
  if (!ids.length) return out;
  const snaps = await db.getAll(...ids.map((id) => db.collection('sellers').doc(id)));
  for (const s of snaps) if (s.exists) out.set(s.id, { status: s.get('status') as string, district: (s.get('district') as string | undefined)?.toLowerCase() }); // district used for ranking only, never returned
  return out;
}

export interface SearchResponse {
  mode: 'ai' | 'rules';
  query: SearchQuery;
  clarification: { code: string; question: string } | null;
  result: Omit<SearchOutcome, 'excluded'> & { excluded: SearchOutcome['excluded'] } | null;
  notices: string[];
}

export async function searchProducts(deps: SearchDeps, raw: unknown): Promise<SearchResponse> {
  if (!deps.enabled) throw new SearchError(503, 'disabled', 'AI search is not enabled yet');
  const req = parseSearchRequest(raw);

  const perMin = deps.uid ? deps.limits.perMinuteUser : deps.limits.perMinuteAnon;
  if (!(await consume(deps.db, `search_${deps.callerKey}`, perMin, 60_000, deps.nowMs))) throw new SearchError(429, 'rate_limited', 'অনেক বেশি অনুসন্ধান হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন');

  const notices: string[] = [];
  const rules = parseQueryRules(req.q);
  let query = rules;
  let mode: SearchResponse['mode'] = 'rules';

  // AI is optional, signed-in-only and budgeted. Any failure silently falls back to the rule parser.
  if (deps.ai && deps.uid) {
    const day = new Date(deps.nowMs).toISOString().slice(0, 10);
    const okUser = await consume(deps.db, `ai_${deps.callerKey}_${day}`, deps.limits.aiPerUserPerDay, 86_400_000, deps.nowMs);
    const okGlobal = okUser && (await consume(deps.db, `ai_global_${day}`, deps.limits.aiGlobalPerDay, 86_400_000, deps.nowMs));
    if (okGlobal) {
      try {
        const ai = validateSearchQuery(await deps.ai(req.q));
        query = reconcile(ai, rules, req.q);
        mode = 'ai';
      } catch (e) {
        if (!(e instanceof QueryValidationError)) console.error('ai parse failed', e instanceof Error ? e.message : 'unknown');
        notices.push('ai_fallback');
      }
    } else notices.push('ai_budget');
  }

  query = { ...query, ...(req.filters.budgetMin != null ? { budgetMin: req.filters.budgetMin } : {}), ...(req.filters.budgetMax != null ? { budgetMax: req.filters.budgetMax } : {}), ...(req.filters.condition ? { condition: req.filters.condition } : {}) };
  if (query.budgetMin !== null && query.budgetMax !== null && query.budgetMin > query.budgetMax) throw new ValidationError('Minimum budget is above maximum');

  const clarification = clarificationFor(query, req.q);
  if (clarification) return { mode, query, clarification, result: null, notices };
  if (!deps.enabledCategories.includes(query.categoryKey!)) throw new SearchError(422, 'category_disabled', 'এই ক্যাটাগরিতে AI search এখনো চালু হয়নি');

  const candidates = await loadCandidates(deps, query.categoryKey!);
  const sellers = await loadSellers(deps.db, [...new Set(candidates.map((c) => c.sellerId).filter(Boolean) as string[])]);
  const result = runSearch(candidates, sellers, query, { nowMs: deps.nowMs, page: req.page, pageSize: req.pageSize });
  return { mode, query, clarification: null, result, notices };
}

/** Fresh server-side price/stock for product pages & checkout review. Public fields only. */
export async function productAvailability(db: Firestore, ids: unknown, nowMs: number) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20 || ids.some((i) => typeof i !== 'string' || !i || i.includes('/') || i.length > 128)) throw new ValidationError('ids must be 1-20 product ids');
  const snaps = await db.getAll(...[...new Set(ids as string[])].map((id) => db.collection('products').doc(id)));
  return snaps.map((s) => {
    if (!s.exists || s.get('status') !== 'active') return { id: s.id, available: false as const, availability: { status: 'out_of_stock', verified: true, staleDays: null }, price: null };
    const c = toCandidate(s.id, s.data()!);
    return { id: s.id, available: (c.stock ?? 0) > 0, price: c.price ?? null, availability: availabilityOf(c, nowMs), checkedAtMs: nowMs };
  });
}
