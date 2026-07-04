# JM Equipment — Parts Store (MVP)

A production-candidate MVP for JM Equipment's industrial B2B parts storefront —
RFQ-first front end, a hardened quote back end with a persistent ops inbox, and
built-in automation agents for support, triage, maintenance, and security.
Implemented from the JME Design System (Claude Design handoff bundle).

> **Not yet launched.** Not deployed, not indexable, no payments, no email/CRM,
> no QuickBooks/WooCommerce connection. See the governance docs at the repo root:
> `PROJECT_STATE_AUDIT.md`, `RISK_REGISTER.md`, `PRODUCTION_READINESS_CHECKLIST.md`,
> `SECURITY_NOTES.md`, `DATA_BOUNDARIES.md`.

## Stack
- Next.js 14 (App Router) · React 18 · TypeScript — zero runtime dependencies beyond these
- Fonts: Barlow Condensed (display), Barlow (body), JetBrains Mono (mono) via `next/font`
- Styling: design-system tokens as CSS custom properties (`src/styles/`)
- Storage: customer request list in `localStorage`; RFQ inbox + audit log in a
  file-backed store under `.data/` (gitignored — contains PII, never committed)

## Run
```bash
cd parts-store
npm install
npm run dev      # http://localhost:3000  (ops desk: /ops — open in dev, see below)
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`, `npm test`.

## Routes
| Route | What |
|-------|------|
| `/` | Storefront (hero, machines, parts, request desk, FAQ, assistant widget) |
| `/machine/[sku]` | Machine detail (configure, specs, related parts) — 6 SSG pages |
| `/compare` | Side-by-side machine comparison |
| `/ops` | **Internal** ops desk — RFQ inbox, lifecycle, agent panels (gated, noindexed) |
| `/api/quote` | RFQ intake — validated, honeypot, rate-limited, persisted |
| `/api/assistant` | Support assistant — public-catalog-grounded, rate-limited |
| `/api/ops/*` | Ops session, RFQ inbox, agent runner (ops session required) |
| `/api/health` | Minimal liveness probe |

## Built-in agents
All agents run deterministic rules engines with **zero configuration** and
upgrade automatically to AI (Anthropic API) when `ANTHROPIC_API_KEY` is set in
the environment — never in the repo.

| Agent | Surface | Job |
|-------|---------|-----|
| Support | `/api/assistant` + storefront widget | Answers availability/fit/freight questions from the public catalog + FAQ only. Refuses pricing/quantity/vendor questions by code-level guardrail. |
| Triage | Ops desk / `npm run agent:triage` | Prioritizes the open RFQ queue (age, freight, size); PII never enters a prompt. |
| Maintenance | Ops desk / `npm run agent:maintenance` | Catalog integrity, data-boundary sweep, store health. Non-zero exit on failure → cron/CI ready. |
| Security | Ops desk / `npm run agent:security` | Scans the PII-free audit log for abuse patterns; posture checks. Non-zero exit on critical. |

## Environment variables (all optional, never committed)
| Var | Effect |
|-----|--------|
| `OPS_TOKEN` | Enables the ops desk login. Unset: `/ops` is open in dev (with banner), **disabled in production**. |
| `ANTHROPIC_API_KEY` | Upgrades agents from rules engines to AI. Absent: fully functional offline. |
| `JME_AI_MODEL` | Overrides the default agent model. |
| `RFQ_DATA_DIR` | Overrides the `.data/` store location (used by tests). |

## Structure
- `src/components/ui/` — design-system primitives (Button, Badge, DataPlate, …)
- `src/components/ops/` — internal ops desk UI
- `src/data/` — `catalog.ts`, `details.ts`, `faq.ts`, `types.ts`, `sanitize.ts` (public-safe fields only)
- `src/lib/` — rate limit, validation, RFQ store, audit log, ops auth
- `src/lib/agents/` + `src/lib/ai/` — agent engines and the env-gated AI provider
- `src/styles/` — tokens + base + component + page CSS
- `tests/` — node:test suite (`npm test`)
- `scripts/run-agent.ts` — agent CLI for cron/CI

## Data protection
Only customer-safe fields exist in the public data model (SKU, name, description,
family, status band, RFQ action). There is intentionally **no** field for price,
cost, margin, exact quantity, vendor, bin location, supplier notes, or QuickBooks
references. Availability is expressed only as the 7 approved status bands.
RFQ submissions (PII) are stored server-side in gitignored `.data/`, readable only
through the ops-authenticated API; logs and audit events are PII-free by
construction. See `DATA_BOUNDARIES.md`.
