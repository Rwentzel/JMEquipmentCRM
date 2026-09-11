repo: Rwentzel/JMEquipmentCRM
branch: main
path: parts-store

## Last sync
date: 2026-09-10T00:00:00Z

### Updated in this project
- Owner rulings recorded in `handoff/BUILD_PROMPT.md`: both tracks (Next.js + WordPress) ship, full catalog (2,223 parts, seven bands, HOLD SKUs listed as Quote Required), no pricing, all paths route to the request list. Part-number rule (QuickBooks/manual numbers only): Machine Detail configurator no longer emits coined option codes; request items carry the real model number + descriptive `configLabel`, `options[]` empty. Standalone Machine Detail reference regenerated.

## Sync history
- 2026-09-03T19:31:00Z — - Machine Detail (Configurator) now covers all nine machines in `details.ts`: added the 1600-E, Guillotine Cutter, Automatic Splicer, and Decurler configurators (options, how-it-works, applications, proof, downloads). The Decurler carries its revised copy (multi-bar decurl, any width, any sheeter). Tab order follows `catalog.ts`.
- Catalog, Machine Platform, Storefront, Goodstrong Manual, and Request List were checked against `catalog.ts`, `goodstrong.ts`, `types.ts`, `useRequestList.ts`, and `validateQuote.ts` — no drift; nothing rebuilt.
- `faq.ts` (five public FAQ entries incl. the 2:30 PM ET same-day ship cutoff) has no matching screen here; not carried over.

## Screen map

| Screen | Source files |
|--------|--------------|
| JME Catalog (Repo-Driven).dc.html | `src/data/catalog.ts`, `src/data/types.ts`, `public/images/`, `public/brand/` |
| JME Machine Detail (Configurator).dc.html | `src/data/details.ts`, `src/lib/rfqConfig.ts`, `public/images/` |
| JME Goodstrong Manual (Diagrams).dc.html | `src/data/goodstrong.ts`, `src/components/machine/ManualIndex.tsx`, `src/components/machine/ExplodedViewer.tsx`, `src/components/machine/SerialLookupModal.tsx` |
| JME Machine Platform (Fitment-Guarded).dc.html | `src/data/catalog.ts` (machines + curated parts), `src/data/partsCatalog.ts`, `public/images/` |
| JME Request List (Persistent).dc.html | `src/hooks/useRequestList.ts`, `src/lib/validateQuote.ts`, `src/app/api/quote/route.ts` |
| JME RFQ Flow (Data-Driven).dc.html | `README.md`, `DATA_BOUNDARIES.md` |
| JME Support Hub.dc.html | `src/app/api/quote/route.ts` (typed request kinds), `src/lib/rateLimit.ts` |
| JME Storefront.dc.html | `src/app/page.tsx`, `src/data/catalog.ts` |
| JME Governance Console.dc.html | project-local (`redaction_allowlist.json`, `export_woocommerce.py`); no repo source |

- 2026-09-02T13:06:00Z — Linear Dancer added to Catalog and Machine Platform; RollRite and Linear Dancer configurators; Goodstrong `sectionsFrom` attribution; ghost-button contrast fix.
- 2026-08-17T12:02:29Z (commit f26df6e537b4) — Machine Platform built on the real `catalog.ts` machine set; Request List DEC-038 send panel; Goodstrong manual rebuilt on S/N 37422 catalogue; Catalog and Configurator rebuilt on real repo data; brand colors mapped to design-system tokens.
- 2026-08-14T19:00:27Z — Catalog, Configurator, and Goodstrong manual rebuilt on real repo data; brand colors mapped to design-system tokens.

## Not carried over (by design)
- Repo storage key moved to `jme_request_v2`; the design screens keep `jme-request-list` so the nine prototypes stay consistent with each other. The item shape (`origin`, `options`, `configLabel`) matches the repo contract.
- Parts search `keywords` (symptom terms) exist in `catalog.ts`; the Catalog screen's search still matches name/SKU/category only. Phase 4 symptom search will pick these up.
- Quote Center, ops, backup, and Fly deployment changes are internal tooling with no customer screen here.

