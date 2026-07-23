# ADR-0007: Excel (XLSX) support strategy

**Status:** Accepted (Exchange 2) · **Date:** 2026-07-15

## Context
Exchange 2 must support CSV, pasted tabular text, and JSON intake, and "XLSX/XLSM
read-only intake where technically practical." The Exchange 1 core is standard-library
only; `openpyxl` is not installed and the environment has no assumed network access. The
reviewer's rule: *do not build a fragile homegrown Excel parser to preserve the
no-dependency claim, and do not claim Excel support unless it is tested.*

## Decision
- **CSV, TSV, pasted delimited text, and JSON** are parsed with the standard library
  (`csv`, `json`) — no dependency, fully tested.
- **XLSX/XLSM** is handled behind an **adapter boundary** (`parsing.parse_xlsx`):
  - If the optional, pinned `openpyxl` dependency is installed
    (`pip install 'jm-finance-system[excel]'`), it is used (read-only, `data_only`).
  - Otherwise `parsing.ExcelUnavailable` is raised with guidance to install the extra or
    convert the file to CSV — a controlled **Excel-to-CSV boundary**.
- We do **not** hand-roll ZIP/XML Excel parsing.
- We make **no tested Excel claim in this environment**: `openpyxl` is absent, so the XLSX
  path is exercised only by its gating test (`test_intake.test_xlsx_gated_when_unavailable`),
  which asserts the clear failure. When `openpyxl` is present that test skips and the real
  parse path is available. This is recorded as a known limitation.

## Consequences
- The no-dependency core is preserved; Excel is strictly opt-in and isolated.
- Operators without `openpyxl` have a clear, safe path (convert to CSV) rather than a
  silent or fragile failure.
- Adding validated XLSX support later means installing the pinned extra and running the
  intake tests against representative sanitized workbooks — no core change.

## Alternatives considered
- **Hand-rolled XLSX parser.** Rejected explicitly (reviewer rule; fragility).
- **Make openpyxl a hard dependency.** Rejected: breaks the stdlib-only core and offline
  runnability; Excel is not needed for the CSV/JSON monthly close.
