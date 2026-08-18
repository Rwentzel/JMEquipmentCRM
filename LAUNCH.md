# LAUNCH RUNBOOK — JM Equipment Parts Store & Quote Center

Two surfaces ship from this app:

- **Parts store** (public storefront + `/ops` desk) — RFQ-first, no public pricing.
- **Quote Center** (`/quotes`, staff-only) — the internal quoting system, plus
  the tokened customer quote links it sends out (`/q/<id>/<token>`).

Both are production-complete and ship **gated by default**: not indexable, ops
desk and Quote Center disabled without a token, email delivery off without SMTP
config. Going live is configuration, not code. Work through this list in order.

## 1. Environment variables (set in the host's dashboard — never in the repo)

| Variable | Required for | Value |
|----------|--------------|-------|
| `OPS_TOKEN` | Ops desk at `/ops` **and Quote Center at `/quotes`** | Long random string (e.g. `openssl rand -hex 24`). Without it, both are **disabled** in production. |
| `SMTP_HOST` | RFQ email + quote-acceptance alerts | Your mail provider's SMTP host |
| `SMTP_PORT` | " | `587` (STARTTLS) or `465` (TLS). Default 587. |
| `SMTP_USER` / `SMTP_PASS` | " | SMTP credentials (use an app password / API key, not a personal login) |
| `RFQ_NOTIFY_TO` | " | The desk inbox, e.g. `parts@jmequipment.net`. Also receives `[ACCEPTED]` alerts when a customer signs a quote. |
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
6. In `/ops`, hit **Create quote →** on the request from step 1: it opens the
   Quote Center builder pre-filled with that customer and their line items,
   and the RFQ moves to `quoted`.
7. Quote Center (`/quotes`, same `OPS_TOKEN`): build a quote → **Save** → **Copy Link**.
   Open that link in a private window: the quote renders, **Download PDF** prints
   clean, and trimming the token from the URL must give a 404. Sign it → the
   `[ACCEPTED]` email lands at `RFQ_NOTIFY_TO` and the pipeline shows *Accepted*.

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
- **Daily (automate this)**: `npm run backup`. It snapshots the whole data
  directory to `.backups/`, parses every store first so a corrupt file is never
  archived, re-reads the finished archive to confirm it is restorable, and keeps
  the 14 most recent (`--keep N` to change). It exits non-zero on failure, so a
  cron entry that fails silently is not possible — alert on that exit code.
  Copy the archives **off the box**; a backup on the same volume as the data
  does not survive the failure it exists for.
- **Monthly**: run the retention sweep once JM picks a window:
  `npm run retention -- --days <N> --apply` (dry-run without `--apply`; only
  closed RFQs older than the window are archived). `npm audit` runs in CI on
  every push — zero known vulnerabilities in shipped code; the dev-tooling
  audit is advisory (see SECURITY_NOTES.md) so check its output when it flags.
- **Quarterly**: actually restore a backup into a scratch directory and look at
  it — `RFQ_DATA_DIR=/tmp/drill npm run restore -- --latest --apply`. An
  untested backup is a guess; this is the only step that turns it into a fact.
- **PII**: the RFQ store contains customer contact data. Keep the volume
  access-restricted; enforce the retention window with `npm run retention`
  (e.g. `--days 730` ≈ 24 months). Never commit `.data/`.
- **Quote Center data** (`.data/qc.json`) holds client contacts *and* dealer
  pricing/cost. It lives on the same volume — back it up with the RFQ store. The
  retention sweep deliberately does **not** touch it: accepted quotes are signed
  business records, so purging them is a JM decision, not an automated one.
### Recovering from data loss

1. **Stop the app.** Restoring under a running server races with its own writes.
2. `npm run restore -- --list` — see what is available.
3. `npm run restore -- --latest` — a dry run prints exactly what would be
   created, overwritten, and left alone. Nothing is written without `--apply`.
4. `npm run restore -- --latest --apply`. The archive is fully verified before
   anything is touched, so a bad archive fails while the current data is still
   intact, and the current data directory is snapshotted to
   `.backups/pre-restore/` first — restoring the wrong archive is itself
   recoverable. Each file is replaced atomically.
5. Restart, then confirm in `/ops` that the RFQ inbox and Quote Center pipeline
   look right before telling anyone the incident is over.

To restore a specific point in time, pass `--from <archive>` instead of
`--latest`. `npm run backup -- --verify <archive>` re-checks one archive on
demand without touching anything.

- **Quote links** stay valid until reissued. Sent one to the wrong address?
  Open the quote in the builder and hit **Reissue link** — the old URL stops
  working immediately and you get a fresh one to send.

## Out of scope until explicitly approved

Online payment/checkout (RFQ-first by policy), customer auto-reply emails
(spam-amplification risk), QuickBooks/CRM integrations, multi-user ops accounts
(single shared `OPS_TOKEN` today — isolated in `src/lib/opsAuth.ts` for a
future SSO swap).
