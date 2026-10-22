Bazare — Master Feature & Decision Log

Version: 1.0
Last updated: 22 October 2026
Status: Living document — নতুন সিদ্ধান্ত অনুযায়ী নিয়মিত আপডেট হবে।

1. Bazare-এর মূল Vision

Bazare হবে বাংলাদেশের ছোট ব্যবসায়ী, Facebook seller, ক্রেতা, freelancer এবং service provider-দের জন্য একটি scalable digital business platform।

লক্ষ্য শুধু পণ্য কেনাবেচার marketplace তৈরি করা নয়; বরং ছোট ব্যবসায়ীদের online store, product listing, order, inventory, customer communication এবং business growth-এর প্রয়োজনীয় tools একই ecosystem-এ দেওয়া।

প্রস্তাবিত positioning:
"একটি platform-এ পণ্য কেনাবেচা, নিজের online store এবং ব্যবসা পরিচালনার সুবিধা।"

মূল নীতিমালা

- বাংলাদেশি ব্যবহারকারী ও স্থানীয় ব্যবসাকে অগ্রাধিকার।
- সহজ, mobile-first এবং কম জটিল user experience।
- ছোট ব্যবসায়ীরা যেন আলাদা website না বানিয়েও online store চালাতে পারেন।
- বাস্তব সমস্যা সমাধান করে এমন feature আগে তৈরি করা।
- নিরাপদ transaction, নির্ভরযোগ্য product information এবং seller trust বজায় রাখা।
- ধাপে ধাপে web থেকে Android/Google Play ecosystem-এ সম্প্রসারণ।

---

2. Target Users

Phase 1-এর প্রধান ব্যবহারকারী

1. Small business owners — ক্ষুদ্র ব্যবসায়ী।
2. Facebook/WhatsApp sellers — সামাজিক মাধ্যমে পণ্য বিক্রেতা।
3. Local entrepreneurs — স্থানীয় উদ্যোক্তা।
4. Buyers/customers — পণ্য ক্রেতা।

ভবিষ্যৎ ব্যবহারকারী

5. Freelancers ও service providers।
6. Digital product creators।
7. Wholesale sellers এবং resellers।

---

3. Feature Decisions

A. Core Marketplace

Status: Core product direction — approved

- [x] পণ্যভিত্তিক marketplace হবে।
- [x] Seller-রা নিজেদের পণ্য listing করতে পারবেন।
- [x] ক্রেতারা পণ্য খুঁজতে ও দেখতে পারবেন।
- [x] Product details, price এবং seller/store information দেখানোর ব্যবস্থা থাকবে।
- [x] পণ্য কেনা বা order করার user flow থাকবে।
- [ ] বাস্তব implementation ও production functionality audit বাকি; কোনো feature-এর page থাকলেই সেটিকে সম্পূর্ণ কার্যকর ধরে নেওয়া যাবে না।

B. Automatic Mini Store / Seller Store Page

Status: Approved product direction

প্রত্যেক seller-এর জন্য আলাদা website হাতে তৈরি করতে হবে না। Bazare একই reusable template দিয়ে স্বয়ংক্রিয়ভাবে আলাদা store page তৈরি করবে।

প্রস্তাবিত URL format:

- "bazare.com/s/little-nest"
- "bazare.com/s/arafas-jewelry"

URL-গুলো উদাহরণ; live availability নিশ্চিত করা হয়নি।

Store page-এ থাকবে:

- Store name।
- Seller-এর optional logo।
- Optional cover photo।
- Store description।
- Product catalogue।
- Product price ও availability।
- Product details এবং order করার সুবিধা।
- Store share করার link।

Logo না থাকলে default icon বা store name-এর initial দেখানো হবে।

Custom domain—যেমন "littlenest.com"—ভবিষ্যতের optional feature; প্রথম MVP-এর বাধ্যতামূলক অংশ নয়।

C. Shareable Store ও Product Links

Status: Approved product direction

- [x] প্রত্যেক store-এর unique shareable URL।
- [x] নির্দিষ্ট product-এর shareable URL।
- [x] Facebook, Messenger ও WhatsApp-এ link share করার সুবিধা।
- [ ] Seller dashboard-এ Share Store ও Share Product actions-এর বাস্তব implementation যাচাই করতে হবে।
- [ ] Link preview, Open Graph metadata এবং social sharing experience উন্নত করতে হবে।

মূল উদ্দেশ্য: Facebook-এ আগে থেকেই যাঁরা বিক্রি করেন, তাঁদের Bazare-এর মাধ্যমে আরও গোছানোভাবে product ও store share করতে দেওয়া।

