# PRODUCTION READINESS CHECKLIST — JM Equipment Parts Store

**Date:** 2026-07-16 (updated) · **Status:** Engineering launch-ready; awaiting JM business sign-offs (§25).
Launch is one switch: build with `JME_LAUNCH=live` — see `LAUNCH.md` for the go-live runbook.
Legend: ✅ done · 🟡 partial · ⬜ not started · 🔒 blocked on approval/policy

> This is a gate list for moving from sandbox to a public B2B parts store. Items
> marked 🔒 require a JM business decision or external integration and must not be
> actioned without explicit approval.

---

### 0. RFQ-first gates (implemented + verified in sandbox)
- ✅ No public sell prices anywhere (parts grid, request list, compare, configurator)
- ✅ No exact inventory quantities — only the 7 status bands (`StatusBand` component)
- ✅ Status bands limited to: In Stock · Limited Stock · Backorder · Call for Availability · Quote Required · Freight Quote Required · Discontinued / Contact JM
- ✅ RFQ-first CTAs (Request Quote / Call / Freight / Backorder / Contact); no public Buy Now
- ✅ Quote API: honeypot + rate-limit + no PII logging + safe ref + generic responses (smoke-tested: 200/422/429/silent-honeypot)
- ✅ `app/robots.ts` (Disallow: /) + security headers in `next.config.mjs`
- ✅ Build-output grep clean (old price numbers absent; "price" only in prose + sanitizer guard list)

### 1. Data sanitation
- ✅ Data model excludes vendor/cost/margin/bin/supplier/QuickBooks fields
- ✅ `sanitize.ts` allowlist + forbidden-key guard (enforced; `catalogBoundary` tests)
- ✅ Real Parts Master imported via `scripts/generate-public-catalog.py` (public-safe fields only; vendor names scrubbed)

### 2. Product data verification
- ✅ Real catalog (2,100+ JME web-ref SKUs, generated) + real Goodstrong 1600E manual data (S/N 37422 catalogue)
- 🟡 Spot-verify descriptions/categories with JM as orders come in

### 3. Public / internal data separation
- ✅ Only public fields modeled and rendered
- ⬜ Document the public-field allowlist as policy; enforce in code review

### 4. Vendor / cost / margin protection
- ✅ None present in repo
- 🔒 Confirm no internal export feeds the web build pipeline

### 5. SKU / title / category cleanup
- ⬜ Normalize SKU formatting; ⬜ dedupe; ⬜ finalize category taxonomy (5 demo categories today)

### 6. Image readiness
- 🟡 Branded placeholder in place; ⬜ approved product photography pipeline (no stock/unapproved images)
- ⬜ Alt-text policy for every product image

### 7. Pricing policy
- ✅ **RFQ-first: no public prices** (supersedes the budgetary-price build)
- 🔒 Decide if/when any price is ever shown publicly (requires explicit pricing policy)
- ⬜ Source any future pricing from system of record with "as-of" dating (internal/quote tier only)

### 8. Inventory policy
- 🟡 Static availability labels (indicative)
- 🔒 Decide live vs. indicative stock; integrate source later

### 9. Quote policy
- ✅ Request list = written-quote request, clearly stated (not a binding order)
- ✅ Real delivery: env-gated SMTP email to the desk (`lib/mail.ts`) + persistent `/ops` inbox + CSV export
- ✅ SLA wording on the storefront ("replies in writing — typically the same business day")

### 10. Freight policy
- 🟡 "FOB Sturgis, MI" shown; `freight-quote` purchase path modeled
- 🔒 Freight policy page; block blind checkout on oversized/freight-heavy items

### 11. Rush fee policy
- ⬜ Disclose rush terms before order submission. Reference schedule (for future use):
  under $500 → $50 · $500–1,000 → $100 · $1,000–2,000 → $200 · $2,000–5,000 → $350 · over $5,000 → 10%
- 🔒 Confirm schedule is current before implementing

### 12. PO terms policy
- ⬜ Approved-customer PO terms; 🔒 B2BKing-style account groups

### 13. Tax-exempt policy
- ⬜ Tax-exempt application + approval workflow; ⬜ exemption certificate storage
- 🟡 Copy notes "Tax per ship-to jurisdiction on final invoice"

