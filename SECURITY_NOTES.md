# SECURITY NOTES — JM Equipment Parts Store

**Date:** 2026-07-08 · **Status:** code-complete on main; launch is configuration (see LAUNCH.md).

## Current posture
- **Pre-launch.** This is a launch-candidate MVP. It is not deployed and is not launch-approved.
- **No integrations in the repo.** No payment processor, WooCommerce, or QuickBooks connection. Two *optional, env-gated* outbound integrations exist in code and are inert without configuration: SMTP delivery of RFQ notifications (`SMTP_*` + `RFQ_NOTIFY_TO`) and the Anthropic API for agent upgrades (`ANTHROPIC_API_KEY`). Neither has credentials in the repo; both no-op gracefully when unconfigured.
- **No secrets.** No API keys, tokens, or credentials exist in the repo. All secrets (`OPS_TOKEN`, `ANTHROPIC_API_KEY`) are supplied via environment variables only and never committed.
- **No deployment.** Nothing is deployed to any host.
- **Indexing gated by launch mode.** Default (and every preview): global noindex + `robots.ts Disallow: /`. Setting `JME_LAUNCH=live` at build time — only in the approved production environment — flips robots/meta to indexable and publishes the sitemap (see LAUNCH.md). `/ops` and `/api/` are excluded from crawling even when live.
- **Data boundaries.** No price, cost, margin, exact quantity, vendor, bin, supplier, or QuickBooks data exists in the client tier. See `DATA_BOUNDARIES.md`.
- **Security headers.** CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` set globally in `next.config.mjs` (CSP still allows `unsafe-inline` for Next bootstrap — tighten with nonces pre-launch).

## Quote API (`/api/quote`)
Validates input, persists the RFQ, returns a crypto-random reference, and — when SMTP is configured via environment — emails the desk. It never charges anything and never blocks the customer on delivery.
- Server-side validation; required company / name / email; SKU allowlist; qty clamped.
- **Honeypot** field — bot submissions get a fake success and are discarded.
- **In-memory per-IP rate limiting** (single-instance; move to edge/Redis for production scale).
- **No PII logging** — audit events carry event kind, timestamp, counts, and a hashed client key only.
- **Generic** success/failure responses (no field-level detail leakage).
- **Persistence:** RFQs (contact PII + line items) are written to `.data/rfqs.json` — gitignored, server-side only, readable exclusively through the ops-authenticated API. Retention/deletion policy required before launch.
- **Email delivery:** env-gated via `SMTP_*` + `RFQ_NOTIFY_TO` (src/lib/mail.ts); fire-and-forget, failures audited as `mail_error` with zero PII, RFQ always persisted regardless.

## Ops desk (`/ops` + `/api/ops/*`)
- **Auth:** single shared token (`OPS_TOKEN` env). Login sets an httpOnly, sameSite=strict cookie holding a SHA-256 digest of the token; comparisons are constant-time; login endpoint is tightly rate-limited and failures are audited.
- **Modes:** token set → login required. Token unset → **disabled in production**, open in local dev with a visible banner (zero-secret demo).
- **Pre-launch requirement:** replace the shared token with per-user auth (SSO) before multi-person use; the gate is isolated in `src/lib/opsAuth.ts` for that swap.

## Built-in agents & AI provider
- Support/triage/maintenance/security agents run **deterministic rules engines by default** — no key, no outbound calls, fully functional.
- With `ANTHROPIC_API_KEY` set, agents upgrade to LLM output. **PII never enters a prompt**: the support agent is grounded on the public catalog/FAQ only (with a code-level refusal guardrail for pricing/quantity/vendor questions and an output screen for `$` amounts); triage/security agents receive PII-free projections (refs, counts, ages, hashed keys).
- The audit log (`.data/audit.jsonl`) is PII-free by construction, so it is safe to feed to monitoring or an LLM.

## Decision record: CSP `unsafe-inline`
The CSP keeps `'unsafe-inline'` for script/style. Removing it requires per-request
nonces, which forces dynamic rendering and gives up the fully static build of a
42-page catalog site. Accepted because the XSS surface is minimal by
construction: no user-generated content is ever rendered as HTML anywhere —
user input appears only as React text nodes (auto-escaped), and API responses
are JSON. Revisit (nonce middleware) only if user-generated HTML is ever
introduced. All other headers remain strict.

## Future production security requirements (post-launch hardening)
- Dependency audit gate now runs in CI on every push/PR (`npm audit --audit-level=moderate`); currently zero vulnerabilities.
- Secrets manager for integration credentials; never in the repo.
- Per-user authentication for the ops desk (replace shared token); keep it off public navigation.
- Edge/server rate limiting and abuse protection (replace in-memory limiter).
- Retention tooling exists (`npm run retention`, archives+purges old closed RFQs); JM to pick the window and schedule it. Encrypted-at-rest volume or managed DB when scaling.
- Penetration test and security review before public launch.
- Legacy Electron CRM (repo root) uses `nodeIntegration:true` / `contextIsolation:false` — pre-existing and out of scope here; flag for separate review if that app is carried forward.
