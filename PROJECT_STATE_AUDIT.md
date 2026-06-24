# PROJECT STATE AUDIT — JM Equipment Parts Store

**Date:** 2026-06-23
**Scope:** Sandbox build only. Not approved for production, deployment, or live integrations.

> **Reconciliation note.** A prior brief referenced an existing Next.js app at
> commit `eef806e` on branch `feat/jme-parts-store-nextjs`. That state did **not**
> exist in this repository — the repo contained only the legacy Electron CRM plus
> an uploaded Claude Design bundle. The Parts Store described below was built fresh
> in this session under `parts-store/`. Figures here describe what is actually in
> the tree, not the earlier reported state.

> **RFQ-first revision.** The first build exposed budgetary prices publicly. That
> is being revised to **RFQ-first** (no public prices, no exact quantities, status
> bands + Request-Quote/Call/Freight/Backorder CTAs). See `IMPLEMENTATION_PLAN_REVISED.md`,
> `DATA_BOUNDARIES.md`, and `SECURITY_NOTES.md`. References to public prices in §8/§11
> below describe the **as-built** state being superseded.

## 0. Raw reconciliation outputs
```
$ pwd
/home/user/JMEquipmentCRM
$ git status            → On branch claude/keen-meitner-a7p4ee · clean
$ git branch --show-current → claude/keen-meitner-a7p4ee
$ git branch --all      → claude/keen-meitner-a7p4ee · main · origin/claude/keen-meitner-a7p4ee · origin/main
$ git log -5 --oneline  → 8780d46 feat(parts-store)… · d342281 · 33d5749 · 2f144c2
$ git remote -v         → origin  http://local_proxy@127.0.0.1/git/Rwentzel/JMEquipmentCRM (fetch & push)
$ ls                    → .github .gitignore *.html *.txt PROJECT_STATE_AUDIT.md RISK_REGISTER.md
                          PRODUCTION_READINESS_CHECKLIST.md index.html main.js main.jsx package.json parts-store/
$ git cat-file -t eef806e → fatal: Not a valid object name (NOT FOUND)
$ git branch --all | grep feat/jme-parts-store-nextjs → (0 matches)
```
**Answers:** (1) `feat/jme-parts-store-nextjs` present? **No.** (2) `eef806e` present? **No.**
(3) Existing Next.js app? **Only `parts-store/` from this session** (`8780d46`). (4) Base? **Electron CRM.**
(5) Design source? `/root/.claude/uploads/57daaf12-…/` (bundle) + scratchpad `ds_src/`.
(6) Data files? `parts-store/src/data/catalog.ts` & `details.ts` (originals embedded in `_ds_bundle.js`).
(7) Missing? Original CSS rule files; real photography; price exposure to remove. (8) Assumptions: see foot of doc.

---

## 1. Current branch and commit
- **Branch:** `claude/keen-meitner-a7p4ee`
- **Base commit at start:** `d342281` (`ci: validate triggers and cleanup`)
- **Remote:** `origin` (GitHub `rwentzel/jmequipmentcrm`). Per instruction, nothing deployed.

## 2. Current app stack
Two independent apps now live in the repo:

| App | Location | Stack | Status |
|-----|----------|-------|--------|
| Legacy CRM | repo root (`index.html`, `main.js`) | Electron 16 + vanilla JS + localStorage | Untouched |
| **Parts Store** | `parts-store/` | **Next.js 14.2.35 (App Router) · React 18.3 · TypeScript 5.4** | **New (this session)** |

The Parts Store is self-contained: its own `package.json`, `node_modules`, and build. The Electron CRM is unchanged.

## 3. Full route map (Parts Store)
| Route | Type | Purpose |
|-------|------|---------|
| `/` | Static (SSR/hydrated) | Storefront: hero, machines, industries, parts, services, request list, trust, footer |
| `/machine/[sku]` | SSG (6 pages prerendered) | Machine detail: overview, configure, how-it-works, specs, applications, related parts, resources |
| `/compare` | Static | Side-by-side machine comparison |
| `/api/quote` | Dynamic (server) | Quote request validation endpoint (sandbox stub — no email/payment/db) |

