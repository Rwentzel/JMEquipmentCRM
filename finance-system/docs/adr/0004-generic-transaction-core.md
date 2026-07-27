# ADR-0004: Generic transaction core vs specialized tables

**Status:** Accepted (Exchange 1) · **Date:** 2026-07-15

## Context
Correction #2: do not create every future table before the domain is validated.
Correction #3: accounting distinctions (quote, sales order, invoice, shipment, payment,
credit memo, purchase order, item receipt, vendor bill, vendor payment, journal entry) must
be preserved — revenue, cost, cash, commission, and fulfilment dates must not be conflated.

## Decision
A **generic `transactions` core** carries a `transaction_type` discriminator (see
`models.TransactionType`) plus a `transaction_lines` child and a `cost_components` child.
The durable minimum domain (Correction #2) is: import batches, source files, source
records, customers, vendors, products + aliases, transactions, transaction lines, cost
components, commission rules + calculations, record verifications, exceptions,
reconciliation findings, reporting periods, calculation snapshots, external identifiers,
audit events.

Accounting distinctions are preserved *within* the generic core by:
- the `transaction_type` enum (distinct types, never merged);
- **separate date columns** for every date concept (transaction/order/invoice/ship/due/
  payment/cost-recognition/commission-eligibility/period-assignment);
- separate revenue vs cost storage (`transaction_lines` amounts vs `cost_components`).

Specialized quote/SO/invoice/PO/bill/payment tables are **deferred** until a distinction is
operationally required or the generic model would compromise integrity or traceability.

## Consequences
- One import/verification/reporting path serves all sale-document types today; less schema
  to maintain before real records are examined.
- Reporting filters by `transaction_type` and by the correct date concept, so cash vs
  revenue vs fulfilment timing stay distinct.
- When a type needs fields the generic model can't hold cleanly (e.g. payment
  applications, PO receipts against bills), we add a specialized table then and record it in
  a follow-up ADR — not speculatively now.

## Alternatives considered
- **A table per document type up front.** Rejected (Correction #2): wide-but-weak schema
  before workflows are validated; high migration cost if the first real data disagrees.
- **A single flat table with no lines/costs split.** Rejected (Correction #3): would
  conflate revenue and cost and lose line-level verification.
