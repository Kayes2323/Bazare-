export type Condition = 'new' | 'used' | 'refurbished';

/** A user preference. `required` = mandatory (affects exact vs alternative tier), otherwise only boosts rank. */
export interface Pref { value: string; required: boolean }

/** Validated, structured search intent. Produced by the rule parser or (validated) AI output — never executed as a query. */
export interface SearchQuery {
  categoryKey: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  condition: Condition | null;
  brand: Pref | null;
  model: Pref | null;
  location: Pref | null;
  keywords: string[];
}

/** Minimal product view the engine needs (already normalised by the service layer; timestamps in ms). */
export interface Candidate {
  id: string;
  name: string;
  category: string;
  categoryKey?: string;
  brand?: string;
  model?: string;
  aliases?: string[];
  condition?: string;
  description?: string;
  price?: number;
  originalPrice?: number | null;
  stock?: number;
  status?: string;
  sellerId?: string;
  sellerName?: string;
  imageUrl?: string;
  emoji?: string;
  deliveryCharge?: number;
  updatedAtMs?: number;
}

export interface SellerInfo { status?: string; district?: string }

export type AvailabilityStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unverified';
export interface Availability { status: AvailabilityStatus; verified: boolean; staleDays: number | null }

export type ReasonCode =
  | 'model_exact' | 'model_similar' | 'model_mismatch'
  | 'brand_match' | 'brand_mismatch'
  | 'condition_match' | 'within_budget' | 'location_match'
  | 'keyword_match' | 'stock_unverified' | 'over_budget' | 'condition_unknown';
export interface Reason { code: ReasonCode; detail?: string }

export type Tier = 'exact' | 'alternative' | 'near_miss';

/** Public product card — the only shape that leaves the server. */
export interface ProductCard {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  imageUrl: string;
  emoji: string;
  category: string;
  brand: string;
  model: string;
  condition: Condition | null;
  sellerId: string;
  sellerName: string;
  deliveryCharge: number | null;
  availability: Availability;
}

export interface SearchHit {
  tier: Tier;
  score: number;
  reasons: Reason[];
  product: ProductCard;
}