Prerendered machine pages: `JME-VCS12-75`, `GMC-TCII-1650`, `MRS-72`, `JME-GC-52`, `JME-AS-08`, `JME-DC-04`.

## 4. File/folder tree summary (`parts-store/src`)
```
app/            layout.tsx, globals.css, page.tsx (storefront),
                machine/[sku]/page.tsx, compare/page.tsx, api/quote/route.ts
components/ui/  Badge, Button, Callout, Card, DataPlate, Diamond, Eyebrow,
                Field, SmartImg, SpecTable, StatBlock, Tag, Toast (+ index barrel)
components/machine/  MachineDetailClient, CompareClient
data/           types.ts, catalog.ts, details.ts
hooks/          useRequestList, useToast, useReveal, useScrollSpy
lib/            utils.ts (cn, usd, asset, purchasePathLabel)
styles/         tokens.css, base.css, components.css, storefront.css, machine.css
public/images/  placeholder.svg
```

## 5. Source data files
- `src/data/catalog.ts` — contact info, 6 machines, 9 parts, 5 categories.
- `src/data/details.ts` — per-machine deep content (options, how-it-works, specs, proof, downloads) for all 6 machines.
- `src/data/types.ts` — TypeScript contracts (public-safe by construction).

## 6. Number of SKUs loaded
- **15 total:** 6 machines + 9 parts.

## 7. Fields present in the parts/machine data
Machines: `sku, name, family, tag, tagLabel, status, statusLabel, photo, fit, blurb, specs[], purchasePath`.
Parts: `sku, name, cat, price, status, statusLabel, purchasePath`.
Details: `tagline, lead, heroStats, badge, gallery, basePrice, options[], how[], apps[], proof, partsCat, downloads[]`.

## 8. Public-facing fields
All fields currently stored are public-safe: part number (SKU), name, description/blurb, family/category, public status label, budgetary price, general specs, purchase path. These are the only fields rendered.

## 9. Internal-only fields
**None present.** The data model deliberately omits vendor name, vendor part number, OEM cross-reference, cost, margin, markup, bin location, supplier notes, QuickBooks references, customer-specific pricing, and reorder notes. See `RISK_REGISTER.md` §1.

## 10. Currently unused fields
- `Machine.family` is used on detail/compare pages but not on the storefront grid.
- `purchasePath` is modeled and labeled (`lib/utils.purchasePathLabel`) but the storefront currently routes everything through the request list; per-path CTAs (Buy Now vs Quote vs Freight) are a planned enhancement.

## 11. Potentially sensitive fields
None in the dataset. The only sensitive-by-context value is `basePrice` (budgetary machine pricing) — it is labeled "budgetary/indicative only" everywhere it appears and excludes cost/margin.

## 12. Current quote API behavior
`POST /api/quote` validates server-side: company/name/email required, email format checked, every line-item SKU must exist in the catalog, qty ≥ 1. Returns `422` with the first error on failure, `200` with a generated reference (`R-…`) on success. **It does not send email, charge, or persist** — intentional sandbox stub.

## 13. Current form validation behavior
Client: request-list quantities clamp to ≥ 1; "Send request" disabled when the list is empty. Server: authoritative validation in the API route (above). No inline field-level error UI yet (toast surfaces the first server error).

## 14. Current SEO/SSR behavior
All pages server-render; machine pages are statically generated (SSG). `robots: { index: false, follow: false }` is set globally and per-page — the sandbox is intentionally **non-indexable** until launch approval.

