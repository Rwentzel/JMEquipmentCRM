# JME Platform Build Replication Guide

This guide enables a non-author to rebuild the JME storefront, machine platform, support hub, governance console, and Cloudflare Worker from source artifacts.

## Prerequisites

- Python 3.9+
- Node.js 18+
- WordPress 6.4+
- WooCommerce 8.0+
- Wrangler CLI (Cloudflare)
- openpyxl (`pip install openpyxl`)
- Git (for governance log tracking)

## Stage A: Data Layer

### A1. Load & Validate Catalog

```bash
python3 build_portal.py \
  --source JME_Phase1_Remediated_Catalog.xlsx \
  --rev 2 \
  --validate
```

Expected output:
```
✓ Loaded 2,223 SKUs (full catalog — owner ruling 2026-09-10)
✓ 2,223 import-eligible (10 HOLD listed as Quote Required, RFQ-only)
✓ 14 Tier 1 redactions applied
✓ 9 NAME_FIX substitutions loaded
✓ MD5 checksum: [matches baseline]
```

Abort if counts do not match; verify rev-2 workbook integrity.

### A1-alt. Export from the app's catalogue (no workbook needed)

The Next.js app carries the same full catalogue (2,223 parts) as the
QuickBooks export. When the workbook is not to hand, build the artifact from
it — same columns, same category paths, same RFQ-only flags — and gate it with
A3 unchanged:

```bash
cd parts-store && npm run export:woocommerce -- --out /tmp/track-b/products.csv
python3 test_regression.py --artifact /tmp/track-b/products.csv \
  --expect-sku-count 2223 --expect-hold-count 0 --allowlist redaction_allowlist.json
```

The app's catalogue carries no HOLD rows (those live in the desk's workbook),
so `--expect-hold-count 0`. CI runs both steps on every push.

### A2. Export to WooCommerce Format

```bash
python3 export_woocommerce.py \
  --source JME_Catalog_Full.xlsx \
  --sheet "Webstore Catalog" \
  --allowlist redaction_allowlist.json \
  --output products.csv
```

Produces:
- `products.csv`: 2,223 rows (the full catalog; prices suppressed, categories mapped, meta populated; the 10 HOLD rows carry `_jme_price_status = hold` and list as Quote Required)
- `validation_report.json`: split-scope validator results (cost/vendor/margin/wholesale scans)
- `decisions_log_delta.txt`: governance decisions this session

### A3. Regression Suite

```bash
python3 test_regression.py \
  --artifact products.csv \
  --expect-sku-count 2223 \
  --expect-hold-count 10 \
  --expect-name-fix-applied 9 \
  --expect-serials-exact-match 90 \
  --expect-idempotence
```

Expected: all tests green. Halt if any fail; review validation_report.json.

---

## Stage B: Cloudflare Worker

### B1. Setup

```bash
# Clone or copy rfq-worker.js and wrangler.toml to a working directory

cd cloudflare-worker/

# Install Wrangler
npm install -g wrangler

# Authenticate
wrangler login

# Set secrets
wrangler secret put RFQ_TO
# Paste: parts@jmequipment.net

wrangler secret put RFQ_FROM
# Paste: noreply@jmequipment.net

wrangler secret put RESEND_KEY
# Paste: [your Resend API key]

wrangler secret put ALLOW_ORIGIN
# Paste: https://jmequipment.net,https://<track-a-host>
# (comma-separated, one entry per host: the Worker serves both tracks and
#  echoes the request's Origin only when it is on this list)
```

### B2. Deploy

```bash
wrangler deploy --env production
```

Output: Worker URL (e.g., `https://jmequipment.net/api/rfq`)

### B3. Smoke Test

```bash
# Valid RFQ
curl -X POST https://jmequipment.net/api/rfq \
  -H "Content-Type: application/json" \
  -d '{
    "name":"John Doe",
    "email":"john@example.com",
    "part_number":"MB2G2011011",
    "machine_model":"Goodstrong 1650",
    "quantity":2,
    "notes":"Test RFQ"
  }'

# Expected: HTTP 200 + {"status":"success","reference_id":"RFQ-YYYYMMDD-XXXX"}

# Invalid RFQ (missing email)
curl -X POST https://jmequipment.net/api/rfq \
  -H "Content-Type: application/json" \
  -d '{"name":"John","part_number":"TEST","quantity":1}'

# Expected: HTTP 422 + {"error":"Validation failed","details":["valid email required"]}

# Honeypot
curl -X POST https://jmequipment.net/api/rfq \
  -H "Content-Type: application/json" \
  -d '{"honeypot":"spam","name":"John","email":"john@example.com",...}'

# Expected: HTTP 422 + {"error":"Validation failed","details":["honeypot triggered"]}
```

---

## Stage C: WordPress / WooCommerce

### C1. Fresh Install

