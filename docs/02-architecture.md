# Bazare — Architecture decision & migration plan

## Decision
**Option B, staged: a dedicated web app (Next.js + TypeScript) for the public storefront/seller web, an Expo (React Native) Android app later for sellers, both on the existing Firebase backend and one shared `packages/domain` TypeScript package.** Phase 1 does **not** start either app — it makes the current site safe and extracts the shared domain layer first.

### Why not A (one Expo/React Native Web app for everything)
- Bazare's growth loop is *shared links in WhatsApp/Facebook*. Link previews and Google need server-rendered HTML per product/store. Expo Router can statically export known routes, but per-product pages from live Firestore data are the weak spot of the Expo web story (server rendering is newer/less mature than Next.js — verify against current Expo docs before betting on it).
- RN-Web carries React Native's runtime into a mobile-web-first, low-bandwidth audience; bundle size and first load matter in Bangladesh.
- Seller dashboard tables/forms are web-shaped UI; the native app wants a different (task-focused) UX anyway. Sharing *screens* is the part of "write once" that rarely survives.

### Why not "port everything to Expo now"
Premature: the value hypothesis is unvalidated (`03-product.md`), and the app's riskiest code (orders/stock/roles) is not safe yet.

### What is shared (and what is not)
Shared: types, validation, pricing, status transitions, Firestore contracts (`packages/domain`), Firestore rules, server endpoints. Not shared: UI components (separate web/native), navigation.

### Cost (no new paid service is required in Phase 1)
Firebase Spark + Vercel serverless functions (instead of Cloud Functions, which need Blaze). Later: Vercel Pro if commercial use requires it, Google Play one-time registration fee (~US$25, verify), Cloudinary free tier limits, SMS OTP per-message cost.

## Staged migration (live site stays up at every step)
| Stage | Content | Status |
|---|---|---|
| 0 (this phase) | Keep static HTML. Add `packages/domain`, tested rules, server order endpoints, XSS fixes, `/p/:id` share pages with Open Graph tags | **Done in branch, not deployed** |
| 1 | `apps/web` (Next.js) for `/p/…` and `/s/<store>` public pages (SSR/ISR, SEO), reusing domain + Firestore. Static pages keep serving everything else; route-by-route cutover via Vercel rewrites | Phase 2–3 |
| 2 | Move auth, seller dashboard and order screens into Next.js; retire HTML pages one by one | After pilot |
| 3 | `apps/mobile` (Expo Router) seller app: orders, stock, push notifications for new orders | Only if pilot shows sellers want an app |

## Repository layout now
```
packages/domain/   types, validation, pricing, transitions (pure TS, unit-tested)
api/               Vercel functions: place-order, update-order-status, share-product
api/_lib/          orders-service (Admin SDK transactions), http helpers
firestore.rules    deny-by-default rules (emulator-tested)
tests/             rules + service tests (Firestore emulator)
scripts/set-admin.mjs  grant admin role (replaces in-browser admin key)
*.html, *.js       legacy pages (hardened, otherwise unchanged)
docs/              this documentation (excluded from deploy via .vercelignore)
```

## Data ownership & authorization
| Entity | Path | Read | Write |
|---|---|---|---|
| User profile | `users/{uid}` | owner, admin | create: owner as `buyer` only; update: owner (non-privileged fields; may set `sellerStatus` → `pending`); `role`/approval: admin only |
| Seller application / private store data (NID, payout) | `sellers/{uid}` | owner, admin | create: owner, `pending` only; resubmit while not approved; approve/reject: admin |
| Product (public when `active`) | `products/{id}` | anyone if `active`; owner/admin otherwise | create/update/delete: role-`seller` owner (cannot touch `sold/rating/reviewCount/sellerId/views`); admin; `views +1` by anyone |
| Order (+ item snapshots, status history, buyer contact) | `orders/{id}` | buyer, that seller, admin | **server only** (Admin SDK). Status: buyer cancel while `pending`; seller `pending→confirmed→shipped→delivered`, cancel until shipped; admin same |
| Order status history | embedded `orders.statusHistory[]` | same as order | server only |
| Payment status | `orders.paymentStatus` | same as order | server only; always `unpaid` today (no gateway) |
| Review | `reviews/{orderId}` | public | buyer of that *delivered* order, once; admin delete |
| Public store/seller profile | *(not yet)* — seller name is denormalised into products; `sellers` stays private | | Phase 2 adds a `stores/{slug}` public doc |

Stock rules: decremented transactionally at order creation, restored on cancellation, `sold` incremented on delivery.
