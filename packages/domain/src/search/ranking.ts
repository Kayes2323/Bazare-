import { availabilityOf } from './availability';
import { categoryByKey } from './categories';
import { commonPrefixLen, modelKey, normalizeText, wordTokens } from './text';
import type { Candidate, Condition, ProductCard, Reason, SearchHit, SearchQuery, SellerInfo, Tier } from './types';

/**
 * PROVISIONAL ranking weights — chosen by judgement, NOT tuned on data. Configurable per call and unit-tested.
 * Revisit after real queries/clicks exist.
 */
export const DEFAULT_WEIGHTS = {
  modelExact: 40,
  modelSimilar: 15,     // same brand family, e.g. fx-991es vs fx-991ex
  brandMatch: 20,
  conditionMatch: 10,
  locationMatch: 8,
  keywordMatch: 4,      // per matched keyword, capped at keywordCap
  keywordCap: 12,
  priceFit: 10,         // up to this many points, cheaper-within-budget is better
  verifiedStock: 5,     // listing recently updated
  staleStockPenalty: -5,
};
export type Weights = typeof DEFAULT_WEIGHTS;

export const NEAR_MISS_BUDGET_FACTOR = 1.2; // PROVISIONAL: suggestions up to 20% over budget when nothing fits

const USED_WORDS = ['used', 'second hand', 'secondhand', 'পুরনো', 'পুরাতন', 'ব্যবহৃত'];
const NEW_WORDS = ['brand new', 'নতুন', 'sealed'];

export type ExcludeReason = 'inactive' | 'seller_ineligible' | 'out_of_stock' | 'missing_price' | 'missing_stock' | 'wrong_category' | 'wrong_location' | 'over_budget' | 'under_budget' | 'condition_mismatch' | 'condition_unknown';

