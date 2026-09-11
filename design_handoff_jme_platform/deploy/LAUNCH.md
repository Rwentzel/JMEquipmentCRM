# JME Platform — Launch Runbook v1.0

## Prerequisites (Gate E1)

- [ ] Stage A regression tests pass (idempotence, NAME_FIX applied, HOLD SKUs present and flagged Quote Required)
- [ ] Worker smoke tests pass (422/200/429/honeypot paths) — `parts-store/tests/rfqWorker.test.ts` drives the Worker module in-process on every CI run (all six request types, CORS list, Resend failure); re-run against the deployed URL after `wrangler deploy`
- [ ] All Stage C gates pass (zero-console-error, axe, FiboSearch, RFQ flow)
- [ ] Fuzz harness clean on portal v2 (3+ seeds × 140 steps)
- [ ] Riley sign-off recorded
- [ ] Seth's 5 price rulings either received (rerun Stage A) or explicitly deferred with the 10 HOLD rows confirmed listed as Quote Required

## Pre-Flight Checklist

### Data Integrity
- [ ] Load the full catalog workbook (QuickBooks export, 2,223 rows) via openpyxl (read-only, data-only)
- [ ] Verify counts: 2,223 SKUs, 10 HOLD (listed, flagged), 14 Tier 1 redactions, 2,223 import-eligible
- [ ] NAME_FIX table loaded and substitution pipeline armed (9/9 entries)
- [ ] Split-scope validator run: cost/vendor/margin/wholesale word scans + pattern scans on artifact payload
- [ ] Regression: all 9 NAME_FIX originals confirmed absent from WooCommerce CSV
- [ ] Regression: all 10 HOLD SKUs present in the WooCommerce CSV with `_jme_price_status = hold` and Quote Required
- [ ] Regression: 90 documented serials exact-match validated (pattern-match disabled)
- [ ] Regression: suffix-collapse canaries asserted distinct (MB2G2011011 vs -OR, TBD-UCFLANGE vs -LESS)

### Cloudflare Worker
- [ ] `wrangler secret put RFQ_TO` → parts@jmequipment.net
- [ ] `wrangler secret put RFQ_FROM` → noreply@jmequipment.net
- [ ] `wrangler secret put RESEND_KEY` → [Resend API key]
- [ ] `wrangler secret put ALLOW_ORIGIN` → https://jmequipment.net,https://parts.jmequipment.net (comma-separated: one Worker serves both tracks)
- [ ] Deploy: `wrangler deploy`
- [ ] Smoke test: POST /api/rfq with valid/invalid/honeypot payloads
- [ ] Smoke test each request_type: parts-rfq, manual-request, service-request, fitment-check, epc-lookup, sales-inquiry (missing-field payloads must 422 with per-type details)
- [ ] Verify: /api/rfq returns CORS headers and reference ID on success
- [ ] Verify: Resend sends email to parts@jmequipment.net with reference

