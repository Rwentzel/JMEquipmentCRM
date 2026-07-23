# ADR-0006: QuickBooks adapter boundary

**Status:** Accepted (Exchange 1) · **Date:** 2026-07-15

## Context
Correction #6: treat QuickBooks integration as an adapter boundary. Do not create or imply
direct QuickBooks synchronization in this milestone. No compatibility claim may be made
until tested against an authorized QuickBooks Desktop Enterprise 2024 environment and
representative exports. Correction #1: SKU and other external identifiers must not be primary
join keys.

## Decision
- **No QuickBooks coupling in Exchange 1.** No IIF/SDK/Web Connector code, no live sync.
- External identifiers (QuickBooks list IDs, transaction IDs, edit sequences, invoice/SO/PO
  numbers, vendor item numbers, manufacturer/JM/customer part numbers, SKU) are preserved in
  a dedicated `external_identifiers` table (namespace + value), **never** used as a primary
  or join key. Internal opaque ids (`finance_system/ids.py`) are the only join keys.
- A future adapter interface (planned, not implemented this exchange) will own IIF/CSV/Excel
  import-export and List/Txn-ID mapping, isolated behind a boundary module so the core never
  depends on QuickBooks specifics.
- The system reproduces useful QuickBooks **workflows and reporting concepts** only. It is
  **not** a QuickBooks clone and copies no proprietary code, branding, or interface. No
  compatibility is asserted until validated against an authorized environment.

## Consequences
- SKU works as a product alias / lookup value (`product_aliases`) and a future QB mapping
  candidate, but a SKU change or reuse never corrupts transaction joins.
- Adding QuickBooks import/export later is an adapter, not a refactor of the core.

## Alternatives considered
- **Join on SKU / QB item id directly.** Rejected (Correction #1): external ids can be
  duplicated, changed, missing, or scoped to other entities.
- **Build an IIF exporter now.** Rejected (Correction #6): premature and unverifiable without
  an authorized QB test environment; would invite an untested compatibility claim.