export function inferCondition(p: Candidate): Condition | null {
  if (p.condition === 'new' || p.condition === 'used' || p.condition === 'refurbished') return p.condition;
  const hay = normalizeText(`${p.name} ${p.description ?? ''}`);
  if (USED_WORDS.some((w) => hay.includes(w))) return 'used';
  if (NEW_WORDS.some((w) => hay.includes(w))) return 'new';
  return null; // unknown — we never guess
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

function belongsToCategory(p: Candidate, key: string): boolean {
  if (p.categoryKey === key) return true;
  const def = categoryByKey(key);
  return !!def && def.catalogNames.map(normalizeText).includes(normalizeText(p.category ?? ''));
}

function toCard(p: Candidate, nowMs: number): ProductCard {
  return {
    id: p.id,
    name: String(p.name ?? ''),
    price: p.price as number,
    originalPrice: isInt(p.originalPrice) && (p.originalPrice as number) > (p.price as number) ? (p.originalPrice as number) : null,
    imageUrl: typeof p.imageUrl === 'string' ? p.imageUrl : '',
    emoji: p.emoji || '📦',
    category: String(p.category ?? ''),
    brand: p.brand ?? '',
    model: p.model ?? '',
    condition: inferCondition(p),
    sellerId: String(p.sellerId ?? ''),
    sellerName: String(p.sellerName ?? ''),
    deliveryCharge: isInt(p.deliveryCharge) ? (p.deliveryCharge as number) : null,
    availability: availabilityOf(p, nowMs),
  };
}

export interface EvalOptions { weights?: Weights; nowMs: number; relaxed?: boolean }
export type Evaluation = { eligible: false; why: ExcludeReason } | { eligible: true; hit: SearchHit };

/**
 * Step 1 (hard eligibility) then step 2 (explainable scoring). `relaxed` is used only for near-miss suggestions
 * (budget +20%, unknown condition allowed) and produces tier `near_miss`.
 */
export function evaluate(p: Candidate, seller: SellerInfo | undefined, q: SearchQuery, opt: EvalOptions): Evaluation {
  const w = opt.weights ?? DEFAULT_WEIGHTS;
  const relaxed = !!opt.relaxed;

  // ── hard eligibility ──
  if (p.status !== 'active') return { eligible: false, why: 'inactive' };
  if (!seller || seller.status !== 'approved') return { eligible: false, why: 'seller_ineligible' };
  if (!isInt(p.price) || p.price <= 0) return { eligible: false, why: 'missing_price' };
  if (!isInt(p.stock) || p.stock < 0) return { eligible: false, why: 'missing_stock' };
  if (p.stock === 0) return { eligible: false, why: 'out_of_stock' };
  if (q.categoryKey && !belongsToCategory(p, q.categoryKey)) return { eligible: false, why: 'wrong_category' };

  const reasons: Reason[] = [];
  const maxPrice = q.budgetMax === null ? null : relaxed ? Math.floor(q.budgetMax * NEAR_MISS_BUDGET_FACTOR) : q.budgetMax;
  if (maxPrice !== null && p.price > maxPrice) return { eligible: false, why: 'over_budget' };
  if (q.budgetMin !== null && p.price < q.budgetMin) return { eligible: false, why: 'under_budget' };
  const overBudget = q.budgetMax !== null && p.price > q.budgetMax;

  const cond = inferCondition(p);
  if (q.condition) {
    if (cond === null && !relaxed) return { eligible: false, why: 'condition_unknown' };
    if (cond !== null && cond !== q.condition) return { eligible: false, why: 'condition_mismatch' };
    if (cond === null) reasons.push({ code: 'condition_unknown' });
  }

  // ── scoring ──
  let score = 0;
  let mandatoryMiss = false;
  const nameKey = modelKey(`${p.name} ${(p.aliases ?? []).join(' ')}`);
  const prodModel = modelKey(p.model ?? '');
  const brandHay = normalizeText(`${p.brand ?? ''} ${p.name}`);

  if (q.model) {
    const want = q.model.value;
    if ((prodModel && prodModel === want) || nameKey.includes(want) || (p.aliases ?? []).some((a) => modelKey(a) === want)) {
      score += w.modelExact; reasons.push({ code: 'model_exact', detail: want });
    } else {
      const other = prodModel || '';
      const brandOk = !q.brand || brandHay.includes(q.brand.value);
      if (other && brandOk && commonPrefixLen(other, want) >= 5) { score += w.modelSimilar; reasons.push({ code: 'model_similar', detail: p.model }); }
      else reasons.push({ code: 'model_mismatch', detail: p.model || undefined });
      if (q.model.required) mandatoryMiss = true;
    }
  }
  if (q.brand) {
    if (brandHay.includes(q.brand.value)) { score += w.brandMatch; reasons.push({ code: 'brand_match', detail: q.brand.value }); }
    else { reasons.push({ code: 'brand_mismatch', detail: p.brand || undefined }); if (q.brand.required) mandatoryMiss = true; }
  }
  if (q.condition && cond === q.condition) { score += w.conditionMatch; reasons.push({ code: 'condition_match', detail: cond }); }
  if (q.budgetMax !== null && !overBudget) {
    score += w.priceFit * (1 - Math.min(1, p.price / q.budgetMax) * 0.5);
    reasons.push({ code: 'within_budget' });
  }
  if (overBudget) reasons.push({ code: 'over_budget' });

  if (q.location) {
    if (seller.district && normalizeText(seller.district) === q.location.value) { score += w.locationMatch; reasons.push({ code: 'location_match', detail: q.location.value }); }
    else if (q.location.required) return { eligible: false, why: 'wrong_location' };
  }
  if (q.keywords.length) {
    const toks = new Set(wordTokens(`${p.name} ${p.brand ?? ''} ${p.model ?? ''} ${p.description ?? ''}`));
    const hits = q.keywords.filter((k) => toks.has(k));
    if (hits.length) { score += Math.min(w.keywordCap, hits.length * w.keywordMatch); reasons.push({ code: 'keyword_match', detail: hits.join(', ') }); }
  }

  const avail = availabilityOf(p, opt.nowMs);
  if (avail.verified) score += w.verifiedStock; else { score += w.staleStockPenalty; reasons.push({ code: 'stock_unverified' }); }

  const tier: Tier = relaxed || overBudget ? 'near_miss' : mandatoryMiss ? 'alternative' : 'exact';
  return { eligible: true, hit: { tier, score: Math.round(score * 100) / 100, reasons, product: toCard(p, opt.nowMs) } };
}

export const compareHits = (a: SearchHit, b: SearchHit) => {
  const rank = { exact: 0, alternative: 1, near_miss: 2 } as const;
  return rank[a.tier] - rank[b.tier] || b.score - a.score || a.product.price - b.product.price || a.product.id.localeCompare(b.product.id);
};
