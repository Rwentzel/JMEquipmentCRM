"""Source parsing: CSV, TSV, pasted delimited text, JSON, and gated XLSX (§1).

CSV/TSV/JSON/pasted are parsed with the standard library. XLSX is handled behind an
adapter boundary (ADR-0007): if the optional, pinned ``openpyxl`` dependency is installed
it is used; otherwise :class:`ExcelUnavailable` is raised with guidance to convert to CSV.
We do NOT hand-roll a ZIP/XML Excel parser, and we do not claim XLSX support unless tested.
"""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass, field
from typing import Any


class ExcelUnavailable(RuntimeError):
    """Raised when XLSX intake is requested but no maintainable parser is available."""


@dataclass
class ParseResult:
    headers: list[str]
    rows: list[dict[str, Any]]
    fmt: str
    warnings: list[str] = field(default_factory=list)


def detect_format(filename: str, content: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".json"):
        return "json"
    if name.endswith(".tsv"):
        return "tsv"
    if name.endswith(".csv"):
        return "csv"
    if name.endswith((".xlsx", ".xlsm")):
        return "xlsx"
    # sniff
    head = content[:64].lstrip()
    if head[:1] in (b"[", b"{"):
        return "json"
    if content[:2] == b"PK":  # zip container => xlsx/xlsm
        return "xlsx"
    if b"\t" in content[:1024] and b"," not in content[:1024]:
        return "tsv"
    return "csv"


def _dedupe_headers(headers: list[str]) -> tuple[list[str], list[str]]:
    seen: dict[str, int] = {}
    out: list[str] = []
    warnings: list[str] = []
    for h in headers:
        h = (h or "").strip()
        if h in seen:
            seen[h] += 1
            new = f"{h}__{seen[h]}"
            warnings.append(f"duplicate header {h!r} renamed to {new!r}")
            out.append(new)
        else:
            seen[h] = 1
            out.append(h)
    return out, warnings


def parse_delimited(text: str, delimiter: str) -> ParseResult:
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows_raw = [r for r in reader]
    warnings: list[str] = []
    if not rows_raw:
        return ParseResult([], [], "csv", ["empty input"])
    headers, hwarn = _dedupe_headers(rows_raw[0])
    warnings.extend(hwarn)
    rows: list[dict[str, Any]] = []
    for r in rows_raw[1:]:
        if all((c or "").strip() == "" for c in r):
            continue  # skip fully empty rows
        row = {headers[i]: (r[i] if i < len(r) else "") for i in range(len(headers))}
        if len(r) > len(headers):
            warnings.append(f"row has {len(r)} cells for {len(headers)} headers; extra ignored")
        rows.append(row)
    return ParseResult(headers, rows, "csv", warnings)


def parse_json(text: str) -> ParseResult:
    data = json.loads(text)
    if isinstance(data, dict):
        # allow {"records": [...]} or a single object
        data = data.get("records", data.get("rows", [data]))
    if not isinstance(data, list):
        raise ValueError("JSON import must be an array of objects (or {records: [...]})")
    headers: list[str] = []
    for obj in data:
        if not isinstance(obj, dict):
            raise ValueError("JSON import rows must be objects")
        for k in obj:
            if k not in headers:
                headers.append(k)
    rows = [{h: obj.get(h, "") for h in headers} for obj in data]
    return ParseResult(headers, rows, "json", [])


def parse_xlsx(content: bytes) -> ParseResult:
    try:
        import openpyxl  # optional, pinned; see ADR-0007
    except ImportError as exc:
        raise ExcelUnavailable(
            "XLSX intake requires the optional 'openpyxl' dependency (pip install "
            "'jm-finance-system[excel]') or convert the file to CSV first."
        ) from exc
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    it = ws.iter_rows(values_only=True)
    try:
        header_row = next(it)
    except StopIteration:
        return ParseResult([], [], "xlsx", ["empty workbook"])
    headers, warnings = _dedupe_headers([str(c) if c is not None else "" for c in header_row])
    rows = []
    for r in it:
        if all(c is None or str(c).strip() == "" for c in r):
            continue
        rows.append({headers[i]: ("" if i >= len(r) or r[i] is None else str(r[i]))
                     for i in range(len(headers))})
    return ParseResult(headers, rows, "xlsx", warnings)


def parse_pasted(text: str) -> ParseResult:
    """Detect TSV vs CSV for pasted tabular text and parse."""
    first = text.splitlines()[0] if text.strip() else ""
    delim = "\t" if first.count("\t") >= first.count(",") and "\t" in first else ","
    res = parse_delimited(text, delim)
    res.fmt = "pasted"
    return res


def parse_source(filename: str, content: bytes) -> ParseResult:
    fmt = detect_format(filename, content)
    if fmt == "json":
        return parse_json(content.decode("utf-8"))
    if fmt == "tsv":
        return parse_delimited(content.decode("utf-8"), "\t")
    if fmt == "xlsx":
        return parse_xlsx(content)
    return parse_delimited(content.decode("utf-8"), ",")
