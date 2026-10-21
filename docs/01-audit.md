# Bazare — Repository audit (Phase 1)

Method: static reading of every page/script in the repo (commit `ee8b959`), plus running the new test suite against the Firestore emulator. **Nothing here was observed on the live site or the live Firebase project** — the Firestore/Storage rules deployed to `bazare-abe67` are not in the repo and could not be inspected. Statements about "current behaviour" mean "what the code does".

## 1. Architecture (as found)
- 10 standalone HTML pages (~300 KB), vanilla JS, shared `auth.js`, `cart.js`, `firebase-config.js`, two CSS files. No `package.json`, no build, no tests, no CI.
- Firebase compat SDK 9.23 from CDN. Firestore collections: `users`, `sellers`, `products`, `orders`, `reviews`. Auth: Google popup/redirect + phone OTP.
- Images: Cloudinary **unsigned** upload preset (`bazare_uploads`) called from the browser. Firebase Storage SDK is loaded but never used.
- Hosting: Vercel static site. `vercel.json` uses legacy `routes` (filesystem → 404). With `routes` present, Vercel ignores `cleanUrls`/`trailingSlash`, so pages are reached via `.html` links (as the code does).
- All business logic (pricing, stock, status changes, role changes) runs in the browser against Firestore directly.
- No Firestore/Storage rules, `firebase.json` or indexes file in the repo.

## 2. Workflows — status
| Flow | Status | Evidence |
|---|---|---|
| Google / phone login, profile auto-create | Functional (unverified live) | `auth.js`; profile creation sets `role:'buyer'` |
| Browse home / listing / product | Functional; **no SEO** | Product data fetched client-side; `<title>`/meta are static, no OG tags → no WhatsApp/Facebook previews |
| Add to cart | Partially broken | Cards on `index`/`listing` built cart items **without `sellerId`**; qty from product page ignored |
| Cart page qty edit | **Broken** | `cart.html` calls `saveLocalCart()`, which did not exist |
| Checkout | **Broken + dangerous** | Calls undefined `saveLocalCart([])` *after* creating the order → error toast, button re-enabled → user re-submits → **duplicate orders**. "Buy now" (`?buy=`) ignored. Orders for items lacking `sellerId` were saved with `sellerId:'unknown'` (invisible to every seller) |
| Payment | **Not integrated** | bKash/Nagad only collect a number; nothing is charged or verified. COD is the only real mode |
| Coupons | **Fake** | `BAZARE10`/`NEWUSER20` show a discount in the cart that checkout never applies |
| Seller registration | Functional | Writes `sellers/{uid}` (`pending`) + `users/{uid}`; stores NID + payout numbers |
| Admin approval | Functional | Updates `sellers.status`, `users.role` from the browser |
| Seller product CRUD | Functional with bugs | Editing a product reset `sold`, `rating`, `createdAt` and wiped images; new products start with fake 5★ rating; prices parsed as floats |
| Seller order management | Functional | Direct Firestore `update({status})`, any status → any status |
| Buyer order history | Functional with bug | Sorted the (empty) array *before* assigning results |
| Reviews | Functional but forgeable | Browser wrote the product's rating aggregate |
| Wishlist | UI only | Toggles an icon; nothing persisted |
| Android/PWA | Broken | `manifast.json` (typo) is not linked; icons it references don't exist |