```bash
# WordPress core
wp core download --version=6.4
wp core config --dbname=jme_production --dbuser=root --dbpass=[password]
wp db create
wp core install --url=https://jmequipment.net --title="JME Parts & Equipment" \
  --admin_user=admin --admin_email=admin@jmequipment.net --admin_password=[strong password]

# WooCommerce
wp plugin install woocommerce --activate
wp plugin install woocommerce-gravityforms-product-addons --activate

# FiboSearch Pro
# (License required; download from vendor and install)
wp plugin install fibosearch-pro --activate

# YITH Request a Quote
wp plugin install yith-woocommerce-request-a-quote --activate

# Activate child theme with brand tokens
# (Copy JME brand child theme to wp-content/themes/jme-child/)
wp theme activate jme-child
```

### C2. YITH Configuration

In WordPress admin:
1. YITH Request a Quote → Settings
2. Replace "Add to Cart" with "Request a Quote": ON
3. Quote form submission: POST to https://jmequipment.net/api/rfq
4. Confirmation screen shows reference ID + DEC-038 routes
5. Notification email template includes reference ID and part details

### C3. Product Import

```bash
# Using WP All Import plugin or WC native import
wp import products.csv \
  --post_type=product \
  --skip_duplicates \
  --merge_duplicates_by_sku
```

Verify:
- 2,223 products imported (10 of them HOLD, listed as Quote Required)
- Categories mapped correctly
- No products have public prices
- Machine pages linked to parts

### C4. Search Configuration

FiboSearch setup:
1. Index builds on demand or cron
2. Search aliases: exact SKU, spaced SKU (normalized), machine name
3. Test queries:
   - "MB2G2011011" → exact match
   - "MB2G 2011011" → normalized match
   - "Goodstrong 1650" → machine filter
   - "hydraulic" → keyword search

### C5. Quality Gates

```bash
# Zero console errors on key pages
npm run test:a11y \
  --pages="home,category,product,search,machine,support,404"

# Page load times
npm run test:perf \
  --target="product" \
  --max-time="3s"

# Accessibility (axe)
npm run test:accessibility \
  --include="home,category,product,support"
```

---

## Request API contract (rfq-worker.js)

`POST /api/rfq` takes a JSON body with `request_type`; an unknown or missing type falls back to `parts-rfq`, so the original storefront/YITH payload still validates.

| request_type | Required | Also accepted | Reference |
| --- | --- | --- | --- |
| parts-rfq | name, email, part_number, quantity >= 1 | company, phone, serial, machine_model, items[], notes | `RFQ-…` |
| manual-request | email + (serial or machine_model) | name, company, phone, doc_type, notes | `REQ-…` |
| service-request | name, phone, notes | company, email, serial, service_type | `REQ-…` |
| fitment-check | email, part_number + (serial or machine_model) | name, company, phone, notes | `REQ-…` |
| epc-lookup | email, serial | name, machine_model, notes | `REQ-…` |
| sales-inquiry | name, email | company, phone, topic, notes | `REQ-…` |

Every type also needs at least one reply path (email or phone), rejects a filled `honeypot`, and is rate-limited per IP through `RATE_LIMIT_KV`. Success returns `{status, request_type, reference_id, message, reply_to}`; validation failure returns 422 with a `details` array.

Client wiring: the Support Hub and Request List each expose an `endpoint` prop. Blank (the default) keeps them reference-only — they generate a local reference and offer the three DEC-038 routes without claiming anything was sent. Set it to the deployed Worker URL and they POST, then display the server's reference.

---

## Screen inventory (Design Components)

All customer and internal screens are single-file Design Components at the project root. Open any of them directly in a browser; they share the bound JME design system bundle and the `jme-request-list` localStorage key.

| Screen | Audience | Role |
| --- | --- | --- |
| JME Storefront | Customer | Landing page: product lines, 3x densification story, parts-desk routes. Search box hands off to the catalog as `?q=` |
| JME Catalog (Repo-Driven) | Customer | Parts catalog with machine/category filters, part modal, add-to-request-list. Reads `?q=` on load |
| JME Machine Platform (Fitment-Guarded) | Customer | Machine pages with fitment guard and honest empty states for machines with no published parts |
| JME Machine Detail (Configurator) | Customer | Single-machine configurator view |
| JME Goodstrong Manual (Diagrams) | Customer | Manual / diagram browser with pending-linkage states |
| JME Support Hub | Customer | Six support paths (troubleshooting, manuals, service, fitment, EPC, sales); each submission returns a reference plus DEC-038 routes |
| JME Request List (Persistent) | Customer | Persistent request list and multi-route send panel (email / call / print) |
| JME RFQ Flow (Data-Driven) | Customer | Explains why JME quotes instead of listing prices |
| JME Governance Console | Internal | HOLD queue, price verification, fitment classification, redaction allowlist, decision-log delta, catalog status |

