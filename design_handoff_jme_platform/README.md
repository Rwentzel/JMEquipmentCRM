# Handoff: JME Parts Platform (nine screens, two tracks)

Package for the developer (or Claude Code) implementing the JM Equipment customer platform. **Read `BUILD_PROMPT.md` first** — it records the owner rulings (2026-09-10): both tracks ship (Next.js `parts-store` + WordPress/WooCommerce), full catalog, RFQ-only, every path routes to the request list. Everything a non-author needs is in this folder.

```
handoff/
├─ README.md                 ← this file
├─ BUILD_PROMPT.md           ← owner rulings + scope + build order (read first)
├─ standalone/               ← nine self-contained HTML design references (open offline, links work between them)
├─ wp-theme/jme-child/       ← Storefront child theme built from the design-system tokens
└─ deploy/
   ├─ LAUNCH.md              ← launch runbook and gates (Stage E)
   ├─ REPLICATION.md         ← end-to-end rebuild guide, Stages A–E, API contract, screen inventory
   ├─ github.md              ← repo binding (Rwentzel/JMEquipmentCRM · main · parts-store), screen → source map, last sync
   ├─ worker/                ← rfq-worker.js + wrangler.toml (POST /api/rfq, six request types)
   └─ data/                  ← export_woocommerce.py, test_regression.py, redaction_allowlist.json (Stage A)
```

## Overview

JM Equipment (Sturgis, MI) sells and services paper-converting machinery: Goodstrong sheeters, the JME hydraulic core splitter, rebuilt Geo M. Martin rollstands, RollRite, and the JME Linear Dancer System. The platform is **RFQ-first**: no price, cost, margin, vendor, bin location or exact quantity appears on any surface. Customers build a request list, then send it to the parts desk by email, phone or print (decision DEC-038). Availability is expressed only through seven approved status bands. Catalog truth is the full QuickBooks export (2,223 parts); the 1,887-row remediated subset referenced in `deploy/` is superseded — see `BUILD_PROMPT.md`.

## About the design files

`standalone/*.html` are **design references built in HTML** — working prototypes showing intended look and behavior, not production code to ship. The task is to recreate them in the WordPress / WooCommerce environment using the child theme in `wp-theme/` (tokens, component classes) and the plugins named in `deploy/REPLICATION.md` (YITH Request a Quote, FiboSearch Pro). The internal Governance Console may stay a standalone page behind Cloudflare Access.

Each standalone file embeds its fonts, images, the design-system bundle and runtime; open it from disk with no network. Cross-links point at sibling files in the same folder. The editable sources (`*.dc.html`) live at the project root alongside `_ds/` (design system) and `parts-store/public/` (photos, logo).

## Fidelity

**High-fidelity.** Colors, type, spacing, states and copy are final. Recreate pixel-accurately using the token variables, not literal hex. Copy is verbatim customer-facing text approved through the governance process; do not rewrite it.

## Shared shell (all customer screens)

- Page: `background: var(--ink) #141414`, `color: var(--paper) #EDEAE4`, body font Barlow 15px / 1.55.
- Top bar: sticky, `rgba(16,16,16,.94)` + `backdrop-filter: blur(10px)`, `border-bottom: 1px solid var(--line) #33312E`, padding `14px 32px`, flex, gap 22–28px. Logo `jme-logo-full-source.jpg` at 32px tall on a white 2px-radius chip (`padding 3px 7px`). Links Barlow Condensed 13px uppercase, `letter-spacing .06em`, `var(--paper-dim) #B9B4AA`, current page `var(--paper)`. Right side: `Sales: (269) 659-0093` in JetBrains Mono 12px, then a ghost "Request list" button (Barlow Condensed 12px 700 uppercase, `1px solid var(--line-lt) #444240`, radius 2px, padding `7px 13px`).
- Content max width 1280px, 32px gutters, left-anchored (never centered-floating).
- Card: `background var(--charcoal) #1F1F1F`, `1px solid var(--line)`, radius 3px, overflow hidden. Hover: border `var(--line-lt)`, shadow `0 10px 30px rgba(0,0,0,.4)`.
- Machine photos sit on `#f3f3f1` with `object-fit: contain` (product renders) or `cover` (shop photos). Machines with no photograph show `jme-diamond-cut.png` at 96px with the caption "No JME photograph on file" — never a stock image.
- Callout with left rule: card + `border-left: 3px solid var(--jme-red)`, radius `0 3px 3px 0`, padding `26px 28px`. Gold left rule (`var(--jme-gold) #B8920A`) means "pending / consult", never an error.
- Links: underline `2px var(--jme-red)`, offset 3px; hover `3px var(--jme-red-bright) #C0413F`. Focus ring `2px solid #C0413F`, offset 2px.
- Red as small text on dark fields is never `#A8353A` (fails contrast). Use `--jme-red-text #E08A8E` or the ghost pattern.
- Motion: `cubic-bezier(.4,0,.2,1)`, 150 / 250 / 350ms, no bounce. Respect `prefers-reduced-motion`.
- No emoji, no `alert()`; confirmations render in place with a reference number.

