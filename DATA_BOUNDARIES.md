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
| RFQ form input (company / name / email / phone / serial) | user-entered | PII (server-side) | **N/A — not bundled** | Customer contact | Validate server-side; **no PII logging**; persisted only in gitignored `.data/`, readable only via ops-authenticated API |
| Assistant question text | user-entered | PII-adjacent (transient) | **N/A** | Support routing | Never logged or persisted; answered from public catalog/FAQ only |
| Audit log events | system | Internal (non-PII) | **No** | Abuse detection | Event kind + counts + hashed client key only; no user strings, no IPs |

## Public status bands (the only allowed public availability labels)
`In Stock` · `Limited Stock` · `Backorder` · `Call for Availability` · `Quote Required` · `Freight Quote Required` · `Discontinued / Contact JM`

**No exact quantity counts are ever shown publicly.**

## Handling rules
1. Components receive only sanitized objects (`toPublicPart` / `toPublicMachine`).
2. A dev-time guard throws if any forbidden key appears on an input record.
3. Any raw status/lead-time is normalized to one of the 7 bands before render.
4. The build is grepped for `$`, price/cost/margin/vendor tokens, and bare quantities; a hit fails verification.
5. New data sources must be classified in this table before import.
