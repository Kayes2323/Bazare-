# AI Shopping Assistant — calculator pilot (Phase 2)

Status: **implemented on the branch, not deployed** (Phase 1 is also not deployed; this builds on it). Feature-flagged **off** by default.

## Audit (what the catalog actually is)
- `products` have: `name, category (free text), price, stock, status, sellerId, sellerName, imageUrl(s), emoji, description, deliveryCharge, badge, sold, rating, createdAt/updatedAt`. **No `brand`, `model`, `condition`.**
- Existing categories are Bangla free-text values (handicraft, organic food, plants, gifts…). **There is no calculator category and therefore no calculator data yet.** The pilot needs sellers to list real calculators; no seed/demo data is created.
- Seller eligibility = `sellers/{uid}.status == 'approved'` (private collection; read server-side only).
- Stock freshness: only `updatedAt` (set when a seller edits) / `createdAt`.

## Schema changes (all optional → legacy products keep working)
`products.brand`, `.model`, `.condition` (`new|used|refurbished`), `.categoryKey` (`calculator`), `.aliases[]` (≤10). `updatedAt` is now also set on create. The seller form got a ক্যালকুলেটর category, brand, model, condition. Rules validate these fields. Legacy products are still matched by name/category text (e.g. a product named "Casio fx-991ES …" in category "Calculator").

## Architecture
```
search.html ──POST /api/search──▶ api/_lib/search-service.ts
                                   1 validate input (≤300 chars, paging, filters)
                                   2 rate limit (Firestore counters)
                                   3 understand query: rule parser (always) + optional AI → strict validator → reconcile
                                   4 retrieve candidates (Admin SDK, equality filters on status/category, cap 200, 60 s cache)
                                   5 packages/domain/search: hard eligibility → explainable scoring → tiers → pagination
                                   6 return public product cards only
```
- **Category-agnostic engine** (`packages/domain/src/search`): a new category = one entry in `categories.ts`.
- **Mandatory vs preferred:** budget, condition, category, stock/listing/seller eligibility are hard filters. Brand/model are *required* unless hedged ("preferably", "হলে ভালো"…); a required-but-missed brand/model makes the product an **alternative**, not an exact match. Over-budget/unknown-condition items only appear as clearly labelled **near-miss** suggestions when nothing matches.
- **AI is optional and untrusted.** It only suggests JSON filters (`api/_lib/ai-parser.ts`); output goes through a strict allow-list validator, and numbers/condition are re-derived from the literal text, so a hallucinated or injected value cannot widen or change the query. Model output never reaches Firestore as a query. No `ANTHROPIC_API_KEY` ⇒ rule parser only (still handles Bangla/Banglish/English).
- **Checkout/stock:** unchanged transactional `place-order` (Phase 1) plus `expectedPrice` — an order is refused (409 `price_changed`) if the price moved; checkout then refreshes prices. Add-to-cart never reserves stock (UI says so). `POST /api/availability` gives product pages a fresh server-side price/stock check; stale listings (> 14 days since seller update — provisional) are shown as **"stock not verified"**.
- **Ranking weights** are in `DEFAULT_WEIGHTS` (`ranking.ts`), **provisional, untuned**, injectable and covered by tests.

## Environment variables (Vercel; never in client code)
| Var | Purpose | Default |
|---|---|---|
| `AI_SEARCH_ENABLED` | feature flag; must be `true` | off (API returns 503, page shows "coming soon") |
| `AI_SEARCH_CATEGORIES` | enabled category keys | `calculator` |
| `ANTHROPIC_API_KEY` | optional AI query parsing | unset → rules only |
| `AI_MODEL` | model id for parsing | `claude-haiku-5-5` |
| `AI_PARSER_ENABLED` | `false` to kill AI without removing the key | on if key set |
| `AI_DAILY_PER_USER`, `AI_DAILY_GLOBAL` | AI call budgets | 30 / 500 per day |
| `SEARCH_RPM_ANON`, `SEARCH_RPM_USER` | searches per minute | 8 / 20 |
| `RATE_LIMIT_SALT` | salt for hashed anonymous caller ids | `bazare` (set your own) |
| `FIREBASE_SERVICE_ACCOUNT` | Admin SDK credentials (from Phase 1) | required |

## Manual Firebase / console steps
1. **TTL policy** on collection group `rateLimits`, field `expiresAt` (Firestore → TTL) so counters self-clean.
2. **Indexes:** none required — queries use equality filters only (`status`, `categoryKey`, `category in [...]`). If Firestore ever returns `FAILED_PRECONDITION` with an index link, create it. When catalogs exceed the 200-doc candidate cap, add a composite index `(status, categoryKey, price)` and push the budget into the query.
3. Deploy the updated `firestore.rules` (after Phase 1's checklist in `DEPLOYMENT.md`).

## Cost notes (verify current prices before launch)
- **Firestore reads:** one search ≈ up to 400 candidate reads (two queries × cap 200) + one read per distinct seller + 1–4 counter transactions; the 60 s in-memory cache cuts repeat reads per warm instance. Spark's free read quota is finite — watch it; lower `candidateCap` or add the composite index if the catalog grows.
- **AI:** ≈ 300 input + ≤ 100 output tokens per call (short system prompt + a ≤ 300-char query). Worst-case daily spend = `AI_DAILY_GLOBAL × per-call price`; look up the provider's current price for the chosen model. The rule parser is free and is always used as fallback/cross-check.
- Vercel function invocations: counted by your plan; anonymous traffic is rate-limited.

## Rollout
1. Merge Phase 1 deploy steps first. 2. Deploy with `AI_SEARCH_ENABLED` unset (page exists at `/search.html`, unlinked, `noindex`). 3. Ask 3–5 trusted sellers to list real calculators with brand/model/condition. 4. Enable the flag in Preview, test with real data, then Production; add a nav link only once ≥ ~10 real calculator listings exist. 5. Turn off with the flag at any time.

## Verification (what actually ran)
`npm test` → typecheck; 39 unit tests (parser incl. Bangla/Banglish/English + malicious AI output validation; engine: exact/alternate/brand mismatch/condition/budget boundaries/inactive/zero stock/stale/missing fields/pagination/weights/no private fields); 37 Firestore-emulator tests (rules incl. unauthorized seller access and server-only collections; search service over emulated catalog; rate limits; AI budget; AI fallbacks; stale-price checkout; concurrent checkout; duplicate submissions). UI: an ad-hoc headless-Chromium run (mobile 375 px + desktop) against the real page with Firebase shimmed and `/api/search` mocked with real engine output — 23 checks passed. Not run: real AI provider calls, real Firebase Auth/Firestore, Vercel build/routing, real devices.

## Known limitations / next steps
- Zero real calculator data exists yet; quality of matches is unproven until sellers list products.
- Location uses seller `district` (private; used for ranking only, never returned). 20 major districts are recognised; extend `DISTRICTS`.
- Brand list and model pattern for calculators are hints (Casio-centred); extend per category.
- Model-similarity heuristic (shared ≥5-char prefix, same brand) is crude.
- Candidate cap 200 per category; no semantic/embedding search; no click/feedback logging to tune weights (add before tuning).
- In-memory cache is per serverless instance; rate limits are Firestore-based (accurate, but cost a few writes per request).
- Price-change handling is an HTTP 409 + refreshed cart, not a price-lock.
