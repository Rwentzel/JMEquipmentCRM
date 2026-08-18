# Known limitations (as of Exchange 3)

Concrete, honest limitations — not aspirational gaps.

0. **Report-level time travel is snapshot-granular.** `ReportScope.as_of_timestamp` and
   `snapshots.current_snapshots(as_of=...)` reproduce a *calculation's* prior value exactly
   (verified in `test_snapshot_selection`). Full report-metric time travel (rendering every
   A–K number from historical snapshots) is not yet wired — scoped report metrics read the
   current verification state. The snapshot history is the authoritative reproducibility
   record; rendering an entire historical report is an Exchange 3+ item.
1. ~~Single line per transaction.~~ **Resolved (Exchange 3).** Rows sharing a document
   identity form one transaction with many lines; duplicate detection runs at document, line,
   and source-row level. Remaining nuance: document grouping keys on the document number +
   party, so a source file that reuses one invoice number for genuinely different documents
   needs a mapping profile that supplies a distinguishing field.
2. **XLSX requires the optional `openpyxl` extra.** When it is installed, a real generated
   workbook is parsed and asserted in `test_xlsx_real` (numeric/date cells, formula cells per
   the data-only policy, hidden sheets ignored); when it is absent those tests skip honestly
   and intake raises a clear convert-to-CSV error. Excel is therefore supported *only* with
   the extra installed, and no QuickBooks-export compatibility is claimed (ADR-0007).
3. **No QuickBooks compatibility claim.** External identifiers are preserved; there is no
   IIF/SDK/Web Connector integration and no compatibility assertion (ADR-0006).
4. **Confidential-data scanner is heuristic.** It reduces accidental-leak risk but does not
   guarantee confidentiality; it can miss novel formats or raise false positives. The managed
   pre-commit hook is opt-in (`scripts/install-safety-hook.sh`), not installed automatically.
5. ~~Payments/credits reconciliation is limited.~~ **Resolved (Exchange 3).** Full cash
   application: balances, partial/multiple payments, authorized overpayment, unapplied cash,
   credits, returns, and reversals, with invoiced revenue / collected cash / outstanding
   receivable kept separate. Remaining nuance: applications are recorded through the service
   or CLI; automatic matching of a payment file to open invoices is not implemented.
6. **Deterministic analytics only.** Exchange 2 analytical findings are deterministic
   observations (no forecasts or predictive claims).
7. **`freight_recovery` heuristic.** Freight recovery is customer freight billed minus
   freight-out cost. (Crating recovery now uses a real crating-revenue field — resolved.)
8. ~~Verified-cost substantiation.~~ **Resolved.** `resolution.apply_cost_evidence`
   (CLI: `evidence <line_id> --type ...`) records an alternative evidence type, re-runs that
   line's cost classification against the configured acceptance policy, supersedes its
   snapshots, and audits the transition.
9. **No role-based access.** The engine is a single-operator local application; the console
   binds to loopback only and there is no login. Multi-user access with roles (mirroring the
   storefront's OPS_TOKEN -> SSO path) is not implemented.
10. **Automatic payment matching.** Cash application is exact and audited, but matching an
   incoming payment file to open invoices automatically is not implemented — applications are
   made through the service/CLI.
