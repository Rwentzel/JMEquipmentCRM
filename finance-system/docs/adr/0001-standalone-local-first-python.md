# ADR-0001: Standalone, local-first Python application

**Status:** Accepted (Exchange 1) · **Date:** 2026-07-15

## Context
The wider repository is a **public** Next.js/TypeScript RFQ storefront + ops desk whose
architecture (`DATA_BOUNDARIES.md`) is explicitly designed to keep prices, costs,
margins, vendor and customer data OUT of the web tier and the public repo. The finance
system needs exactly that confidential data. The environment has Python 3.11 available;
no pandas/openpyxl/pytest are installed and network access is not assumed.

## Decision
Build the finance system as a **standalone, local-first Python package** (`finance_system/`)
separate from `parts-store/`. Exchange 1 uses the **standard library only** so it runs on
a stock Python 3.11 install with no third-party packages and no network. Persistence is a
local **SQLite** database under a gitignored `.data/` directory.

## Consequences
- Confidential financial logic and data never touch the public web tier — the strongest
  possible reading of the data-boundary policy.
- Runs offline on the intended Windows operator machine; no service to stand up.
- Optional dependencies (openpyxl for Excel, a UI framework for Exchange 3) are additive
  and recorded in `pyproject.toml`; the core never depends on them.
- We forgo, for now, direct reuse of the TypeScript helpers (`rfqStore.ts`, `csv.ts`,
  `auditLog.ts`). We reuse their **patterns** (atomic writes, gitignored data, append-only
  PII-free audit, RFC-4180 CSV) rather than their code.

## Alternatives considered
- **Integrate into the Next.js ops desk (TypeScript).** Rejected for Exchange 1: pulls
  confidential cost/margin data into the public web app's process and repo, fighting the
  data-boundary policy.
- **Server/database service (Postgres, web UI).** Rejected as premature; a single-operator
  monthly close does not need a server, and it widens the confidential-data attack surface.
