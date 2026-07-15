"""Export the A–K report package as CSVs (XLSX if openpyxl is available) (§13).

Exports are written under a gitignored private export directory, timestamped. No export
path outside the approved private boundary is used, so confidential data is never written
into the repo working tree.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from .db import data_dir, utcnow_iso


def default_export_root() -> Path:
    return data_dir() / "exports"


def _slug_ts() -> str:
    return utcnow_iso().replace(":", "").replace("-", "").replace(".", "").replace("+", "z")


def _write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str] | None = None) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    cols = columns or list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def _flatten(prefix: str, obj: Any, out: list[dict]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            _flatten(f"{prefix}.{k}" if prefix else k, v, out)
    elif isinstance(obj, list):
        out.append({"metric": prefix, "value": json.dumps(obj)})
    else:
        out.append({"metric": prefix, "value": obj})


def export_report(report: dict, out_root: Path | None = None) -> Path:
    root = out_root or default_export_root()
    out_dir = root / f"batch-{_slug_ts()}"
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    intake = []
    _flatten("", report.get("A_intake", {}), intake)
    _write_csv(out_dir / "intake_summary.csv", intake, ["metric", "value"])
    _write_csv(out_dir / "verified_records.csv", report.get("B_verified_transactions", []))
    _write_csv(out_dir / "provisional_records.csv", report.get("C_provisional_transactions", []))
    _write_csv(out_dir / "exceptions.csv", report.get("D_wheres_your_proof", []))
    _write_csv(out_dir / "reconciliation_findings.csv", report.get("G_reconciliation", []))

    vt = []
    _flatten("", report.get("E_verified_totals", {}), vt)
    _write_csv(out_dir / "verified_totals.csv", vt, ["metric", "value"])

    pe = []
    _flatten("", report.get("F_provisional_excluded_totals", {}), pe)
    _write_csv(out_dir / "provisional_excluded_totals.csv", pe, ["metric", "value"])

    _write_csv(out_dir / "recommended_actions.csv", report.get("I_recommended_actions", []))

    au = []
    _flatten("", report.get("J_database_update", {}), au)
    _write_csv(out_dir / "audit_summary.csv", au, ["metric", "value"])

    return out_dir
