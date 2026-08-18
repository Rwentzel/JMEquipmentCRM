# JM Equipment finance-system

A **local-first**, standard-library Python engine for JM Equipment's monthly sales, cost,
profitability, and commission close. It reproduces useful **workflows and reporting
concepts** of QuickBooks Desktop Enterprise 2024 — it is **not** a QuickBooks clone and
copies no proprietary code, branding, or interface.

> ⚠️ **Confidential data never enters git.** Only code, schema, docs, and **sanitized**
> fixtures are committed. Real prices/costs/margins/customers live only in a gitignored
> local SQLite DB (`.data/`) and `private/` inputs. See `docs/THREAT_MODEL.md`.

This is **Exchange 3** of a five-exchange build (see `docs/FIVE_EXCHANGE_DELIVERY.md`).
Exchange 1 delivered the executable foundation; Exchange 2 the full intake → posting →
reconciliation → A–K reporting workflow; Exchange 2.1 the reporting-integrity gate (explicit
report scope, reconciling cost/units/commission bridges, per-report integrity assertions and
manifests). **Exchange 3** adds the operator interface and the remaining business breadth:
a local web console, **multi-line documents**, **cash application** (invoiced vs collected vs
outstanding), **configurable vendor-cost evidence**, **crating revenue/recovery**, and
**validated backup / preview / safe restore**.

## Requirements
Python 3.11+. **No third-party packages** — the engine, CLI, and web console are standard
library only. `openpyxl` is an optional extra for direct `.xlsx` intake (ADR-0007).

## Run
From this directory (`finance-system/`):

```bash
# Full test suite (stdlib unittest; no pytest needed) — 204 tests
python -m unittest discover -s tests -t .
# Same, with unclosed-connection warnings treated as errors (must pass)
python -W error::ResourceWarning -m unittest discover -s tests -t .

# End-to-end sanitized MONTHLY-CLOSE demo (import→post→snapshots→reconcile→A–K→export→
# resolve→recompute→idempotent re-import→period lock→backup→scan)
python -m finance_system.demo

# Exchange-1 skeleton smoke test (classifications + separated totals)
python -m finance_system.smoke

# Verify the install works end-to-end (in-memory; no real data touched)
python -m finance_system.cli selfcheck

# Local operator WEB CONSOLE (browser, loopback-only) — recommended for operators
python -m finance_system.webapp            # then open http://127.0.0.1:8765

# Operator CLI
python -m finance_system.cli initialize
python -m finance_system.cli import fixtures/sample_month_v2.csv --period 2026-06 --post
python -m finance_system.cli report --period 2026-06     # exit code 3 if integrity fails
python -m finance_system.cli export --period 2026-06
python -m finance_system.cli receivables --period 2026-06   # invoiced vs collected vs outstanding
python -m finance_system.cli verify-backup <file.db>        # validate a backup
python -m finance_system.cli restore-preview <file.db>      # what a restore would change
python -m finance_system.cli period show                    # reporting-period lifecycle
python -m finance_system.cli find INV-1001                  # locate a document
python -m finance_system.cli explain <transaction_id>       # why every number is what it is
python -m finance_system.cli master customer Northwind      # master-data lookup + history
python -m finance_system.cli config show                    # controlled configuration
python -m finance_system.cli match-payments --period 2026-06  # propose payment matches

# Confidential-data safety scan over git-tracked + staged files (exit != 0 on HIGH)
python scripts/safety_scan.py
```
See `docs/RUNBOOK.md` for controlled **real-data activation** on Windows,
`docs/OPERATOR_GUIDE.md` for the full CLI/console workflow, `docs/CALCULATION_REFERENCE.md`
for formulas/evidence, `docs/DATA_DICTIONARY.md` for the schema, and `docs/AUDIT.md` for the
audit against the repository's data-boundary/readiness governance docs.

The SQLite database is created on demand under `.data/finance.db` (gitignored). Override its
location with `FINANCE_DATA_DIR`.