## Screens

### 1. Storefront — `JME Storefront.html`
Landing page. Hero (two columns 1.1fr / 1fr, gap 40px): eyebrow, H1 Barlow Condensed 800 uppercase ~64px, lead paragraph 17px `var(--paper-dim)`, a search form (single input + red button) that hands off to the catalog as `?q=`, two ghost links (Machines / Support). Right: core-splitter render on a `#f3f3f1` panel 380px tall. Below: three product-line cards (auto-fit ≥300px, gap 18px; image well 190px, body padding `22px 24px 26px`), a "3x densification" story with the pallet before/after image (toggle `showDensification`), used-equipment band (toggle `showUsedEquipment`), and three routes cards with red left rules: Parts desk → Catalog, Manuals & diagrams → Goodstrong Manual, Why we quote → RFQ Flow.
**State:** `query`. Submit navigates to `JME Catalog - Repo-Driven.html?q=<encoded>`.

### 2. Catalog — `JME Catalog - Repo-Driven.html`
Parts and machine catalog from `src/data/catalog.ts` (nine machine lines incl. Linear Dancer JME-LD-12). Sticky bar with in-page anchors (Machines / Parts). Search input filters machine name, SKU, family, and part name/SKU/category (not symptom keywords — Phase 4). Machine grid: cards with 196px image well, a status `Tag` (design-system component) top-left at 12px inset, name (Barlow Condensed 22px), family, "View" ghost button. Parts table: mono SKU column, name, category, status badge (seven bands), "Add to request" button. Clicking a machine or part opens a modal (`role="dialog" aria-modal`, `inert` while hidden, Esc closes): 240px image band for machines, outcomes list, spec table, "Add to request" / "Ask about fitment".
**State:** `q`, `machineFilter`, `open` (sku), `list` (persisted). Reads `?q=` on load.

### 3. Machine Platform — `JME Machine Platform - Fitment-Guarded.html`
One page per machine line via a left machine rail (240px) and a detail column. Detail: 290px photo panel (or the no-photo state), name, blurb, "Best for" list, spec plate (`.jme-plate` dark gradient, mono values), curated parts for that machine. **Fitment guard:** parts that do not fit the selected machine are flagged with a gold "Confirm fitment" tag and the add button becomes "Ask about fitment". Machines with no published parts (RollRite, Guillotine, Splicer, Decurler) render an honest empty state: "No published parts for this machine yet" with a single red "Request parts" button. Bottom band "Running something else?" routes every undocumented machine to `JME Support Hub.html?panel=manual`.
**State:** `sel` (machine sku), `list`.

### 4. Machine Detail (Configurator) — `JME Machine Detail - Configurator.html`
Single-machine sales page with tabs across the top bar (1650 / Core splitter / Martin rollstand / RollRite / Linear Dancer; current tab solid red). Left: 4:3 hero image (`object-fit` per shot, `padding 22px` when contain) and a gallery row of 4:3 thumbnails (selected border `var(--jme-red)`, others `var(--line)`); thumbnails switch the hero immediately (state, not polling). Right: eyebrow (`Goodstrong · Factory-direct` in gold 11px, `.28em` tracking), H1 Barlow Condensed 800 ~56px, lead 18px, body 15px `var(--paper-dim)`, a three-cell spec strip (values Barlow Condensed 26px gold, labels 10px uppercase), proof stat with quote, downloads list, configurator: option groups (radio cards, selected border red) build a `configLabel`; "Add configured machine to request" writes an item with `options[]` (choice SKUs) and `configLabel`.
**State:** `tab`, `shot`, `choices{}`, `list`.

