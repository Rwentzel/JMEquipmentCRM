# SECURITY NOTES — JM Equipment Parts Store

**Date:** 2026-06-23 · **Status:** sandbox.

## Current posture
- **Sandbox-only.** This is a development sandbox. It is not production and is not launch-approved.
- **No live integrations.** No Resend, SMTP, Formspree, Stripe, WooCommerce, QuickBooks, Outlook, Gmail, or any other external service is connected or planned for this phase.
- **No secrets.** No API keys, tokens, or credentials exist in the repo or environment. Any future secret is supplied via environment variables only and never committed.
- **No deployment.** Nothing is deployed to any host.
- **No remote/push without approval.** Work is committed to the local feature branch only. Pushing requires explicit approval.
- **Noindex requirement.** Global and per-page `robots: { index:false, follow:false }`, plus `app/robots.ts` returning `Disallow: /`. The sandbox must not be indexed until launch is approved.
- **Data boundaries.** No price, cost, margin, exact quantity, vendor, bin, supplier, or QuickBooks data exists in the client tier. See `DATA_BOUNDARIES.md`.

## Quote API limitation
`/api/quote` validates input and returns a reference number. It **does not send email, charge, or persist** anything. Hardening (planned for the build phase):
- Server-side validation; required company / name / email; reject malformed email.
- **Honeypot** field — silently reject bot submissions.
- **In-memory per-IP rate limiting** (sandbox only).
- **No PII logging** — only counts, timestamps, and the generated reference.
- **Generic** success/failure responses (no internal detail leakage).
- **Safe reference** generation via `crypto.randomUUID()` (not time-derived).
- `// TODO:` real email/CRM backend, env-var configured, only after approval.

## Future production security requirements (pre-launch)
- Content-Security-Policy and security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- Dependency audit (`npm audit`) to zero actionable advisories; keep Next on a patched release.
- Secrets manager for any integration credentials; never in the repo.
- Authentication/authorization for any internal or staff-only tooling; keep it off public routes.
- Edge/server rate limiting and abuse protection for the quote endpoint.
- PII handling and retention policy for quote submissions; logging/monitoring without PII.
- Penetration test and security review before public launch.
- Legacy Electron CRM (repo root) uses `nodeIntegration:true` / `contextIsolation:false` — pre-existing and out of scope here; flag for separate review if that app is carried forward.