### WordPress / WooCommerce Staging
- [ ] WooCommerce installed and activated
- [ ] FiboSearch Pro license activated
- [ ] YITH Request a Quote installed (configured to replace Add to Cart)
- [ ] YITH form submission wired to Cloudflare Worker endpoint
- [x] Brand child theme built: `handoff/wp-theme/jme-child/` (Storefront parent; tokens copied from the design system; prices/cart/sale/stock removed in `functions.php`; `/console/*` noindex)
- [ ] Brand child theme applied on staging: colors (#A8353A primary, #7A1F23 hover, #1F1F1F charcoal, #FFFFFF canvas), Barlow Condensed / Barlow / JetBrains Mono
      NOTE: supersedes the earlier #AC1F24 + Oswald/Lato/Roboto Mono spec. The bound JME design system pixel-samples primary red from the logo (#A8353A); #A33238 and #8B3A3A are retired.
- [ ] RFQ confirmation screen shows: reference ID, email copy, DEC-038 routes (email / call / print)
- [ ] Import: 2,223 products from Stage A CSV
- [ ] Verify: Product count, category tree (machine > section > assembly), Goodstrong/Martin never co-listed
- [ ] Search: Exact SKU, spaced SKU (normalized), machine name queries all resolve
- [ ] Verify: No prices or budgetary figures display anywhere on customer-facing surfaces
- [ ] Test on mobile & desktop: product pages load under 3 seconds, no console errors
- [x] Static a11y pass on all customer screens: every input label-associated (visually-hidden labels on the two search fields), icon-only controls carry aria-labels, card grids are real buttons or keyboard-activated with role="button", dialogs carry role/aria-modal, the catalog modal is inert while hidden
- [ ] Run axe in the browser against the deployed WordPress pages (the DC screens are the design source, not the shipped markup)
- [ ] Verify inert on modals while hidden

### Machine Platform (90 Machines)
- [ ] Machine pages live for all product lines, every line RFQ-first
- [ ] No budgetary figures published — the five previously listed figures are withdrawn (ruling 2026-08-17: no prices anywhere, customer-facing or internal display)
- [x] All 90 documented machines resolvable: the 8 with indexed catalogues get full pages; the machine platform carries a "Running something else?" band routing every other machine to the manual-request panel (`Support Hub.dc.html?panel=manual`) — the hub honours `?panel=` for deep links from any surface
- [x] Fitment guard live on the machine platform: parts that do not fit the selected machine are flagged, and machines with no published parts (RollRite, Guillotine, Splicer, Decurler) show an honest empty state routed to RFQ
- [x] Duplicate pre-guard machine platform screen retired (2026-08-18) — `JME Machine Platform (Fitment-Guarded).dc.html` is the only machine platform
- [ ] No firm quotes published
- [ ] Lead times framed as "confirmed at quote"

### Support Hub
- [x] SN 26218 EPC stub states diagram linkage pending (EG-3) — gold left-rule note in Known Issues, plus a live echo when a 26218 serial is entered in the EPC panel. Toggleable via the `epcPending` prop when the publisher documentation lands.
- [x] Manual request form accepts serial/model/doc-type
- [x] Service request form captures name/phone/serial/issue/type and stamps tagged source `service-request` on the request record
- [x] Fitment confirmation form working (SKU + serial/model + context + email)
- [x] Phone (269) 659-0093 and email (parts@jmequipment.net) prominent — contact bar at the top of the hub and inside every panel
- [x] Every submission produces an on-screen reference (`REQ-YYYYMMDD-XXXX`) with the three DEC-038 routes (email / call / print); nothing is auto-sent and the screen says so
- [x] Worker accepts typed requests: `parts-rfq` (default, back-compatible with the storefront/YITH payload), `manual-request`, `service-request`, `fitment-check`, `epc-lookup`, `sales-inquiry` — each with its own required-field set, its own reference prefix (RFQ- / REQ-), and a typed subject line
- [x] Support hub and request list POST to the Worker when their `endpoint` prop is set; blank endpoint keeps them reference-only with manual routes
- [x] G8 honesty: neither screen claims delivery unless the Worker returned a reference. Manual mode reads "Request ready to send / Nothing has left your browser yet"; a failed POST says so in gold and keeps the manual routes. The stored request list is only cleared once the desk has it
- [ ] Set the `endpoint` prop on both screens to the deployed Worker URL and re-run the 422 / 200 / 429 / honeypot smoke tests per type

### Governance Console (Internal Only)
- [ ] HOLD queue displays 5 Seth rulings as top blocker
- [ ] Price-verification queue shows per-SKU approve path
- [ ] Fitment-classification queue operational
- [ ] Redaction allowlist viewer shows 9/9 NAME_FIX entries
- [ ] Decision-log delta records OQ-009 schema ruling and all governance gates
- [ ] Console not exposed to robots.txt or public nav
- [x] Queue actions are real state, not stubs: price approve/hold flips `_jme_price_status` per SKU with undo, fitment classify sets machine-specific vs confirmation-required, HOLD rulings log and stay held until Stage A is rerun
- [x] Every console action appends a timestamped row to the Decision Log delta view

---

## Launch Sequence (Stage E2)

### 1. DNS & Indexing
```bash
# Flip CNAME to staging-validated WordPress instance
nslookup jmequipment.net
# Verify: 200 OK, no redirects

# Submit to Google Search Console
# Enable indexing; submit sitemap: /sitemap.xml

# Robots.txt: allow public paths, disallow /console/, /internal/
```

### 2. Deployment Confirmation
```bash
# Worker deployed and live
curl -X POST https://jmequipment.net/api/rfq \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","part_number":"TEST-001","quantity":1}'

# Expected: HTTP 200 + reference ID
```

### 3. First Live RFQ
- [ ] Submit an RFQ from the storefront (test account)
- [ ] Confirm: reference ID displayed to user
- [ ] Confirm: DEC-038 fallback routes all functional (copy, CSV, phone, email)
- [ ] Confirm: email lands at parts@jmequipment.net with reference ID, requestor details, part number, quantity
- [ ] Reply from parts@ to user's email with quote

### 4. Analytics & Monitoring
- [ ] GA4 / Consent Manager active (per chosen consent posture)
- [ ] Worker logs monitored for errors: `wrangler tail`
- [ ] 404 monitoring active
- [ ] Hourly check of RFQ inbox for 24 hours (launch day + 1)

---

## Catalog Re-Export Procedure (Minor Bump)

When NAME_FIX or price rulings are updated:

```bash
# 1. Bump rev in JME_Phase1_Remediated_Catalog.xlsx filename
#    e.g., rev 2 → rev 2.1

# 2. Apply NAME_FIX table changes to workbook

# 3. Rerun Stage A: export_woocommerce.py
#    Output: WooCommerce CSV + REST JSON
#    Regression suite: all 9 originals absent, 10 HOLD SKUs flagged, byte-idempotent

# 4. Staging import: reimport products

# 5. C3 gates: verify product count, FiboSearch, no prices, budgetary labels

# 6. Stage E2 step 2: smoke test Worker

# 7. Go-live: repoint WordPress to new product CSV
```

---

## Rollback (Critical Issue)

If a bad import lands or data corruption occurs:

```bash
# 1. Identify last-good artifact (prior rev, checked into git)

# 2. In WordPress admin:
#    - Bulk delete all 2,223 products (Tools → Delete Products)
#    - Or: WP-CLI: wp post delete $(wp post list --post_type=product --format=ids)

# 3. Re-import from last-good CSV

# 4. Rerun C3 gates

# 5. Revert DNS if needed
```

---

## Backup Schedule

**Daily:**
- WordPress wp-content/ and database (MySQL dump)
- /mnt/user-data/outputs/ (all generated artifacts)

**Weekly:**
- Full WordPress site export (UpdraftPlus or similar)
- GitHub commit of all governance decisions and decision-log deltas

**Monthly:**
- Offline copy of JME_Phase1_Remediated_Catalog.xlsx + NAME_FIX table
- Validation regression suite results

---

## Post-Launch (Phase 4 Backlog)

Do NOT build during Phase 1 launch:

- [ ] SEO landing pages for high-value part categories
- [ ] Symptom-based search (e.g., "hydraulic noise" → troubleshooting + parts)
- [ ] Reorder workflow for returning customers
- [ ] Supersession surfacing ("possible alternate, confirm with JME")
- [ ] Multi-serial EPC ingestion when Goodstrong data arrives
- [ ] Martin alias ruling implementation (if approved)

---

## Handoff package

`handoff/` — `README.md` (screen specs, tokens, behavior), `standalone/` (nine offline HTML design references, cross-linked), `wp-theme/jme-child/`, `deploy/` (this runbook, REPLICATION.md, Worker, Stage A scripts). Regenerate the standalone files after any screen edit; they embed a snapshot.

## Emergency Contacts

- **Riley Wentzel** (Sales Manager, final approvals): [contact]
- **Seth** (Owner, price rulings): [contact]
- **Parts Desk**: parts@jmequipment.net | (269) 659-0093
- **Cloudflare Support**: [link]
- **Resend Support**: [link]