## Data boundaries observed
No price, cost, margin, vendor, OEM cross-reference, bin location, or exact quantity appears on any surface.
Availability is expressed only through the seven approved status bands.
Manual content is transcribed from factory documents only; sections without a transcribed table say so rather than showing invented parts.

## App counterparts (2026-09-10)

Every reference screen has a route in the Next.js app; the designs stay the visual reference.

| Reference | App route |
|---|---|
| JME Storefront | `/` (search-first hero, `?q=` seeds the catalog) |
| JME Catalog | `/#parts` (the storefront's parts browser) |
| JME Machine Platform | `/machines` (`?m=SKU`) |
| JME Machine Detail — Configurator | `/machine/[sku]` |
| JME Goodstrong Manual | `/parts/goodstrong`, `/parts/goodstrong/[model]/[section]` |
| JME Request List | `/#request` (`?parts=`, `?reorder=`) |
| JME Support Hub | `/support` (`?panel=`, `?serial=`, `?sku=&machine=`) |
| JME RFQ Flow | `/how-quoting-works` |
| JME Governance Console | Track B only — it governs the import pipeline, which lives in `deploy/` |

## Launch gates the app runs itself (2026-09-11)

The handoff's E1 and Stage C gates have counterparts in `parts-store` that CI runs on every push (`.github/workflows/ci.yml`); LAUNCH.md and REPLICATION.md point at each.

| Gate (LAUNCH.md / REPLICATION.md) | App counterpart |
|---|---|
| Stage A regression tests (idempotence, NAME_FIX, HOLD flagged) | `npm run export:woocommerce` from the catalogue, then the handoff's own `test_regression.py` (8/8); `tests/woocommerceExport.test.ts` asserts two runs are byte-identical |
| Worker smoke tests (422/200/429/honeypot, per type) | `tests/rfqWorker.test.ts` drives `deploy/worker/rfq-worker.js` in-process with KV and Resend stubs; all six `request_type`s, the comma-separated `ALLOW_ORIGIN` list, Resend failure |
| Stage C zero-console-error | `npm run smoke` fails on any console error across 11 browser flows |
| Stage C axe | `npm run a11y` — WCAG 2.2 AA + axe best-practice over 27 page states, including the staff surfaces and a minted customer quote link, plus 44 px tap targets on every customer route in a phone touch context |
| Stage C RFQ flow | smoke flows: storefront request → `RFQ-` reference → ops inbox; Support Hub request → `REQ-`; configurator ids never reach a screen |
| Fuzz harness (3+ seeds × 140 steps) | `npm run fuzz -- <base> --seeds=3 --steps=140` — seeded random walks over customer and staff surfaces, replayable by seed |
| Data-boundary scan of build artifacts | `npm run verify:bundles` (client bundles) and `npm run scan:artifacts` (every rendered customer page); the maintenance agent sweeps every catalog record |
| Part-number provenance | `tests/provenance.test.ts`, `tests/optionIdGate.test.ts`, `tests/publicNames.test.ts`; the QuickBooks resolution stays a release-time step with the private workbook |
| Performance (LCP < 2.5 s mobile) | `npm run lcp` on the slow-4G, 4× CPU profile; gates CI |
| Design tokens shared across tracks | `tests/tokenParity.test.ts` pins every colour token shared with `wp-theme/jme-child/assets/css/tokens/colors.css`; `tests/noHexInMarkup.test.ts` keeps hex out of markup |

Still owner-side: the WordPress host and the Stage B–E steps on it, `wrangler deploy` with the four secrets, Fly's `FLY_API_TOKEN`, the GitHub Pages setting for the preview, Riley's sign-off, and Seth's five price rulings.
