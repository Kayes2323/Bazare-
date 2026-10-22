# Deployment runbook (Phase 1 changes)

**Status: NOT deployed.** The branch `phase1-foundation` has not been merged or deployed; no Firebase credentials were available and live rules were not inspected.

Order matters — doing step 5 before step 3 would break ordering for everyone.

1. **Inspect current live rules** (Firebase console → Firestore → Rules) and export a backup copy. If they are open (`allow ... if true`), the site is currently world-writable: prioritise this runbook.
2. **Create a service account** (Firebase console → Project settings → Service accounts → generate key). In Vercel → Project → Settings → Environment Variables add `FIREBASE_SERVICE_ACCOUNT` = the JSON (Production + Preview). Do **not** commit it. Delete the downloaded file afterwards.
3. **Deploy the code to a Vercel Preview** (push the branch). On the preview, verify manually:
   - `/api/place-order` returns 401 without a token; ordering works end to end with a test buyer + test seller (COD): order appears for buyer and seller, stock drops once, double-click doesn't duplicate, cancel restores stock.
   - Seller confirm → ship → deliver works from the dashboard; a second seller cannot see/modify the order.
   - `/p/<activeProductId>` returns OG tags (check with the Facebook Sharing Debugger); a draft id returns 404.
   - Legacy `routes` still serve every existing page and `/api/*` works; if not, migrate `vercel.json` to `rewrites` (note: `cleanUrls` then takes effect and `.html` links will redirect).
4. **Data check before rules** (Firestore console or a script): products with non-integer `price`, missing `imageUrls`/`sellerName`, or no `status`; users missing `role`. Fix or the owner's edits to those docs will be denied.
5. **Publish rules** after step 3 is green on the preview: `npx firebase-tools deploy --only firestore:rules --project bazare-abe67` (requires `firebase login`). Keep the old rules text so you can roll back from the console in one click.
6. **Create the first admin:** `GOOGLE_APPLICATION_CREDENTIALS=./sa.json node scripts/set-admin.mjs <your-uid>`.
7. Merge to `main` (production). Smoke-test login, browse, order, seller dashboard, admin approvals.
8. **Rotate/restrict:** restrict the Firebase API key to your domains; lock the Cloudinary upload preset (max size, image formats only, fixed folder).

Rollback: revert the merge on Vercel (instant rollback) and restore the saved rules text.

## Preview findings (2026-10-22, Vercel preview of branch `ccr-6bb69d62-4erpq4`)
- Fixed two build/runtime bugs found only on a real deployment: (1) `tsconfig.json` now uses `module: Node16` so `api/*.ts` compile to CommonJS; (2) `firebase-admin` pinned to v13 (v14 pulls ESM-only `jose`, which crashes CommonJS functions).
- Verified on the preview: static pages (incl. `search.html`) serve; `/api/*` functions load (GET → 405 as designed); `/p/<id>` routes to its function.
- **Not verifiable yet:** anything that touches Firestore from the functions — `FIREBASE_SERVICE_ACCOUNT` is not set in Vercel (project has no environment variables), so `/p/<id>` currently returns 500 "Something went wrong" and ordering/search would fail. Set it (step 2) before merging to `main`.
