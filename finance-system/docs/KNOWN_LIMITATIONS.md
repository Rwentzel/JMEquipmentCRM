# Known limitations (as of Exchange 2.1)

Concrete, honest limitations — not aspirational gaps.

0. **Report-level time travel is snapshot-granular.** `ReportScope.as_of_timestamp` and
   `snapshots.current_snapshots(as_of=...)` reproduce a *calculation's* prior value exactly
   (verified in `test_snapshot_selection`). Full report-metric time travel (rendering every
   A–K number from historical snapshots) is not yet wired — scoped report metrics read the
   current verification state. The snapshot history is the authoritative reproducibility
   record; rendering an entire historical report is an Exchange 3+ item.
1. **Single line per transaction.** Intake maps one source row to one transaction with one
   line. True multi-line documents (one invoice, many lines) are not yet modeled; two rows
   sharing an invoice number are treated as separate transactions and surface as a
   likely-duplicate/conflict for review. Header/line separation is an Exchange 3 item.
2. **XLSX is untested here.** `openpyxl` is not installed in this environment, so the XLSX
   parse path is exercised only by its gating test (clear failure + convert-to-CSV guidance).
   No Excel compatibility is claimed until tested with the optional extra (ADR-0007).
3. **No QuickBooks compatibility claim.** External identifiers are preserved; there is no
   IIF/SDK/Web Connector integration and no compatibility assertion (ADR-0006).
4. **Confidential-data scanner is heuristic.** It reduces accidental-leak risk but does not
   guarantee confidentiality; it can miss novel formats or raise false positives. The safety
   scan is run manually / in CI, not yet enforced as a managed pre-commit hook.
5. **Payments/credits reconciliation is limited.** Payments and sales orders are stored and
   excluded from revenue totals, but invoice-vs-payment application (partial payments,
   overpayment linkage) is only partially reconciled; full cash application is later work.
6. **Deterministic analytics only.** Exchange 2 analytical findings are deterministic
   observations (no forecasts or predictive claims).
7. **`freight_recovery` / `crating_recovery` heuristics.** Recovery is computed as customer
   freight billed minus freight-out cost (crating: negative of crating cost, since there is
   no separate crating-revenue column yet). Refine when a crating-revenue field is added.
8. **Verified-cost substantiation.** Cost verification does not yet require a vendor bill
   reference; the "cost without vendor evidence" conflict flags this but does not block
   verification. Tightening this is a policy/evidence-matrix change.