Governance invariants enforced across all nine: design-system bundle loaded, `var(--*)` colors only, no pricing/cost/vendor/bin strings on customer surfaces, Goodstrong and Martin never co-listed, no emoji, keyboard-operable controls, and no `alert()` — confirmations render in place with a reference number.

---

## Stage D: Governance Console

The internal console is a Design Component (JME Governance Console.dc.html) and does NOT require installation. Open directly in a browser for local testing.

For production access control:
1. Place behind HTTP Basic Auth or Cloudflare Access
2. Grant access to authorized staff only
3. Set X-Robots-Tag: noindex on all /console/* paths

---

## Stage E: Go-Live

### E1. Final Preconditions

```bash
# Idempotence check
python3 export_woocommerce.py --catalog ... --output v1.csv
python3 export_woocommerce.py --catalog ... --output v2.csv
cmp v1.csv v2.csv
# Should exit 0 (files identical)

# Fuzz harness on JME Client Portal v2
npm run fuzz:portal --seeds=3 --steps=140
# Expected: clean exit, no crash

# Worker smoke test (from Stage B3)
# All tests pass
```

### E2. Launch Steps

1. **DNS flip** (if staging on separate URL)
   ```bash
   # Update CNAME to point to WordPress server
   # Wait for TTL to expire (or flush cache if CDN)
   ```

2. **Enable indexing**
   ```bash
   # Remove noindex meta tag (if present)
   # Submit sitemap to Google Search Console
   # Enable Bing Webmaster Tools
   ```

3. **Monitor first 24 hours**
   - Watch RFQ inbox
   - Monitor Worker logs: `wrangler tail --env production`
   - Monitor WordPress error logs: `tail -f /var/log/apache2/error.log` (or equivalent)
   - Track 404s with Google Search Console

4. **Confirm first live RFQ**
   - Reference ID generated and displayed
   - Email received at parts@jmequipment.net
   - Reply sent to requestor

---

## Backup & Rollback

### Backup

```bash
# Daily
mysqldump jme_production > /backup/jme_$(date +%Y%m%d).sql
tar czf /backup/wp-content_$(date +%Y%m%d).tar.gz /var/www/html/wp-content/

# Weekly to S3
aws s3 sync /backup/ s3://jme-backups/ --delete
```

### Rollback

If product import corrupted:

```bash
# Delete all products
wp post delete $(wp post list --post_type=product --format=ids)

# Reimport from last-good CSV
wp import [last_known_good.csv]

# Rerun Stage C5 gates
```

---

## Maintenance & Updates

### Catalog Updates

When redaction_allowlist.json changes:

```bash
# 1. Update workbook if needed
# 2. Rerun Stage A
# 3. Staging import + gates
# 4. Production import
```

### WordPress / WooCommerce Updates

Keep staging in sync with production:

```bash
# Backup production before updates
mysqldump jme_production | gzip > jme_pre_update_$(date +%s).sql.gz

# Update core & plugins
wp core update
wp plugin update --all

# Rerun Stage C5 gates on staging first
# Then repeat on production after validation
```

### Worker Updates

```bash
# Test locally
node --require ./rfq-worker-test.js

# Deploy to staging first
wrangler deploy --env staging

# Test staging endpoint
# Then deploy to production
wrangler deploy --env production
```

---

## Troubleshooting

| Issue | Diagnosis | Resolution |
|-------|-----------|-----------|
| Products import but prices are visible | NAME_FIX not applied | Rerun export_woocommerce.py with allowlist; verify _jme_price_status = quote_only |
| HOLD SKUs show anything but Quote Required | Export ran without the ruling's HOLD handling | Rerun export_woocommerce.py (HOLD rows flagged `hold`, listed as Quote Required); regression expects 10 flagged |
| RFQ form doesn't submit | Worker endpoint unreachable | Check CORS origin, Worker deployment, secret values; test with curl |
| FiboSearch not finding parts | Index stale | Manually rebuild index in WordPress admin; check indexing cron |
| Console not loading | Design Component rendering issue | Clear browser cache; check for console errors; verify Support Bundle loaded |

---

## Versioning & Governance

All governance decisions are logged in DECISIONS_LOG.txt with timestamp, authority, and scope. Maintain a changelog:

```
Version 1.0 — 2026-08-13
  - Initial launch: 2,223 SKUs (full catalog), 9 machine lines, RFQ-first
  - 9 NAME_FIX redactions applied
  - 10 HOLD SKUs listed as Quote Required, price rulings pending
  - Cloudflare Worker live, Resend integration validated

Version 1.1 — [TBD]
  - [Update description]
```

---

## Support

- **Build issues**: Check logs in /var/www/html/wp-content/debug.log
- **Worker issues**: `wrangler tail --env production`
- **Catalog validation**: Review validation_report.json
- **Questions**: Refer to LAUNCH.md checklist