## 3. Security findings (code-evidenced)
| # | Severity | Finding | Status after Phase 1 |
|---|---|---|---|
| S1 | **Critical** | `admin.html` contains a hard-coded admin key (`bazare_admin_2024`) in public JS; entering it makes the **browser** write `role:'admin'` to the user's own profile. Anyone can become admin — *and* it only works if rules let users edit their own `role`, meaning the live rules are either open or this flow is broken. | Removed. Role changes only by existing admin (rules) or `scripts/set-admin.mjs`. **The leaked key must be treated as burned.** |
| S2 | **Critical** | No rules in repo. If live rules are open/test-mode, every collection is world-readable/writable (buyers' phones+addresses in `orders`, sellers' NID in `sellers`). | `firestore.rules` written (deny-by-default) and tested on the emulator. **Not deployed** — see `DEPLOYMENT.md`. |
| S3 | High | Order total, prices, `sellerId`, payment fields all client-supplied; stock decremented from the buyer's browser (`catch(()=>{})`, so failures are silent) → price tampering, negative stock, overselling. | `api/place-order` recomputes everything from Firestore in a transaction. |
| S4 | High | Stored XSS: product name, shop name, seller/buyer text, image URLs placed in `innerHTML` and inline `onclick` strings on public pages, seller dashboard and **admin** (seller-controlled `shopName` was interpolated into an `onclick` rendered to admins). | `esc()` / `safeUrl()` added (`auth.js`) and applied on admin, seller dashboard, orders, index, listing, product, checkout. Inline `onclick` no longer carries user text. A grep-level sweep, not a formal audit — `profile.html`, `cart.html` item render, and `404.html` still need review. |
| S5 | High | Any buyer could set any order's status (cancel after shipping, etc.); sellers could set any status. | Status changes go through `api/update-order-status` (actor-aware transition table). Rules deny all client order writes. |
| S6 | Medium | Duplicate orders on retry/double-click. | Idempotency key per checkout attempt → deterministic order id. |
| S7 | Medium | Unsigned Cloudinary preset in public JS: anyone can upload to the account (storage cost / abuse). | **Open.** Needs signed uploads or preset restrictions (size, format, folder, rate) in the Cloudinary console. |
| S8 | Medium | Anonymous `views` counter writes on products. | Kept, but rules only allow `+1` on `views`, nothing else. |
| S9 | Info | Firebase web API key / `firebase-config.js` is public by design; not a vulnerability *if* rules are correct (S2). Restrict the key to your domains in Google Cloud console as defence-in-depth. | n/a |
| S10 | Medium | No security headers/CSP (blocked by legacy `routes`). | Open. |

## 4. Migration risks
1. **Rules vs. legacy data.** Existing `products` may have float prices, missing `imageUrls`, or `rating:5` — a seller editing such a doc would be rejected by `validProduct()`. Run the pre-deploy data check in `DEPLOYMENT.md`.
2. **Checkout now depends on a server secret** (`FIREBASE_SERVICE_ACCOUNT` in Vercel). Deploying code without it breaks ordering; deploying rules before code breaks everything. Order of steps matters.
3. **Vercel routing:** `api/` functions + legacy `routes` + new `/p/:id` route are **unverified** — must be confirmed on a Vercel preview deployment.
4. **Vercel Hobby plan** is for non-commercial use (verify current terms); a commercial marketplace should plan for Pro (~US$20/mo/seat, verify).
5. Firebase **phone auth SMS** costs/quotas for Bangladesh numbers are unverified; check before relying on OTP at scale.

## 5. Test / deployment limitations in this environment
- Verified here: TypeScript typecheck; 10 domain unit tests; 19 Firestore-emulator tests (11 rules, 8 order-service incl. a concurrent-oversell test). `npm test`.
- **Not** verified: any browser flow (no UI tests were run; the edited HTML pages were only syntax-checked with `node --check` on their inline scripts), Firebase Auth, Vercel build/routing, real Firestore, Cloudinary, mobile layouts.
- Deployment not performed: no Firebase credentials/CLI login and no service account in this session; deploying rules blind to a live project is unsafe.

## 6. Phase 2 recommendation
1. Finish deployment gating (`DEPLOYMENT.md`) and run the 5–10 seller interviews **before** building more UI.
2. Build **seller-entered orders** + a seller "orders to action today" view on the existing stack (P1 in the backlog), since it is the most likely source of real value and reuses the tested order service.
3. Start `apps/web` (Next.js) only for the public store/product pages once sellers confirm link sharing matters; do not start the Expo app before pilot results.
