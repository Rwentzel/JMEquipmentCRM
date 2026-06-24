# PRODUCTION READINESS CHECKLIST — JM Equipment Parts Store

**Date:** 2026-06-23 · **Status:** Sandbox. Not launch-approved.
Legend: ✅ done · 🟡 partial · ⬜ not started · 🔒 blocked on approval/policy

> This is a gate list for moving from sandbox to a public B2B parts store. Items
> marked 🔒 require a JM business decision or external integration and must not be
> actioned without explicit approval.

---

### 1. Data sanitation
- ✅ Data model excludes vendor/cost/margin/bin/supplier/QuickBooks fields
- ⬜ Build-time allowlist sanitizer + test before any real catalog import
- ⬜ Review every field of the real Parts Master before it enters the web tier

### 2. Product data verification
- 🟡 Demo data only (15 SKUs); ⬜ verify real SKUs, descriptions, categories with JM
- ⬜ Confirm machine families and customer-safe descriptions

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
- 🟡 All prices labeled "budgetary, confirmed in writing"
- 🔒 Decide which items show price vs. "Call for Price" / quote-only
- ⬜ Source pricing from system of record with "as-of" dating

### 8. Inventory policy
- 🟡 Static availability labels (indicative)
- 🔒 Decide live vs. indicative stock; integrate source later

### 9. Quote policy
- ✅ Request list = written-quote request, clearly stated (not a binding order)
- ⬜ Real delivery of quote requests (email/CRM) — currently a stub
- ⬜ SLA wording for response time

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
- ⬜ Terms of Sale, budgetary-price disclaimer, compatibility disclaimer pages
- 🔒 Legal review

### 16. Privacy policy
- ⬜ Privacy policy page; ⬜ data-handling statement for quote-form submissions

### 17. Accessibility
- 🟡 focus-visible, reduced-motion, alt text, semantic landmarks
- ⬜ Keyboard-focusable nav, mobile menu, ARIA on interactive controls, WCAG 2.1 AA contrast audit

### 18. SEO
- ✅ Per-page metadata/titles; ✅ `noindex` while sandbox
- 🔒 Flip to indexable only at launch; ⬜ sitemap/robots for production

### 19. Analytics
- ⬜ Privacy-respecting analytics (none today); 🔒 choose vendor + consent posture

### 20. Backups
- ⬜ Source data versioned in git (✅ for demo data); ⬜ backup plan for real catalog + submissions store

### 21. Admin workflow
- ⬜ Internal review of incoming quote requests (no admin surface yet)
- ⬜ Catalog update process

### 22. Staff training
- ⬜ Parts-desk runbook for handling web quote requests
- ⬜ Content-update guide (data files / future CMS)

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

## Engineering gates (already green in sandbox)
- ✅ `npm run typecheck` — 0 errors
- ✅ `npm run lint` — clean
- ✅ `npm run build` — 12 routes, 6 SSG machine pages
- ✅ SSR + quote API smoke-tested (422 invalid / 200 valid)
- ⬜ Automated tests (data-protection + API validation)
- ⬜ Security headers / CSP
- ⬜ `npm audit` review to zero actionable advisories
