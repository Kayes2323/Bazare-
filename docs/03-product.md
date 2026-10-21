# Bazare — "Why Bazare?" PRD, MVP backlog, validation plan

Legend: **[Code]** = established by reading/running code. **[Hypothesis]** = unvalidated business belief. Nothing below is market data.

## 1. Product requirements (concise)
**Hypothesis [Hypothesis]:** "Keep selling on Facebook/WhatsApp as usual, but manage products, stock and orders in one organized place."

**Primary user:** a small Facebook-page seller who takes orders in Messenger/WhatsApp and tracks them in chat, notebooks or sheets.

**Job to be done:** *Never lose an order, never oversell, know what to pack and ship today.*

**What Bazare must beat:** the seller's current tool (usually free: a notebook or Google Sheet). So value must show up in **minutes saved per order and mistakes avoided**, not in "being a marketplace".

**MVP scope (physical goods only):**
1. Product catalogue with stock and a shareable link/preview per product. [Code: share page exists, undeployed]
2. Orders in one list with status flow and history. [Code: done server-side]
3. **Manual / assisted order entry** by the seller for orders that arrive via chat (so non-buyer-checkout orders also live in Bazare). *Not built — highest-value gap, see backlog.*
4. Stock auto-decrements and can't go negative. [Code: done, tested]
5. Simple seller onboarding with approval. [Code: exists]
6. Mobile-first, Bangla, low-data. [Code: partially; unverified on devices]

**Explicit non-goals now:** payments gateway, digital goods, gigs, wholesale, subscriptions, AI chat, native app.

**Open assumptions to test [Hypothesis]:** sellers will enter products/orders into a second tool; buyers will check out on a web page vs. continuing in chat; sellers trust a new platform with customer data; COD return/fake-order rates are the real pain; approval wait is acceptable.

## 2. Prioritised MVP backlog
| P | Item | Why |
|---|---|---|
| P0 | Deploy gating (DEPLOYMENT.md): service account, preview test, rules | Everything built is inert until then |
| P0 | Rotate/burn leaked admin key concept; create admin via script | S1 |
| P0 | Lock down Cloudinary preset (size/format/rate) | S7 |
| P1 | Seller creates an order manually (customer name/phone/items from chat) using the same transactional service | Core "chat order → organized" value; likely the main pilot feature |
| P1 | Seller order screen: filters (today / to-pack / to-ship), call/WhatsApp buyer link, print/share packing slip | Time saved |
| P1 | Public `stores/{slug}` + share page for the whole store | Facebook-bio link |
| P1 | Real SEO/OG for products via the Next.js stage | Sharing |
| P2 | Low-stock alert, product CSV import | Onboarding effort |
| P2 | bKash/Nagad **manual** payment confirmation by seller (mark paid) — a real gateway only after demand is proven | Payment status |
| P2 | Server-side rating aggregate | Review integrity |
| P2 | Fake-order/return tracking per phone number | Plausible top pain; verify in interviews |
| P3 | Expo seller app with push for new orders | After pilot |

## 3. Validation plan — Bangladeshi Facebook sellers
**Problems to investigate:** how orders arrive and where they're recorded; missed/duplicated orders; overselling; time spent per order on confirmation/address/packing; fake or returned COD orders; courier handling; repeat-customer tracking; what they already pay for.

**Interview guide (15–20 sellers, ~30 min, past behaviour not opinions):**
1. Walk me through your last 3 orders from first message to delivery.
2. Where is each order written down? Show me.
3. Last time you lost an order / sold something out of stock — what happened and what did it cost?
4. How many orders per day/week? How long to process one?
5. How do you track stock? How often is it wrong?
6. Who confirms orders and calls couriers? Do you use Pathao/Steadfast/RedX or others?
7. How do customers pay (COD/bKash/Nagad)? What fraction fail or return?
8. What tools do you pay for today (page boosting, courier, sheets)? How much?
9. What would you stop doing manually if it were automatic?
10. Would you enter orders into another app each day? What would make you stop?
11. Who else in the family/team touches orders?
Keep a log of verbatim quotes; don't pitch until questions 1–8 are done.

**Demo workflow (10 min):** seller adds 3 products → shares a product link into WhatsApp (see preview) → a "customer" orders → seller sees order, confirms, ships → stock updates → cancel restores stock.

**Pilot (5–10 sellers, 3–4 weeks):** onboard by hand, enter their first products with them, ask them to run *real* orders through Bazare in parallel with their usual method for week 1, primary method from week 2.

**Metrics (define baselines in week 0):**
- Activation: seller has ≥5 products and ≥3 real orders within 7 days.
- Repeat use: sellers who log ≥1 order on ≥4 distinct days in week 3.
- Time saved: stopwatch sample of 20 orders pre/post (minutes/order, self-reported + observed).
- Mistakes: missed/duplicate/oversold/wrong-address orders per 50 orders (seller log + our order data).
- Retention at week 4 and "would be very disappointed" (Sean Ellis-style) — small n, treat as directional only.

**Willingness to pay (without misleading):** state clearly it's a pilot; ask for a *specific* price after value is felt (e.g., week 3), compare 2–3 price points across different sellers, and prefer a real commitment (pre-agreement to pay from month 2, or a small actual payment) over "would you pay?". Never imply features that don't exist. Record refusals and reasons.

**Evidence that should change strategy:**
- Most sellers won't enter data twice → pivot to ingestion (WhatsApp/Messenger order capture) or to a simpler "link-in-bio store".
- Sellers' pain is courier/COD fraud, not organization → build around delivery/return tracking.
- Buyers refuse web checkout and always confirm via chat → make seller-entered orders primary, buyer checkout secondary.
- <30% of pilot sellers still use it in week 3 despite hand-holding → problem or product is wrong.
- No one pays at any price point after clear value → rethink monetisation (commission vs. subscription) before building more.
