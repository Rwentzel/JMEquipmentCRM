# LAUNCH RUNBOOK — JM Equipment Parts Store

The store is production-complete and ships **gated by default**: not indexable,
ops desk disabled without a token, email delivery off without SMTP config.
Going live is configuration, not code. Work through this list in order.

## 1. Environment variables (set in the host's dashboard — never in the repo)

| Variable | Required for | Value |
|----------|--------------|-------|
| `OPS_TOKEN` | Ops desk login at `/ops` | Long random string (e.g. `openssl rand -hex 24`). Without it, `/ops` is **disabled** in production. |
| `SMTP_HOST` | RFQ email to the desk | Your mail provider's SMTP host |
| `SMTP_PORT` | " | `587` (STARTTLS) or `465` (TLS). Default 587. |
| `SMTP_USER` / `SMTP_PASS` | " | SMTP credentials (use an app password / API key, not a personal login) |
| `RFQ_NOTIFY_TO` | " | The desk inbox, e.g. `parts@jmequipment.net` |
| `RFQ_NOTIFY_FROM` | optional | Sender address if different from `SMTP_USER` |
| `ANTHROPIC_API_KEY` | optional | Upgrades support/triage/security agents from rules engines to AI |
| `JME_LAUNCH` | **search indexing** | Set to `live` ONLY at approved launch — flips robots/noindex and publishes the sitemap. Leave unset on previews. |
| `RFQ_DATA_DIR` | optional | Where the RFQ store + audit log live. Default `.data/` under the app. Point at a **persistent volume** in production. |

Until SMTP is configured, requests still persist and appear in `/ops` — nothing
is lost; you just don't get the email ping.

## 2. Deploy

- `npm ci && npm run build && npm start` (Node 20+), behind your host's TLS.
- Give `RFQ_DATA_DIR` a persistent disk (RFQs and the audit log live there).
  Single instance only — the store and rate limiter are per-process by design.
  Scale-out later means a database + shared rate limiting (see SECURITY_NOTES).
- Verify `/api/health` returns `{"ok":true}` and wire it to uptime monitoring.

## 3. Smoke test in production (5 minutes)

1. Submit a real RFQ from the storefront → confirmation ref appears.
2. Email arrives at `RFQ_NOTIFY_TO` with every field; **Reply** addresses the customer.
3. Log into `/ops` with `OPS_TOKEN` → the RFQ is in the inbox; move it to `reviewing`; **Export CSV** downloads the book.
4. Run all three agent panels — maintenance must report **all checks passing**.
5. Ask the storefront assistant a pricing question → it must refuse with the written-quote policy.

## 4. Go live (indexing)

Only after JM sign-off: set `JME_LAUNCH=live` and redeploy. The flag is
read at **build time**, so a redeploy (which rebuilds) is required — flipping
the variable alone does nothing until the next build. Confirm
`/robots.txt` now allows crawling (excluding `/ops` and `/api/`) and
`/sitemap.xml` lists the pages. Submit the sitemap in Google Search Console.

## 5. Ongoing operations

- **Daily**: check `/ops` (or rely on email). Triage agent orders the queue.
- **Weekly**: `npm run agent:security` (or the ops panel) — non-zero exit = act.
- **On catalog updates**: regenerate via `scripts/generate-public-catalog.py`,
  then `npm test` — the boundary tests hard-fail on any price/vendor leak.
- **Monthly**: back up `RFQ_DATA_DIR` and run the retention sweep once JM picks
  a window: `npm run retention -- --days <N> --apply` (dry-run without `--apply`;
  only closed RFQs older than the window are archived). `npm audit` runs in CI
  on every push — currently zero known vulnerabilities.
- **PII**: the RFQ store contains customer contact data. Keep the volume
  access-restricted; enforce the retention window with `npm run retention`
  (e.g. `--days 730` ≈ 24 months). Never commit `.data/`.

## Out of scope until explicitly approved

Online payment/checkout (RFQ-first by policy), customer auto-reply emails
(spam-amplification risk), QuickBooks/CRM integrations, multi-user ops accounts
(single shared `OPS_TOKEN` today — isolated in `src/lib/opsAuth.ts` for a
future SSO swap).