D. Seller Dashboard ও Business Tools

Status: Core direction approved; implementation details to be audited

- Product management।
- Price ও stock management।
- Order tracking।
- Order status updates।
- Basic inventory management।
- Seller-এর নিজের store ও products পরিচালনা।
- ভবিষ্যতে analytics ও business insights।

E. AI Shopping Assistant

Status: Feature direction approved; rollout phase pending

ক্রেতা নিজের ভাষায় প্রয়োজন লিখবেন এবং AI Bazare-এর actual product catalogue থেকে matching products খুঁজে দেবে।

উদাহরণ:
"১৫০০ টাকার মধ্যে used Casio FX-991ES scientific calculator চাই।"

AI-এর দায়িত্ব:

- Bangla, Banglish ও English query বোঝা।
- Product category, brand, model, condition ও budget শনাক্ত করা।
- Structured filters তৈরি করা।
- Actual database থেকে পণ্য খোঁজা।
- Exact match ও alternative আলাদা করে দেখানো।
- Product comparison-এ সাহায্য করা।
- পণ্য না পেলে সৎভাবে জানানো।

Product matching logic

- প্রথমে mandatory filters প্রয়োগ হবে।
- তারপর model/specification, brand/category, condition, budget এবং seller/listing quality অনুযায়ী ranking হবে।
- Ranking weights প্রাথমিকভাবে configurable থাকবে; বাস্তব ব্যবহার ও পরীক্ষার ভিত্তিতে উন্নত করা হবে।
- "এই model হলে ভালো" এবং "এই model-ই লাগবে"—দুটিকে আলাদা preference হিসেবে বুঝতে হবে।

Inventory verification

- Product active ও published কি না যাচাই।
- Current price এবং stock quantity যাচাই।
- Seller/listing status যাচাই।
- পুরোনো inventory information হলে availability warning।
- Checkout-এর সময় আবার price ও stock validation।
- Concurrent order হলে stock overselling প্রতিরোধ।
- AI কখনো নিজের থেকে price, stock, seller বা rating বানিয়ে বলতে পারবে না।

প্রথম pilot

- Scientific calculator category দিয়ে শুরু।
- পরে একই architecture অন্যান্য category-তে ব্যবহার।
- AI provider cost, usage limits ও security বিবেচনা করে rollout।

F. Seller Pro Subscription

Status: Proposed business model; final pricing and packaging pending

Pro subscription-এর উদ্দেশ্য হবে seller-কে এমন tools দেওয়া, যেগুলো সময় বাঁচায়, customer handling সহজ করে এবং business management উন্নত করে।

প্রস্তাবিত Pro features:

1. AI WhatsApp chatbot।
2. AI product description ও marketing caption।
3. উন্নত sales analytics।
4. Smart stock alerts।
5. Order management assistance।
6. Customer follow-up assistance।
7. ভবিষ্যতে আরও advanced automation।

WhatsApp chatbot

- ক্রেতার সাধারণ প্রশ্নের উত্তর।
- Product price, size, condition ও stock সম্পর্কে তথ্য।
- Order information সংগ্রহ।
- Delivery ও order status জানানো, যদি trusted data available থাকে।
- Bangla, Banglish ও English support।

গুরুত্বপূর্ণ: Official WhatsApp Business Platform integration, message quotas এবং সংশ্লিষ্ট খরচ আগে যাচাই করতে হবে। Pro plan-এ কত message অন্তর্ভুক্ত থাকবে, তা cost analysis-এর পরে নির্ধারণ হবে।

G. Buyer AI বনাম Seller AI

Status: Product architecture direction approved

দুটি আলাদা use case থাকবে:

Buyer AI

- প্রয়োজন বুঝবে।
- Product discovery করবে।
- Product comparison-এ সাহায্য করবে।
- Actual listing ও availability-এর ভিত্তিতে উত্তর দেবে।

Seller AI

- Customer support automation।
- Product content generation।
- Order management assistance।
- Stock ও sales insights।
- অনুমতি-সম্মত customer follow-up।

দুটি AI একই trusted product catalogue ও relevant business data ব্যবহার করতে পারবে, কিন্তু access control ও privacy আলাদা থাকবে।

H. Payment ও Transaction

Status: Core requirement; exact provider/integration pending

