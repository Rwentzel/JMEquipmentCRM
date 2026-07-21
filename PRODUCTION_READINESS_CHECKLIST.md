# PRODUCTION READINESS CHECKLIST — JM Equipment Parts Store

**Date:** 2026-07-08 · **Status:** Code-complete on `main`. Every remaining item
is a business/deployment action, not engineering.
Legend: ✅ done (verified) · 🔒 requires a JM decision or credentials · ⬜ optional

> Companion doc: **LAUNCH.md** is the step-by-step go-live runbook.

---

## Engineering gates — ALL COMPLETE ✅

### RFQ-first & data protection
- ✅ No public prices, costs, margins, exact quantities, vendor data, bin locations, aliases, or QuickBooks refs — enforced at four layers: allowlist sanitizer, generator scrub, regression tests (`catalogBoundary.test.ts`), and the maintenance agent's runtime sweep of all 2,198 descriptions
- ✅ Availability shown only as the 7 approved status bands; RFQ-first CTAs, no Buy Now
- ✅ Real catalog (2,198 web-referenced parts) generated from the private master with the vendor crosswalk kept outside the repo
- ✅ RFQ PII: server-side only in gitignored `.data/`, readable exclusively via ops-authed API; zero PII in logs/audit events (counts + hashed keys only)
- ✅ PII retention tooling: `npm run retention -- --days N [--apply]` archives/purges old closed RFQs (open work never purged); tested

### Commerce loop
- ✅ Quote intake: validation, SKU allowlist, honeypot, per-IP rate limit, generic responses, crypto-random refs
- ✅ Persistence + ops desk (`/ops`): token login, RFQ inbox with full contact/addresses/message, status lifecycle, CSV export (RFC 4180, 18 columns)
- ✅ Email to the desk on every RFQ (env-gated SMTP, Reply-To = customer) — verified against a live SMTP session; no-op safe when unconfigured

### Platform & security
- ✅ Next 16.2.10 / React 19 — `npm audit`: **0 vulnerabilities**; audit gate now runs in CI on every push/PR
- ✅ Security headers global (CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy)
- ✅ CSP `unsafe-inline` decision recorded in SECURITY_NOTES (static-first architecture; no user-generated HTML rendered anywhere — accepted with rationale, nonce path documented for later)
- ✅ Indexing gated: default noindex + Disallow all; `JME_LAUNCH=live` at build time flips robots/meta/sitemap; `/ops` + `/api/` never crawlable
- ✅ Health probe (`/api/health`) for uptime monitoring

### Quality & automation
- ✅ 52/52 tests (validation, sanitizer, taxonomy, store incl. concurrency, agents, ops auth, launch flag, mail, CSV, retention)
- ✅ CI on every push/PR: dependency audit → typecheck → lint → tests → maintenance agent → production build
- ✅ Built-in agents (support / triage / maintenance / security) with deterministic engines, AI-upgradeable via env; CLI hooks for cron
- ✅ Accessibility baseline (skip link, ARIA, focus management, reduced-motion), print stylesheet, mobile responsive — Playwright-verified desktop + mobile
- ✅ GitHub Pages static preview publishes from `main` (noindexed, forms disabled)

---

## Launch gates — JM actions (the only things holding launch back) 🔒

1. 🔒 **Pick a host and deploy** — Node 20+, `npm ci && npm run build && npm start`
   behind TLS, with a persistent volume for `RFQ_DATA_DIR` (LAUNCH.md §2)
2. 🔒 **Set production secrets** in the host dashboard: `OPS_TOKEN`, `SMTP_HOST/PORT/USER/PASS`, `RFQ_NOTIFY_TO` (LAUNCH.md §1)
3. 🔒 **Run the 5-minute production smoke** (LAUNCH.md §3) and confirm the desk email arrives
4. 🔒 **Business sign-off on public content** — machine claims/photos and the
   Terms/Privacy/Freight policy pages reviewed by JM (legal review recommended)
5. 🔒 **Point DNS** (e.g. `parts.jmequipment.net`) at the deployment
6. 🔒 **Flip `JME_LAUNCH=live` + redeploy** to open search indexing; submit the sitemap (LAUNCH.md §4)
7. 🔒 **Adopt the retention window** — pick N days and schedule `npm run retention` monthly

## Post-launch hardening (optional, non-blocking) ⬜
- ⬜ Per-user ops auth / SSO when more than one person works the desk (swap isolated in `src/lib/opsAuth.ts`)
- ⬜ Edge/shared rate limiting + managed DB when scaling past a single instance
- ⬜ CSP nonces (requires giving up full-static rendering) — see SECURITY_NOTES
- ⬜ External penetration test
- ⬜ `ANTHROPIC_API_KEY` to upgrade the agents from rules engines to AI
