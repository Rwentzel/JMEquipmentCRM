# JM Equipment — Parts Store (Sandbox)

A production-candidate sandbox for JM Equipment's industrial B2B parts storefront,
implemented from the JME Design System (Claude Design handoff bundle).

> **Sandbox only.** Not deployed, not indexable, no payments, no email/CRM,
> no QuickBooks/WooCommerce connection. See the governance docs at the repo root:
> `PROJECT_STATE_AUDIT.md`, `RISK_REGISTER.md`, `PRODUCTION_READINESS_CHECKLIST.md`.

## Stack
- Next.js 14 (App Router) · React 18 · TypeScript
- Fonts: Barlow Condensed (display), Barlow (body), JetBrains Mono (mono) via `next/font`
- Styling: design-system tokens as CSS custom properties (`src/styles/`)
- No database; the request list persists in `localStorage`

## Run
```bash
cd parts-store
npm install
npm run dev      # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`.

## Routes
| Route | What |
|-------|------|
| `/` | Storefront (hero, machines, parts, request list, trust, footer) |
| `/machine/[sku]` | Machine detail (configure, specs, related parts) — 6 SSG pages |
| `/compare` | Side-by-side machine comparison |
| `/api/quote` | Quote-request validation endpoint (sandbox stub) |

## Structure
- `src/components/ui/` — design-system primitives (Button, Badge, DataPlate, …)
- `src/data/` — `catalog.ts`, `details.ts`, `types.ts` (public-safe fields only)
- `src/hooks/` — request list, toast, reveal, scroll-spy
- `src/styles/` — tokens + base + component + page CSS

## Data protection
Only customer-safe fields exist in the data model (SKU, name, description, family,
public status, budgetary price, purchase path). There is intentionally **no** field
for vendor, cost, margin, bin location, supplier notes, or QuickBooks references.