- Product price ও order total backend থেকে নির্ধারিত হবে।
- Checkout-এর সময় stock ও price revalidate হবে।
- Duplicate order এবং overselling প্রতিরোধ করতে হবে।
- bKash, Nagad, card বা অন্যান্য payment option-এর বর্তমান integration audit করতে হবে।
- Secure payment integration ও transaction status validation প্রয়োজন।
- Escrow বা wallet system প্রথম MVP-তে বাধ্যতামূলক নয়।

I. Future Marketplace Expansion

Status: Long-term roadmap, not initial MVP

পরবর্তী পর্যায়ে বিবেচ্য:

- Digital products।
- Freelance gigs ও microservices।
- Wholesale buying/selling।
- Reseller ecosystem।
- Advanced subscriptions।
- Promoted listings ও advertising।
- More payment options।
- Advanced analytics।
- Android app distributed through Google Play Store।

এসব feature-এর সঠিক priority বাস্তব ব্যবহারকারীর চাহিদা, revenue potential এবং implementation cost অনুযায়ী নির্ধারণ করা হবে।

---

4. Technology & Architecture Decisions

Status: Recommended direction; final architecture requires repository audit

- TypeScript-ভিত্তিক maintainable codebase-এর দিকে অগ্রসর হওয়া।
- Future Android app-এর জন্য React Native + Expo বিবেচনা।
- Firebase Authentication ও Firestore বর্তমান backend হিসেবে উপযুক্ত কি না audit করা।
- প্রয়োজন অনুযায়ী Firebase Storage।
- Web ও mobile-এ shared types, validation এবং business logic।
- Web-এর SEO ও shareable product/store pages বিবেচনা করে architecture নির্বাচন।
- Existing application একবারে rewrite না করে staged migration।

সম্ভাব্য architecture:

1. React Native + Expo web/mobile shared application।
2. Web-এর জন্য Next.js/TypeScript এবং Android-এর জন্য Expo, shared backend ও common packages।

চূড়ান্ত সিদ্ধান্ত নেওয়ার আগে current repository, Firebase security rules, deployment, migration cost এবং SEO requirements পরীক্ষা করতে হবে।

---

5. MVP বনাম Future Scope

Initial MVP-তে অগ্রাধিকার

1. Existing codebase audit।
2. Authentication ও seller onboarding।
3. Product catalogue ও store page।
4. Shareable store/product links।
5. Order management।
6. Inventory ও checkout correctness।
7. Security ও data integrity।
8. Real seller validation।

AI rollout

AI Shopping Assistant-এর product direction এখন নির্ধারিত হয়েছে, কিন্তু এটিকে core MVP-তে অন্তর্ভুক্ত করা হবে নাকি পরবর্তী release-এ—তা এখনো চূড়ান্ত নয়।

Calculator দিয়ে একটি ছোট pilot design ও test করা হবে।

Seller AI/WhatsApp chatbot-ও Pro product direction-এর অংশ; final rollout phase, quotas ও pricing এখনো নির্ধারিত নয়।

প্রথম MVP-তে ডিফল্টভাবে বাদ

- Full digital downloads marketplace।
- Full gigs/microservices marketplace।
- Wholesale/reseller ecosystem।
- Complex wallet/escrow।
- Unverified courier automation।
- অতিরিক্ত জটিল subscription architecture।

এসব ভবিষ্যতে আলাদা decision নিয়ে যোগ করা যাবে।

---

6. Why Bazare? — Differentiation Hypothesis

Facebook, Daraz ও অন্যান্য marketplace থাকা অবস্থায় Bazare কেন ব্যবহার করবে—এটি আমাদের প্রধান business question।

প্রাথমিক hypothesis:

"Facebook-এ বিক্রি করুন আগের মতোই—কিন্তু আপনার পণ্য, অর্ডার, স্টক ও ব্যবসার হিসাব রাখুন এক জায়গায়।"

সম্ভাব্য পার্থক্য:

- ছোট ব্যবসায়ীদের জন্য সহজ mini-store।
- Shareable store ও product links।
- গোছানো order ও stock management।
- AI-assisted product discovery।
- Pro seller-এর জন্য customer-service automation।
- ভবিষ্যতে marketplace ও business tools-এর সমন্বয়।

এগুলো এখনো market-validated competitive advantage নয়। বাস্তব seller interview, pilot usage, repeat usage ও willingness-to-pay দিয়ে যাচাই করতে হবে।

---

7. Business Model — Proposed

সম্ভাব্য revenue streams:

- Seller Pro subscription।
- Sale commission।
- Promoted listings/ads।
- ভবিষ্যতে digital services/gigs-এর service fee।

Free বনাম Pro feature limits, commission rate, subscription price এবং payment cost এখনো final নয়।

Validation targets