## Architecture
| Module | Responsibility | ADR |
|---|---|---|
| `money.py` | Exact money/quantity as integer minor units (scale 4); ratios as decimal strings | ADR-0003 |
| `ids.py` | Opaque internal primary keys; external ids kept separate (never a join key) | ADR-0006 |
| `policies.py` | Immutable, **versioned** calculation policies | ADR-0005 |
| `formulas.py` | Deterministic formulas + weighted totals; margin ≠ markup; `None` on zero denominator | — |
| `verification.py` | **Calculation-level** verification state (verified/provisional/unverified) | — |
| `evidence.py` | Configurable evidence-requirements matrix + classification engine | — |
| `models.py` | Transaction types, date kinds, cost-component types, snapshots | ADR-0004 |
| `db.py` + `migrations/` | SQLite connection + forward-only migrations | ADR-0004 |
| `imports.py` | Reversible import batches, source lineage, hashing, idempotency, rollback, period-lock | — |
| `audit.py` | Append-only, PII-free audit log (DB-enforced) | ADR-0002 |
| `exception_register.py` | "Where's Your Proof?" exceptions; resolve-and-reclassify with retained history | — |
| `reporting.py` | Verified/Provisional/Exception/Estimated/Forecast separated totals + reconciliation bridge | — |
| `scanner.py` | Heuristic confidential-data scanner | ADR-0002 |
| `smoke.py` | End-to-end sanitized vertical slice | — |
| **Exchange 2 →** | | |
| `parsing.py` | CSV/TSV/JSON/pasted parsing; gated XLSX | ADR-0007 |
| `normalize.py` | Field normalization with preserved lineage | — |
| `mapping.py` | Mapping profiles + confidence (exact/strong/ambiguous/unmapped) | — |
| `staging.py` | Stage a mapped row → transaction/line/costs + classify | — |
| `dedup.py` | Exact + likely duplicate detection (never merges) | — |
| `conflicts.py` | Conflict detection over staged rows | — |
| `posting.py` | Transactional posting + **snapshot persistence** (Defect 1) | ADR-0005 |
| `snapshots.py` | Append-only calculation snapshots | ADR-0005 |
| `resolution.py` | Evidence resolution → recalc + supersede + reclassify | — |
| `reconcile.py` | Reconciliation engine with explicit tolerances | — |
| `batch_report.py` | Full A–K batch report | — |
| `export.py` | CSV export package (private, timestamped) | — |
| `cli.py` | Operator command-line workflow | — |
| `demo.py` | End-to-end sanitized monthly-close demonstration | — |
| **Exchange 2.1 →** | | |
| `scope.py` | Explicit immutable `ReportScope` for every report/count/total | ADR-0008 |
| **Exchange 3 →** | | |
| `webapp.py` | Local operator web console (stdlib, loopback-only) | — |
| `cash.py` | Cash application: balances, partial/over payment, unapplied cash, reversal | — |
| `cost_evidence.py` | Configurable vendor-cost evidence types + acceptance policy | — |
| `backup.py` | Backup validation, restore preview, safe restore with safety backup | — |
| `periods.py` | Reporting-period lifecycle; authorized reopen; audited transitions | — |
| `explain.py` | Traceability: full provenance behind any reported figure | — |
| `masterdata.py` | Customer/vendor/product lookup, aliases, price & cost history | — |
| `config.py` | Settings, versioned policies & commission rules, mapping profiles, evidence acceptance | — |
| `payment_matching.py` | Explainable payment→invoice match proposals (approval required) | — |

## Key design commitments
- **Internal keys, not SKU**, for all joins; external identifiers preserved separately.
- **Integer minor units** for money — never binary float.
- **Versioned policies**; historical results are never silently recomputed.
- **Calculation-level verification** — a record can be revenue-verified yet
  profit-unverified; totals are always split, never blended into one headline number.
- **Reversible imports** — a rejected/failed batch never contaminates posted records.
- **Accounting distinctions preserved** — quote ≠ sales order ≠ invoice ≠ shipment ≠
  payment ≠ credit memo, with separate date concepts.

See `docs/adr/` for the reasoning behind each.
