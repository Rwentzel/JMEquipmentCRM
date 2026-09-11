# DATA BOUNDARIES — JM Equipment Parts Store

**Date:** 2026-06-23 · **Status:** policy for the RFQ-first sandbox.

Classification of every field that exists or could exist in the parts/machine data.
**Public** fields may ship to the client bundle. **Private** fields must never reach
the web tier (no import, no API response, no client bundle). When uncertain, **hide
publicly** and flag here.

Enforcement: allowlist functions in `parts-store/src/data/sanitize.ts` plus a
build-time grep of the compiled output for forbidden tokens (see `IMPLEMENTATION_PLAN_REVISED.md` §15).

| Field | Example / source | Classification | May ship to client? | Reason | Required handling |
|------|------------------|----------------|---------------------|--------|-------------------|
| JM SKU / part # | `JM108` | Public | **Yes** | Customer-facing identifier | Display as-is (mono) |
| Product title (sanitized) | `Knife Bearing — Lower` | Public | **Yes** | Identify the part | Sanitize; no vendor/OEM hints |
| General description (sanitized) | product blurb | Public | **Yes** | Customer information | Sanitize; strip internal notes |
| Machine family | `Sheeter` | Public | **Yes** | Navigation / compatibility | Display |
| Category | `Hydraulic` | Public | **Yes** | Filtering | Display |
| Public status band | `Quote Required` | Public | **Yes** | Availability signal | One of 7 bands only |
| RFQ action | `request-quote` | Public | **Yes** | Drives CTA | Map to CTA label |
| Verified general compatibility | "fits 1650 line" | Public (if verified) | **Yes, if approved** | Reduces wrong orders | Only when verified |
| Approved image / placeholder | `placeholder.svg` | Public | **Yes** | Visual | Approved assets only |
| **Sell price** | `$142.00` | **Private** | **No** | RFQ-first; pricing policy | Exclude from model & bundle |
| **Cost** | internal | **Private** | **No** | Proprietary | Never import |
| **Margin / markup** | internal | **Private** | **No** | Proprietary | Never import |
| **Exact inventory quantity** | `7 on hand` | **Private** | **No** | Competitive; volatile | Use status band only |
| **Vendor name** | supplier | **Private** | **No** | Sourcing protection | Never import |
| **Vendor part number** | supplier P/N | **Private** | **No** | Sourcing protection | Never import |
| **OEM cross-reference** | `62210-2RS1` | **Private unless approved** | **No (default)** | Sourcing / IP | Only if explicitly approved per-item |
| **Internal alias / "was part #"** | alternate P/N | **Private** | **No** | Internal mapping | Never import |
| **Bin location** | `A-12` | **Private** | **No** | Warehouse internal | Never import |
| **Supplier / source notes** | free text | **Private** | **No** | Sourcing protection | Never import |
| **QuickBooks reference** | QB item id | **Private** | **No** | Financial system | Never import |
| **Customer-specific pricing** | contract price | **Private** | **No** | Confidential | Never import |
| **Full raw catalog export** | master file | **Private** | **No** | Bulk exposure | Never ship; server-side only if ever |
| **Staff-only tools** | admin surface | **Private** | **No** | Internal | Separate gated app/route |
| RFQ form input (company / name / email / phone / serial / shipping & billing address / message) | user-entered | PII (server-side) | **N/A — not bundled** | Customer contact | Validate server-side; **no PII logging**; persisted only in gitignored `.data/`, readable only via ops-authenticated API |
| Assistant question text | user-entered | PII-adjacent (transient) | **N/A** | Support routing | Never logged or persisted; answered from public catalog/FAQ only |
| Quote Center data (quotes, client book, equipment sell pricing, cost/margin) | internal | Internal (PII + pricing) | **No** | Quoting workflow | Server-side .data/ only; ops-authed API; customer sees ONLY their own quote via unguessable share token (the policy's "written quote"); cost/margin never on customer surfaces. Seed pricing and client records live in `src/lib/qc/data.ts` (**server-only**, imported by `store.ts` alone); client-safe display strings live in `src/lib/qc/labels.ts`. Enforced by `npm run verify:bundles` in CI |
| Audit log events | system | Internal (non-PII) | **No** | Abuse detection | Event kind + counts + hashed client key only; no user strings, no IPs |
| Purchasing / reorder notes in a part name ("Min buy 10", "MOQ 4", "from <supplier>", "= /each") | private export | **Private** | **No** | Internal reorder rules and sourcing | Stripped by the generator (`scripts/generate-public-catalog.py` PRICE_NOISE); `tests/publicNames.test.ts` keeps the committed catalog honest between regenerations; `npm run scan:artifacts` reads every prerendered customer page as a customer would and fails CI on price, cost, vendor, margin, bin, quantity or purchasing language (`src/lib/artifactScan.ts`) |
| Part-number provenance | catalogue | — | — | BUILD_PROMPT ruling 3: every shown part number is real | Generated web references are minted from QuickBooks rows by the generator (provenance by construction, crosswalk private); curated parts carry JME governance numbers from the Parts Master (`tests/curatedProvenance.test.ts` checks the shape; resolving them against the workbook is a release-time step); manual diagram numbers are transcribed from cited catalogue pages (`tests/provenance.test.ts`); configurator ids are internal keys, never part numbers (below) |
| Configurator choice ids (`DetailChoice.id`, e.g. an internal key per choice) | internal key | Internal (non-secret) | Yes, as keys only | Lets a choice travel browser → intake as an id the server resolves against its own data (`lib/rfqConfig.ts`) | **Never a part number, never rendered, never on a desk surface.** Only the resolved label (`v`) is shown or sent. Gated by `tests/optionIdGate.test.ts` and the smoke flow "configurator ids never reach a screen or the desk" (owner ruling 2026-09-10) |
| Support request (kind + typed details: model, document, service type, part, topic) | user-entered / our own option lists | PII (server-side) | **N/A — not bundled** | Manual, service, fitment, EPC and sales requests | Same store, desk email, CSV and ops row as an RFQ, under a `REQ-` reference; every select is resolved server-side against our own lists so a value off the list is rejected, never passed on; never reorderable |
| Customer's own mail-client draft ("Email this list" / "Email it") | built in the browser from the customer's own list or form | Customer-held | **N/A** | Off-line route beside the send button (DEC-038: email / call / print) | A `mailto:` link only — never touches the intake, the store, the desk email or the CSV; capped in length; carries no price or availability language |

## Public status bands (the only allowed public availability labels)
`In Stock` · `Limited Stock` · `Backorder` · `Call for Availability` · `Quote Required` · `Freight Quote Required` · `Discontinued / Contact JM`

**No exact quantity counts are ever shown publicly.**

## Handling rules
1. Components receive only sanitized objects (`toPublicPart` / `toPublicMachine`).
2. A dev-time guard throws if any forbidden key appears on an input record.
3. Any raw status/lead-time is normalized to one of the 7 bands before render.
4. The build is grepped for `$`, price/cost/margin/vendor tokens, and bare quantities; a hit fails verification.
5. New data sources must be classified in this table before import.
6. `npm run verify:bundles` (CI, after the production build) scans every emitted
   client chunk for the internal Quote Center values, deriving them from the seed
   data at runtime so the check cannot drift. Note the threat it addresses:
   `.next/static/**` is served **without authentication**, so "that chunk only
   loads on an ops-gated page" is not by itself a control — the file is fetchable
   by anyone holding its URL. High-confidence values (emails, phone numbers,
   five-figure prices) fail on a single hit; ambiguous small amounts fail when
   three or more from one record co-occur in a chunk, which is what a genuinely
   leaked record looks like. Verified to fail on a deliberately injected leak.