- 15–20 জন seller-এর interview।
- 5–10 জন seller নিয়ে ছোট pilot।
- Seller activation ও repeat usage মাপা।
- Order-management সমস্যার বাস্তব গুরুত্ব যাচাই।
- Pro features-এর জন্য অর্থ দিতে আগ্রহ যাচাই।

---

8. Decision Status Legend

- Approved direction: Product-এর মূল দিক হিসেবে সম্মত।
- Proposed: ভালো ধারণা, কিন্তু চূড়ান্ত অনুমোদন হয়নি।
- Pending: আরও তথ্য, cost analysis বা technical audit প্রয়োজন।
- Future: পরবর্তী phase-এর জন্য রাখা।
- Implemented: Code-এ বাস্তবায়িত এবং পরীক্ষা করা হয়েছে।
- Verified in production: Live production-এ পরীক্ষা করে নিশ্চিত করা হয়েছে।

কোনো feature-কে শুধু আলোচনা বা code উপস্থিত থাকার ভিত্তিতে Implemented বা Verified in production বলা যাবে না।

---

9. Update Protocol

প্রতিটি নতুন সিদ্ধান্তে নিচের তথ্য আপডেট করতে হবে:

- Decision ID।
- Feature name।
- আগের সিদ্ধান্ত।
- নতুন সিদ্ধান্ত।
- Status।
- কেন পরিবর্তন করা হলো।
- কোন phase-এ বাস্তবায়ন হবে।
- Dependencies ও খরচ।
- Implementation/test status।
- Last updated date।

পুরোনো সিদ্ধান্ত মুছে না দিয়ে পরিবর্তনের history রাখতে হবে, যাতে ভবিষ্যতে বোঝা যায় কেন সিদ্ধান্ত বদলেছিল।

Master principle: Bazare-কে একবারে বিশাল platform বানানোর চেষ্টা নয়; প্রথমে বাস্তব সমস্যার কার্যকর সমাধান, তারপর প্রমাণের ভিত্তিতে ধাপে ধাপে সম্প্রসারণ।

---

10. Engineering cross-reference (added by the engineering side, 22 October 2026)

এই section টা document-এর original অংশ না — এটা এখন পর্যন্ত repo-তে যা বাস্তবে আছে তার সাথে মিলিয়ে দেখার জন্য যোগ করা হলো, যাতে উপরের sign-off গুলো code-এর বাস্তবতার থেকে আলাদা হয়ে না যায়। বিস্তারিত: `docs/01-audit.md` – `docs/04-ai-search.md`, `docs/DEPLOYMENT.md`।

| Section-এর feature | বাস্তব status | প্রমাণ |
|---|---|---|
| A. Core marketplace (catalogue, order flow) | Implemented; checkout ও stock Verified in production (`/p/<id>` function আসলে Firestore থেকে data আনছে) | `api/_lib/orders-service.ts`, emulator tests, 22 Oct production check |
| B. Automatic mini store (`/s/<slug>`) | Not implemented | কোনো `stores` collection বা route নেই |
| C. Shareable product link (`/p/<id>`, OG tags) | Implemented, Verified in production | `api/share-product.ts`; production 404-check পাস করেছে |
| C. Shareable **store** link, dashboard-এ "Share" button | Not implemented | — |
| D. Seller dashboard (product/stock/order CRUD) | Implemented; rules-level authorization Verified (emulator) | `firestore.rules`, `seller-dashboard.html` |
| D. Seller analytics/insights | Not implemented | — |
| E. AI Shopping Assistant (calculator pilot) | Implemented, feature-flagged **off** in production (`AI_SEARCH_ENABLED` unset); কোনো real calculator listing নেই | `docs/04-ai-search.md`, `packages/domain/src/search/*` |
| F. Seller Pro / WhatsApp chatbot | Not started | এই roadmap-এ প্রথমবার লেখা হলো |
| G. Buyer AI vs Seller AI | Buyer AI (calculator pilot) আংশিক implemented, off; Seller AI not started | — |
| H. Payment/checkout integrity (price/stock revalidation, no duplicate/overselling) | Implemented, Verified (emulator: concurrent-order test; production: order flow pending real test) | `api/_lib/orders-service.ts` tests |
| I. Future marketplace expansion | Future, এখনো শুরু হয়নি | — |

Open gaps against this roadmap that the current branch does **not** cover: mini-store pages (B), store-level share links (C), seller analytics (D), Pro subscription/WhatsApp AI (F, G-seller). পরের phase-এ এগুলোর মধ্যে priority ঠিক করা দরকার।