### 5. Goodstrong Manual (Diagrams) — `JME Goodstrong Manual - Diagrams.html`
Parts-manual browser transcribed from the S/N 37422 1600-E catalogue. Model tabs (1600-E / 1600 / 1650); the 1600 and 1650 tabs attribute every page label to the 1600-E catalogue and tell the customer not to quote those numbers as their own (`sectionsFrom`). Section list (left, 260px) → exploded-view page with numbered bubbles (dashed cut-line motif above) → parts table (bubble #, part number mono, description, qty, status band, add). Sections without a transcribed table say so instead of inventing rows. Serial lookup modal accepts a serial and states linkage status (SN 26218 EPC pending). Added parts carry `origin {model, section, page, bubble}`.
**State:** `model`, `section`, `page`, `serialOpen`, `list`.

### 6. Support Hub — `JME Support Hub.html`
Contact bar at top (phone, email, hours). Six panels in a 3×2 grid of cards (guides / manual / service / fitment / EPC / sales); opening one expands a form beneath. Each form: `.jme-field__label` 10.5px `.2em` labels, inputs `var(--field) #191816` with `1px var(--line-lt)`, red focus outline. Submit → in-place confirmation card with reference `REQ-YYYYMMDD-XXXX`, the three DEC-038 routes (Email / Call / Print), and the honesty line: "Request ready to send — nothing has left your browser yet" when `endpoint` is blank; with `endpoint` set it POSTs the typed payload and shows the server reference; on failure a gold note keeps the manual routes. Known Issues: gold left-rule note that SN 26218 diagram linkage is pending (`epcPending`), echoed live when that serial is typed. `emergencyBand` shows a red band for outages. Honours `?panel=` deep links.
**Props:** `endpoint` (Worker URL), `epcPending`, `emergencyBand`, `defaultPanel`.

### 7. Request List — `JME Request List - Persistent.html`
Reads `localStorage["jme-request-list"]`. Table: SKU (mono), name, origin/config label, qty stepper (44px hit targets), remove. Contact block (name, company, email, phone, serial/model, notes). Send panel: three route buttons — **Email** (opens `mailto:parts@jmequipment.net` with the list in the body), **Call** (`tel:+12696590093`, shows the reference to read out), **Print** (print stylesheet). Same reference + honesty rules as the hub; the stored list is only cleared once the desk has it (server 200) or the user clears it explicitly. Empty state links back to Catalog and Machines.
**Item shape:** `{sku, name, qty, origin?, options?, configLabel?, source}`.
**Props:** `endpoint`.

### 8. RFQ Flow — `JME RFQ Flow - Data-Driven.html`
Explainer: why JME quotes instead of listing prices. Four numbered steps in a row (numerals Barlow Condensed 48px red), data-boundary table (what we publish / what we confirm at quote), the seven status bands with definitions, FAQ accordion (buttons with `aria-expanded`). Built from `README.md` and `DATA_BOUNDARIES.md` in the repo.

### 9. Governance Console — `JME Governance Console.html` (internal)
Left sidebar 240px (`var(--ink-2) #0F0F12`), views: Critical (HOLD queue — 5 Seth rulings), Price verification, Fitment classification, Redaction allowlist (9/9 NAME_FIX), Decision log delta, Catalog status (1,901 active / 10 HOLD / 14 Tier 1 / 1,887 eligible). Queue actions are real state with undo: approve/hold flips `_jme_price_status`, classify sets machine-specific vs confirmation-required, every action appends a timestamped Decision Log row stamped with `operator`. Not linked from customer nav; deploy behind Cloudflare Access with `noindex`.
**Props:** `defaultView`, `operator`.

## Interactions and behavior (cross-cutting)

- **Request list** is the one shared object. Every "Add" writes to `localStorage["jme-request-list"]` and bumps the header count. The repo uses key `jme_request_v2`; pick one key in production and migrate.
- **References**: `RFQ-` prefix for parts RFQs, `REQ-` for the five support types; format `PREFIX-YYYYMMDD-XXXX`.
- **Worker contract** (`deploy/REPLICATION.md`, "Request API contract"): `POST /api/rfq` with `request_type`; missing type = `parts-rfq`. 422 with `details[]` on validation, 429 on rate limit, honeypot field rejected.
- **Forms**: every input label-associated (visually-hidden labels on the two search fields), icon-only controls have `aria-label`, card grids are buttons or `role="button"` with Enter/Space handling, dialogs `role="dialog" aria-modal="true"` and `inert` while hidden, Esc closes.
- **Responsive**: grids are `auto-fit, minmax(300px, 1fr)`; the machine rail and manual section list stack above content under 900px; the top bar wraps its right cluster under 720px.

## Design tokens

Full set in `wp-theme/jme-child/assets/css/tokens/`. Key values:

- Brand: red `#A8353A`, red deep `#7A1F23` (hover/pressed), red bright `#C0413F` (focus), gold `#B8920A`, charcoal `#1F1F1F`, silver `#C0C0C0`. Chrome ramp `#F4F6FA → #C5CED5 → #A3ADB5 → #72707B → #45444E`.
- Dark surface: ink `#141414`, ink-2 `#0F0F12`, charcoal `#1F1F1F`, plate `#232220` / `#2B2A27`, field `#191816`, line `#33312E`, line-lt `#444240`; text paper `#EDEAE4`, paper-dim `#B9B4AA`, paper-faint `#8D887E`, red-as-text `#E08A8E`.
- Light surface (console/docs): canvas `#FFFFFF`, canvas-tint `#FAFAFB`, panel `#F4F2EE`, hairline `#E5E5E8`, ink-text `#0F0F12`, muted `#6B6B72`.
- Status: green `#2E7D52`, blue `#1F4788`, amber `#B8920A`.
- Type: Barlow Condensed (display, always uppercase), Barlow (body), JetBrains Mono (SKUs, serials, dimensions). Scale 10 / 11 / 13 / 15 / 17 / 22 / 32 / 48 / 72 / 128px. Tracking: display `.02em`, heading `.04em`, eyebrow `.28em`, tag `.16em`. Leading: display 1.0, heading 1.05, body 1.55.
- Spacing: 4-pt steps 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96. Wrap 1280px, gutter 32px, nav 62px, sidebar 240px.
- Radius: 2px default, 3px plates/panels. Shadows: card `0 10px 30px rgba(0,0,0,.4)`, plate `inset 0 1px 0 rgba(255,255,255,.05), 0 12px 34px rgba(0,0,0,.45)`, toast `0 14px 40px rgba(0,0,0,.5)`.
- Gradients only on chrome and the primary button (`--grad-red-btn`); everything else flat.

## Assets

`parts-store/public/brand/jme-logo-full-source.jpg` (logo), `parts-store/public/images/`: `core-splitter.png`, `core-splitter-pump.png`, `sheeter-1650.jpg`, `sheeter-1600e.jpg`, `martin-rollstand.jpg`, `rollrite-gmc.jpg`, `pallet-before-after.png`, `jme-diamond-cut.png` (no-photo state), `placeholder.svg`. All from the repo `Rwentzel/JMEquipmentCRM` under `parts-store/public/`. Fonts from Google Fonts (self-host for production; see theme README).

## Files

- Design references: `standalone/` (nine files, offline).
- Editable sources: project root `JME *.dc.html`, `_ds/…` design system, `parts-store/public/…`.
- Theme: `wp-theme/jme-child/` (`style.css`, `functions.php`, `assets/css/tokens/*`, `assets/css/components.css`, `README.md`).
- Deployment: `deploy/LAUNCH.md`, `deploy/REPLICATION.md`, `deploy/worker/`, `deploy/data/`, `deploy/github.md`.

## Open items before go-live

Seth's five price rulings (10 HOLD SKUs stay excluded until then), Riley sign-off, Worker secrets set and smoke-tested per request type, `endpoint` set on Support Hub and Request List, axe run against the deployed WordPress pages (the design files are axe-clean; the shipped markup must be re-checked).
