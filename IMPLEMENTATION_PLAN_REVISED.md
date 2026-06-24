# IMPLEMENTATION PLAN (REVISED) — JM Equipment Parts Store

**Date:** 2026-06-23 · **Mode:** RFQ-first sandbox · **Status:** documentation only; no app code changed.

> Supersedes the original price-bearing build. The storefront is **RFQ-first**:
> no public sell prices, no exact quantities. This document is the agreed build
> spec for the next phase, pending approval.

---

## 1. Confirmed current repo state
- Branch `claude/keen-meitner-a7p4ee`, clean tree.
- Base = legacy **Electron CRM** at repo root (untouched).
- `parts-store/` = Next.js 14.2.35 sandbox built this session (commit `8780d46`, **local only, not pushed**).
- No `feat/jme-parts-store-nextjs` branch; no commit `eef806e` (see `PROJECT_STATE_AUDIT.md`).

## 2. New build vs continuation
**Continuation / refactor** of the existing `parts-store/` app — revise in place to RFQ-first. Not a fresh app. Electron CRM is not modified.

## 3. Exact app structure
```
parts-store/src/
  app/          layout.tsx, globals.css, page.tsx,
                machine/[sku]/page.tsx, compare/page.tsx,
                api/quote/route.ts, robots.ts (new)
  components/ui/  Badge, Button, Callout, Card, DataPlate, Diamond, Eyebrow,
                  Field, SmartImg, SpecTable, StatBlock, StatusBand (new), Tag, Toast
  components/machine/  MachineDetailClient, CompareClient
  data/         types.ts, catalog.ts, details.ts, sanitize.ts (new)
  hooks/        useRequestList, useToast, useReveal, useScrollSpy
  lib/          utils.ts (remove public price formatting), rateLimit.ts (new)
  styles/       tokens.css, base.css, components.css, storefront.css, machine.css
  public/images/  placeholder.svg
```

## 4. Exact routes
| Route | Type | Notes |
|-------|------|-------|
| `/` | SSR/static | RFQ-first storefront |
| `/machine/[sku]` | SSG (6 pages) | Detail + configurator (no prices) |
| `/compare` | static | Status bands + specs, **no price column** |
| `/api/quote` | dynamic | Hardened RFQ intake (stub, no external email) |

## 5. Exact components
Existing DS set retained. **Add `StatusBand`** rendering one of the 7 allowed bands with its color. **Remove all price rendering** from the parts grid, request list (no subtotal), compare table, and machine configurator summary.

## 6. Public-safe data model
```ts
type RfqAction = 'request-quote' | 'call' | 'freight-quote' | 'backorder' | 'contact';
type StatusBand =
  | 'In Stock' | 'Limited Stock' | 'Backorder' | 'Call for Availability'
  | 'Quote Required' | 'Freight Quote Required' | 'Discontinued / Contact JM';

interface PublicPart   { sku; title; description; family; category; statusBand; action }
interface PublicMachine { sku; name; family; category; tagLabel?; statusBand; action; specs[]; blurb; photo? }
```
No `price`, `cost`, `qty`, `vendor*`, `oem*`, `bin`, `alias`, `qb*` fields anywhere in the public model.

## 7. Internal-only data model (NEVER shipped to client)
Documented in `DATA_BOUNDARIES.md`; absent from the repo:
`cost, sellPrice, margin, exactQty, vendorName, vendorPartNo, oemCrossRef(unapproved), internalAlias, wasPartNo, binLocation, supplierNotes, qbRef, customerSpecificPricing`.

## 8. Sanitization rules (`data/sanitize.ts`)
- `toPublicPart()/toPublicMachine()` allowlist functions returning **only** public fields.
- Dev-time guard that throws if any forbidden key is present on an input record.
- `normalizeBand(raw)` maps any raw status/lead-time string to one of the 7 bands.
- Components only ever receive sanitized objects.

## 9. RFQ-first CTA logic (by `action`)
- `request-quote` → **Request Quote** (adds to RFQ list)
- `freight-quote` → **Freight Quote** (adds, freight-flagged)
- `call` → **Call for Availability** (`tel:` link)
- `backorder` → **Backorder — Request**
- `contact`/`discontinued` → **Contact JM**
- **No Buy Now** publicly (needs a price → deferred until pricing policy approved).

## 10. Inventory status-band logic
Only the 7 bands. Mapping from current demo data: In Stock→In Stock; amber lead→Limited Stock/Backorder; consult→Quote Required; freight-heavy→Freight Quote Required; unknown→Call for Availability; EOL→Discontinued / Contact JM. **No exact counts, ever.**

## 11. Quote API hardening (`api/quote/route.ts`)
Server-side validation; required company/name/email; reject bad email; **honeypot** field reject; **in-memory per-IP rate limit** (`lib/rateLimit.ts`); **no PII logging** (counts/timestamps/ref only); **generic** success/failure responses; **safe reference** via `crypto.randomUUID()`; **no external email** (`// TODO: email backend via env vars only`).

## 12. Noindex / robots plan
Keep global + per-page `robots: { index:false, follow:false }`; add `app/robots.ts` → `Disallow: /`. Flip only at launch.

## 13. Security header plan
`next.config` `headers()`: CSP (self; styles allowed via Next), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, minimal `Permissions-Policy`.

## 14. Accessibility baseline plan
Focusable nav controls; skip-link; ARIA on request list / tweaks / configurator; visible focus (present); reduced-motion (present); labels (present); WCAG 2.1 AA contrast audit of muted-on-dark.

## 15. Verification plan
`typecheck` + `lint` + `build`; `npm start` smoke; **grep built client chunks + SSR HTML for `$`, price/cost/margin/vendor tokens and bare quantities** to prove no leak; API tests (missing→422, bad email→422, honeypot→generic, valid→200+ref, rate-limit trips). Confirm `robots.ts` + headers + focus order.

## 16. Stop gates before production
Real quote delivery; verified pricing/availability source; account approval / PO / tax-exempt; legal Terms/Privacy/freight/rush; a11y + headers complete; `npm audit` clean; approved photography; explicit JM launch sign-off; flip noindex.

## 17. What will NOT be done in this sandbox
No CRM edits; no push/deploy/remote without approval; no Resend/SMTP/Formspree/Stripe/WooCommerce/QuickBooks/Outlook/Gmail; no credentials; no live data; no public prices or exact quantities; no Buy-Now checkout.
