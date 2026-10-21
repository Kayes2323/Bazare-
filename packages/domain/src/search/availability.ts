import type { Availability, Candidate } from './types';

/** PROVISIONAL thresholds — tune with seller behaviour data. */
export const AVAILABILITY_CONFIG = { staleAfterDays: 14, lowStockAtOrBelow: 3 };
const DAY = 86_400_000;

/**
 * Honest availability: stock > 0 alone is not "verified" unless the listing was updated recently.
 * Stale/unknown freshness yields `unverified` (shown with a warning), never a claim of verified stock.
 * Note: adding to cart never reserves stock; the real check happens at order creation.
 */
export function availabilityOf(p: Pick<Candidate, 'stock' | 'updatedAtMs'>, nowMs: number, cfg = AVAILABILITY_CONFIG): Availability {
  const stock = p.stock;
  if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) return { status: 'unverified', verified: false, staleDays: null };
  if (stock === 0) return { status: 'out_of_stock', verified: true, staleDays: null };
  if (typeof p.updatedAtMs !== 'number') return { status: 'unverified', verified: false, staleDays: null };
  const staleDays = Math.max(0, Math.floor((nowMs - p.updatedAtMs) / DAY));
  if (staleDays > cfg.staleAfterDays) return { status: 'unverified', verified: false, staleDays };
  return { status: stock <= cfg.lowStockAtOrBelow ? 'low_stock' : 'in_stock', verified: true, staleDays };
}