### 14. Customer account approval
- ⬜ Guest browse vs. approved-account visibility rules (guest-only today)
- 🔒 Define what guests may/may not see

### 15. Terms / disclaimers
- 🟡 Terms of Sale, Freight & Shipping policy pages (sandbox drafts; `/terms`, `/freight`)
- ⬜ Compatibility disclaimer page
- 🔒 Legal review of all policy pages before launch

### 16. Privacy policy
- 🟡 Privacy policy page (sandbox draft; `/privacy`); data-handling statement included
- 🔒 Legal review before launch

### 17. Accessibility
- 🟡 focus-visible, reduced-motion, alt text, semantic landmarks
- ⬜ Keyboard-focusable nav, mobile menu, ARIA on interactive controls, WCAG 2.1 AA contrast audit

### 18. SEO
- ✅ Per-page metadata/titles; ✅ gated by default
- ✅ One-switch launch: `JME_LAUNCH=live` flips robots.txt AND every public page's meta robots (`pageRobots()`); /ops stays noindexed; sitemap published
- 🔒 Setting the switch remains a JM decision

### 19. Analytics
- ⬜ Privacy-respecting analytics (none today); 🔒 choose vendor + consent posture

### 20. Backups
- ⬜ Source data versioned in git (✅ for demo data); ⬜ backup plan for real catalog + submissions store
- ✅ PII retention tooling: `npm run retention -- --days N [--apply]` archives + purges old **closed** RFQs (open work never touched; dry-run default; tested) — JM picks the window (§25)

### 21. Admin workflow
- ✅ `/ops` desk: RFQ inbox with lifecycle statuses, CSV export, triage/maintenance/security agents
- ✅ Catalog update: regenerate `partsCatalog.ts` from the Parts Master (see LAUNCH.md)

### 22. Staff training
- ✅ Runbook: `LAUNCH.md` (env vars, deploy, smoke test, go-live, ongoing ops)
- ✅ Content-update guides: parts-store README (Goodstrong manual data + catalog regeneration)

### 23. WooCommerce migration
- 🟡 Clean SKU-keyed data model eases mapping
- ⬜ Mapping spec: products/variations, B2BKing groups, purchase paths → Woo

### 24. QuickBooks sync
- 🔒 QuickBooks Desktop Enterprise 2024 remains source of truth
- ⬜ Define SKU join + sync tool (e.g., Webgility) scope; do not connect live yet

### 25. Launch approval
- 🔒 Explicit JM sign-off required before: deploy, indexable SEO, live integrations, payments
- ⬜ Pre-launch checklist sign-off (this document) by JM stakeholder

---

## Engineering gates (green — re-verified 2026-07-16 on Next 16 / React 19)
- ✅ Deployable: `output: standalone` + `parts-store/Dockerfile` (non-root, healthcheck, `.data` volume, `JME_LAUNCH` build arg)
- ✅ Launch switch covers every public page (`pageRobots()`), not just the root layout — regression-tested
- ✅ Goodstrong manual diagram parts orderable through the quote API (allowlist regression test)
- ✅ `npm run typecheck` — 0 errors
- ✅ `npm run lint` — clean
- ✅ `npm run build` — 16 routes incl. 6 SSG machine pages, 3 policy pages, robots.txt, 404
- ✅ SSR + quote API smoke-tested (422 invalid / 200 valid / 429 rate-limit / honeypot)
- ✅ Automated tests (`npm test`) — 12 passing: data-protection allowlist + RFQ validation
- ✅ Security headers / CSP in `next.config.mjs` (tighten CSP with nonces before prod)
- ✅ Premium metadata + OpenGraph/Twitter + LocalBusiness JSON-LD
- ✅ Accessibility baseline: skip link, focusable nav, mobile menu, ARIA, aria-live, reduced-motion
- ✅ 404 (`not-found.tsx`) + loading (`loading.tsx`) states
- ✅ `npm audit`: **0 vulnerabilities** (postcss override + brace-expansion patch); audit now gates CI on every push/PR (`--audit-level=moderate`)
- ⬜ Full WCAG 2.1 AA contrast audit