## 15. Accessibility concerns
Good: semantic landmarks, focus-visible ring, `prefers-reduced-motion` honored, alt text on images. Gaps: nav "jump" links are `<a>` without `href` (not keyboard-focusable); color-contrast of muted text on dark needs a WCAG audit; the Tweaks panel and request controls need fuller ARIA. Tracked in `RISK_REGISTER.md` §8.

## 16. Mobile/responsive concerns
Breakpoints at 1024px and 760px collapse grids to 1–2 columns; primary nav links hide on mobile (no hamburger yet). Compare table scrolls horizontally. Design target viewport is 1280px.

## 17. Security/privacy concerns
No secrets in the repo. No external network calls from the client except same-origin `/api/quote`. No analytics/trackers. Transitive npm advisories remain (see §22). Legacy Electron CRM uses `nodeIntegration:true` / `contextIsolation:false` (pre-existing, out of scope here).

## 18. Performance concerns
First-load JS ≈ 88–96 kB/route (reasonable). Images are unoptimized (`next.config` `images.unoptimized`) because the sandbox ships no real photography. No heavy client libraries added.

## 19. Visual/design weaknesses
CSS was **reconstructed** from the design-system token values + component class structure (the bundle shipped JS + tokens but not the original CSS rule files). It is faithful but not guaranteed pixel-identical to the original mockups; a side-by-side review pass is recommended. No real product photography (branded placeholders used).

## 20. WooCommerce migration readiness
Clean separation of data (`data/*.ts`) from presentation eases a future WooCommerce/B2BKing port: SKUs, categories, status, and purchase paths map to Woo products/variations and B2BKing customer-group rules. No Woo coupling exists yet.

## 21. QuickBooks compatibility readiness
No QuickBooks coupling. SKUs are the natural join key to QuickBooks Desktop Enterprise items; pricing remains budgetary/public-only, keeping cost/margin out of the web tier (correct for a future Webgility-style sync).

## 22. Commands — pass/fail
| Command | Result |
|---------|--------|
| `npm install` | ✅ pass |
| `npm run typecheck` (`tsc --noEmit`) | ✅ pass (0 errors) |
| `npm run lint` (`next lint`) | ✅ pass (0 warnings/errors) |
| `npm run build` (`next build`) | ✅ pass (12 routes, 6 SSG machine pages) |
| `npm start` smoke test | ✅ SSR verified; API 422/200 verified |
| `npm audit` | ⚠️ transitive advisories remain (Next pinned to patched 14.2.35; others are dev/transitive) |

## 23. Assumptions made
1. Next.js App Router + TypeScript is the intended stack (matches the SSR/SSG brief).
2. The design bundle's data is customer-safe demo data (it contains only public fields).
3. No real product photos should be invented — branded placeholders used pending approved imagery.
4. CSS reconstructed from documented tokens is acceptable where original rule files were absent.
5. The legacy Electron CRM is out of scope and must not be modified.

## 24. Liabilities if this went live as-is
- Budgetary prices could be read as firm quotes → mitigated with explicit "budgetary, confirmed in writing" copy, but legal review needed.
- No real Terms/Privacy/freight/tax policy pages yet.
- No account approval / PO-terms / tax-exempt gating (guest-only today).
- Quote API does not actually deliver requests anywhere (stub) — would silently drop real customer requests.
- Accessibility and responsive gaps (§15–16).
- See full register in `RISK_REGISTER.md`.

## 25. Recommended next phases
1. Per-path CTAs (Buy Now / Request Quote / Call / Freight Quote) driven by `purchasePath`.
2. Real quote delivery (email/CRM) behind approval — keep sandbox until then.
3. Account approval, PO terms, tax-exempt gating (B2BKing-aligned).
4. Legal: Terms, Privacy, freight/rush/tax disclaimers.
5. Accessibility + responsive hardening (focusable nav, mobile menu, contrast audit).
6. Approved product photography pipeline.
7. Visual QA pass vs. original mockups.
8. WooCommerce/QuickBooks data-mapping spec.
