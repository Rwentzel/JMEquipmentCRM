# JME Platform — Build Prompt

Owner ruling (2026-09-10): **build both tracks, full scope.** Every screen, every item, every function in this package ships. Optimise for three things, in order: fast to load, easy to use, drives online ordering (request-list submissions to the parts desk).

## Rulings that resolve the open questions

1. **Track A and Track B both proceed.** The Next.js app (`parts-store`, `Rwentzel/JMEquipmentCRM` main) stays the customer platform and is brought to parity with the nine design references. The WordPress/WooCommerce track (`deploy/REPLICATION.md`, `wp-theme/jme-child/`) is built as described so JME has a CMS-hosted storefront with the same screens. Both consume the same catalog and the same Worker.
2. **Catalog truth = the full catalog. All items.** Serve every part the QuickBooks export contains (2,223 today), not the 1,887-row remediated subset. Keep the seven status bands as the customer-facing availability vocabulary; map the three QuickBooks bands onto them (Stage A of `REPLICATION.md` documents the band definitions). The 10 HOLD SKUs remain listed but RFQ-only with the "Quote Required" band until Seth's rulings land. Nothing is dropped from the catalog for pricing reasons — pricing never displays anyway.
3. **Part numbers / MPNs: source-of-record only.** Every SKU, part number, and manufacturer part number shown must exist in QuickBooks or a factory manual/catalogue (Goodstrong S/N 37422 catalogue, Martin, RollRite, JME drawings). No invented, placeholder, or custom-coined part numbers on any surface — including configurator option SKUs, manual bubble rows, demo data, and test fixtures that could leak to a customer view. Where a manual section has no transcribed part list, say so (existing rule); never fill the gap. Configurator options that have no real SKU are labelled by description and route to "Ask about fitment" rather than carrying a made-up code. Add a build gate: every part number in the shipped catalog and in the design-data files resolves to a QuickBooks item or a cited manual page.
4. **Pricing:** none, anywhere. RFQ-first stands (DEC-038, `DATA_BOUNDARIES.md`). No price, cost-per-unit, margin, vendor, bin or exact quantity.
5. **Reorder paths:** every machine type and every part routes to the request list → parts desk. No direct checkout. "Online ordering" means the request list is fast to fill and fast to send, with the reference number and the three routes (email / call / print) plus the Worker POST when `endpoint` is set.

## Scope — all nine screens, both tracks

Design references: `standalone/*.html` (offline, high-fidelity, copy final). Per-screen behaviour and state are specified in `README.md`. Build order is by ordering impact:

1. **Request List** — the conversion surface. Qty stepper, contact block, Email/Call/Print, Worker POST, reference, honesty line, `?reorder=` and `?parts=` links (already live in Track A; port to Track B).
2. **Catalog** — all items, search on name/SKU/category/family/keywords (symptom keywords included: the repo's `catalog.ts` has them; ship them now, not Phase 4), machine grid, seven-band status, modal with Add to request.
3. **Storefront** — search-first hero handing off to the catalog as `?q=`; product-line cards; routes cards. Keep the "3× the cores" claim as the lead paragraph, search box above it.
4. **Machine Platform** — machine rail, fitment guard, honest empty states, "Running something else?" band.
5. **Machine Detail (Configurator)** — all nine machines. Option choices are descriptive only (no coined option codes); the request-list item carries the real model number as `sku` and the chosen options as `configLabel` text. `options[]` stays empty until real option part numbers exist in QuickBooks.
6. **Goodstrong Manual** — S/N 37422 sections, exploded-view bubbles → parts table → Add; serial lookup.
7. **Support Hub** — six typed request forms → Worker `request_type`; `?panel=` deep links.
8. **RFQ Flow** — explainer; add the five `faq.ts` entries (incl. 2:30 PM ET same-day ship cutoff) to its FAQ accordion.
9. **Governance Console** — internal, behind Cloudflare Access, `noindex`. Update the Catalog status view counts to the full-catalog figures.

## Track A — Next.js (`parts-store`)

- Bring each live route to the design reference layout and copy. Where the live app already has the capability (Machine Detail, Manual, Request List), this is a visual pass; where it doesn't (Machine Platform, Support Hub, RFQ Flow), build the route.
- Keep everything tested: RFQ pipeline, security hardening, Quote Center, backups, 317 tests, a11y states. Add tests for each new route.
- Storage key: keep `jme_request_v2`; item shape `{sku, name, qty, origin?, options?, configLabel?, source}`.
- Performance gates: LCP < 2.5s on mobile, no client bundle growth from the design system (tokens as CSS variables only, no runtime).

## Track B — WordPress / WooCommerce

- Follow `deploy/REPLICATION.md` Stages A–E and `deploy/LAUNCH.md`, with Stage A changed to export the **full** catalog (2,223 rows) from the QuickBooks export rather than the 1,887-row Excel subset. Update `test_regression.py` expectations accordingly (`--expect-sku-count` = full count, HOLD rows present but flagged Quote Required).
- Child theme `wp-theme/jme-child/`; YITH Request a Quote replaces Add to Cart; FiboSearch Pro for search; YITH submission wired to the Worker.
- Storage key `jme-request-list` in the theme JS (matches the design references); document the key difference from Track A.

## Shared

- **Worker** `deploy/worker/rfq-worker.js`: one deployment serves both tracks. Six `request_type`s, 422/429/honeypot paths, Resend to parts@jmequipment.net. Set `ALLOW_ORIGIN` for both hosts.
- **Design system**: tokens and component classes from `wp-theme/jme-child/assets/css/tokens/` and `README.md` → Design tokens. Never literal hex in markup.
- **Accessibility**: axe-clean on every shipped page; labels, `aria-modal`, `inert`, Esc, 44px targets.
- **Data boundaries**: scan every build artifact for price/cost/vendor/margin/bin/quantity language before deploy.
- **Part-number provenance**: fail the build if any SKU/MPN in `catalog.ts`, `details.ts`, `goodstrong.ts`, `partsCatalog.ts`, or the WooCommerce CSV is absent from the QuickBooks export and not cited to a manual page.

## Definition of done

Both tracks live on staging, all nine screens, full catalog served, request list submits to the Worker and the desk receives a referenced email, axe clean, performance gates met, LAUNCH.md gates E1 checked. Then Riley sign-off.
