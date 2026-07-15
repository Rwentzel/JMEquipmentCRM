# JM Equipment finance-system

A **local-first**, standard-library Python engine for JM Equipment's monthly sales, cost,
profitability, and commission close. It reproduces useful **workflows and reporting
concepts** of QuickBooks Desktop Enterprise 2024 — it is **not** a QuickBooks clone and
copies no proprietary code, branding, or interface.

> ⚠️ **Confidential data never enters git.** Only code, schema, docs, and **sanitized**
> fixtures are committed. Real prices/costs/margins/customers live only in a gitignored
> local SQLite DB (`.data/`) and `private/` inputs. See `docs/THREAT_MODEL.md`.

This is **Exchange 2** of a five-exchange build (see `docs/FIVE_EXCHANGE_DELIVERY.md`).
Exchange 1 delivered the executable foundation (money/formula core, versioned policies,
calculation-level evidence & verification, generic transaction schema, reversible import
batches, append-only audit, exception register, confidential-data scanner). Exchange 2 adds
the full monthly-close workflow: CSV/TSV/JSON/pasted intake, mapping profiles, normalization,
staging, duplicate + conflict detection, transactional posting with **persisted calculation
snapshots**, evidence resolution, a reconciliation engine, the A–K batch report, CSV export,
and an operator CLI — plus the two Exchange-1 financial-integrity fixes (snapshot persistence
and a profitability-verified margin population).

## Requirements
Python 3.11+. **No third-party packages** for the Exchange 1 core (stdlib only). Optional
extras (Excel, UI) arrive in later exchanges — see `pyproject.toml`.

## Run
From this directory (`finance-system/`):

```bash
# Full test suite (stdlib unittest; no pytest needed) — 120 tests
python -m unittest discover -s tests -t .
# Same, with unclosed-connection warnings treated as errors (must pass)
python -W error::ResourceWarning -m unittest discover -s tests -t .

# End-to-end sanitized MONTHLY-CLOSE demo (import→post→snapshots→reconcile→A–K→export→
# resolve→recompute→idempotent re-import→period lock→backup→scan)
python -m finance_system.demo

# Exchange-1 skeleton smoke test (classifications + separated totals)
python -m finance_system.smoke

# Operator CLI
python -m finance_system.cli initialize
python -m finance_system.cli import fixtures/sample_month_v2.csv --period 2026-06 --post
python -m finance_system.cli report --period 2026-06
python -m finance_system.cli export --period 2026-06

# Confidential-data safety scan over git-tracked + staged files (exit != 0 on HIGH)
python scripts/safety_scan.py
```
See `docs/OPERATOR_GUIDE.md` for the full CLI and workflow, `docs/CALCULATION_REFERENCE.md`
for formulas/evidence, and `docs/DATA_DICTIONARY.md` for the schema.

The SQLite database is created on demand under `.data/finance.db` (gitignored). Override its
location with `FINANCE_DATA_DIR`.

## Architecture (Exchange 1)
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
