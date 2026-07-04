# SECURITY NOTES — JM Equipment Parts Store

**Date:** 2026-07-04 · **Status:** MVP sandbox (pre-launch).

## Current posture
- **Pre-launch.** This is a launch-candidate MVP. It is not deployed and is not launch-approved.
- **No live integrations.** No Resend, SMTP, Formspree, Stripe, WooCommerce, QuickBooks, Outlook, Gmail, or any other external service is connected. The only *optional* outbound call is the Anthropic API for agent upgrades, and only when `ANTHROPIC_API_KEY` is provided via the environment.
- **No secrets.** No API keys, tokens, or credentials exist in the repo. All secrets (`OPS_TOKEN`, `ANTHROPIC_API_KEY`) are supplied via environment variables only and never committed.
- **No deployment.** Nothing is deployed to any host.
- **Noindex requirement.** Global and per-page `robots: { index:false, follow:false }`, plus `app/robots.ts` returning `Disallow: /`. The sandbox must not be indexed until launch is approved. `/ops` is additionally noindexed and never linked publicly.
- **Data boundaries.** No price, cost, margin, exact quantity, vendor, bin, supplier, or QuickBooks data exists in the client tier. See `DATA_BOUNDARIES.md`.
- **Security headers.** CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` set globally in `next.config.mjs` (CSP still allows `unsafe-inline` for Next bootstrap — tighten with nonces pre-launch).

## Quote API (`/api/quote`)
Validates input, persists the RFQ, and returns a crypto-random reference. It **does not send email or charge** anything.
- Server-side validation; required company / name / email; SKU allowlist; qty clamped.
- **Honeypot** field — bot submissions get a fake success and are discarded.
- **In-memory per-IP rate limiting** (single-instance; move to edge/Redis for production scale).
- **No PII logging** — audit events carry event kind, timestamp, counts, and a hashed client key only.
- **Generic** success/failure responses (no field-level detail leakage).
- **Persistence:** RFQs (contact PII + line items) are written to `.data/rfqs.json` — gitignored, server-side only, readable exclusively through the ops-authenticated API. Retention/deletion policy required before launch.
- `// TODO(production):` outbound email/CRM delivery, env-var configured, only after approval.

## Ops desk (`/ops` + `/api/ops/*`)
- **Auth:** single shared token (`OPS_TOKEN` env). Login sets an httpOnly, sameSite=strict cookie holding a SHA-256 digest of the token; comparisons are constant-time; login endpoint is tightly rate-limited and failures are audited.
- **Modes:** token set → login required. Token unset → **disabled in production**, open in local dev with a visible banner (zero-secret demo).
- **Pre-launch requirement:** replace the shared token with per-user auth (SSO) before multi-person use; the gate is isolated in `src/lib/opsAuth.ts` for that swap.

## Built-in agents & AI provider
- Support/triage/maintenance/security agents run **deterministic rules engines by default** — no key, no outbound calls, fully functional.
- With `ANTHROPIC_API_KEY` set, agents upgrade to LLM output. **PII never enters a prompt**: the support agent is grounded on the public catalog/FAQ only (with a code-level refusal guardrail for pricing/quantity/vendor questions and an output screen for `$` amounts); triage/security agents receive PII-free projections (refs, counts, ages, hashed keys).
- The audit log (`.data/audit.jsonl`) is PII-free by construction, so it is safe to feed to monitoring or an LLM.

## Future production security requirements (pre-launch)
- Tighten CSP with nonces/hashes; remove `unsafe-inline`.
- Dependency audit (`npm audit`) to zero actionable advisories; keep Next on a patched release.
- Secrets manager for integration credentials; never in the repo.
- Per-user authentication for the ops desk (replace shared token); keep it off public navigation.
- Edge/server rate limiting and abuse protection (replace in-memory limiter).
- PII handling and retention policy for stored RFQs (`.data/`); encrypted-at-rest storage or managed DB.
- Penetration test and security review before public launch.
- Legacy Electron CRM (repo root) uses `nodeIntegration:true` / `contextIsolation:false` — pre-existing and out of scope here; flag for separate review if that app is carried forward.
