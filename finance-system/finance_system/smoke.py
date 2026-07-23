"""End-to-end skeleton smoke test (Exchange 1, requirement #15).

Loads the sanitized fixture month, stages it through the import-batch machinery,
classifies each calculation at the calculation level, raises "Where's Your Proof?"
exceptions for unverified calculations, records duplicate/freight reconciliation
findings, posts the batch, and computes Verified/Provisional/Exception separated
totals. Runs entirely on sanitized data and an in-memory database by default.

This is intentionally a thin vertical slice proving the foundation holds together;
the full CSV/Excel intake, mapping, and A–K report live in Exchange 2.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from pathlib import Path
from typing import Any

from . import audit, exception_register, imports
from .db import init_db, utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .models import CostComponentType, ExceptionPriority, TransactionType
from .money import Money, quantity_to_stored
from .policies import DEFAULT_POLICY
from .reporting import compute_separated_totals
from .verification import CalculationType

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "sample_month.json"

_COST_FIELDS = {
    "product_cost": CostComponentType.PRODUCT_COST,
    "freight_in": CostComponentType.FREIGHT_IN,
    "freight_out": CostComponentType.FREIGHT_OUT,
}


def _upsert_named(conn: sqlite3.Connection, cache: dict, table: str, kind: str, name: str) -> str:
    """Upsert a customer/vendor (name + name_raw columns)."""
    if name in cache:
        return cache[name]
    ent_id = new_id(kind)
    conn.execute(
        f"INSERT INTO {table}(id, name, name_raw, created_at) VALUES (?, ?, ?, ?)",
        (ent_id, name.strip(), name, utcnow_iso()),
    )
    cache[name] = ent_id
    return ent_id


def _upsert_product(conn: sqlite3.Connection, cache: dict, name: str) -> str:
    if name in cache:
        return cache[name]
    ent_id = new_id("product")
    conn.execute(
        "INSERT INTO products(id, name, created_at) VALUES (?, ?, ?)",
        (ent_id, name.strip(), utcnow_iso()),
    )
    cache[name] = ent_id
    return ent_id


def _add_external_id(conn, entity_kind, entity_id, namespace, value):
    if not value:
        return
    conn.execute(
        """INSERT INTO external_identifiers(id, entity_kind, entity_id, namespace, value, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (f"extid_{uuid.uuid4().hex}", entity_kind, entity_id, namespace, value, utcnow_iso()),
    )


def run_smoke(db_path: str = ":memory:") -> dict[str, Any]:
    conn = init_db(db_path)
    matrix = EvidenceMatrix()
    policy = DEFAULT_POLICY
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))

    # reporting period
    period = data["reporting_period"]
    period_id = new_id("reporting_period")
    conn.execute(
        """INSERT INTO reporting_periods(id, label, start_date, end_date, locked, created_at)
           VALUES (?, ?, ?, ?, 0, ?)""",
        (period_id, period["label"], period["start_date"], period["end_date"], utcnow_iso()),
    )

    # commission rules
    rule_ids: dict[str, str] = {}
    for rule in data.get("commission_rules", []):
        rid = new_id("commission_rule")
        rule_ids[rule["id_key"]] = rid
        conn.execute(
            """INSERT INTO commission_rules(id, name, basis, rate_canonical, eligibility,
               salesperson, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (rid, rule["name"], rule.get("basis"), rule.get("rate"),
             rule.get("eligibility"), rule.get("salesperson"), utcnow_iso()),
        )

    batch_id = imports.create_batch(conn, label="sanitized-smoke")
    source_file_id, _dup = imports.register_file(
        conn, batch_id, "sample_month.json", FIXTURE.read_bytes())

    customers: dict[str, str] = {}
    products: dict[str, str] = {}
    vendors: dict[str, str] = {}
    classifications: list[dict] = []

    for row_no, rec in enumerate(data["records"], start=1):
        src_id = imports.add_source_record(conn, batch_id, source_file_id, row_no, rec)
        customer_id = _upsert_named(conn, customers, "customers", "customer", rec["customer"])
        product_id = _upsert_product(conn, products, rec["product"])
        vendor_id = (_upsert_named(conn, vendors, "vendors", "vendor", rec["vendor"])
                     if rec.get("vendor") else None)

        txn_id = new_id("transaction")
        conn.execute(
            """INSERT INTO transactions(id, transaction_type, customer_id, vendor_id,
               import_batch_id, source_record_id, reporting_period_id, currency,
               transaction_date, invoice_date, ship_date, period_assignment_date,
               salesperson, posted, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, 0, ?)""",
            (txn_id, TransactionType(rec["transaction_type"]).value, customer_id, vendor_id,
             batch_id, src_id, period_id, rec.get("transaction_date"), rec.get("invoice_date"),
             rec.get("ship_date") or None, rec.get("period_assignment_date"),
             rec.get("salesperson"), utcnow_iso()),
        )
        _add_external_id(conn, "transaction", txn_id, "invoice_number",
                         rec.get("external_invoice_number"))

        line_id = new_id("transaction_line")
        conn.execute(
            """INSERT INTO transaction_lines(id, transaction_id, product_id, line_number,
               description, quantity_minor, unit_sales_price_minor, discount_minor,
               credit_minor, return_minor, customer_shipping_minor, other_charges_minor,
               tax_minor, currency, created_at)
               VALUES (?, ?, ?, 1, ?, ?, ?, ?, 0, ?, ?, 0, ?, 'USD', ?)""",
            (line_id, txn_id, product_id, rec["product"],
             quantity_to_stored(rec.get("quantity", "0")),
             Money.of(rec.get("unit_sales_price", "0")).minor,
             Money.of(rec.get("discount", "0")).minor,
             Money.of(rec.get("return", "0")).minor,
             Money.of(rec.get("customer_shipping", "0")).minor,
             Money.of(rec.get("tax", "0")).minor,
             utcnow_iso()),
        )
        for field_name, ctype in _COST_FIELDS.items():
            if field_name in rec and rec[field_name] not in (None, ""):
                conn.execute(
                    """INSERT INTO cost_components(id, transaction_line_id, transaction_id,
                       component_type, amount_minor, currency, vendor_id, vendor_bill_number, created_at)
                       VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?)""",
                    (new_id("cost_component"), line_id, txn_id, ctype.value,
                     Money.of(rec[field_name]).minor, vendor_id,
                     rec.get("vendor_bill_number"), utcnow_iso()),
                )

        # calculation-level classification on the normalized record
        norm = dict(rec)
        norm["customer_id"] = customer_id
        record_ver = matrix.classify_record(norm, rec["transaction_type"])
        per_calc = {}
        for calc, cv in record_ver.by_calc.items():
            conn.execute(
                """INSERT INTO record_verifications(id, transaction_id, transaction_line_id,
                   calculation_type, level, missing_fields_json, note, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (new_id("calculation_snapshot"), txn_id, line_id, calc.value, cv.level.value,
                 json.dumps(cv.missing_fields), cv.note, utcnow_iso()),
            )
            per_calc[calc.value] = cv.level.value
            if calc in (CalculationType.COST, CalculationType.GROSS_PROFIT,
                        CalculationType.COMMISSION):
                exception_register.exception_from_verification(
                    conn, cv, transaction_id=txn_id, transaction_line_id=line_id,
                    customer_ref=rec["customer"], priority=ExceptionPriority.HIGH,
                )
        classifications.append({
            "key": rec["key"], "scenario": rec["scenario"],
            "transaction_type": rec["transaction_type"], "by_calc": per_calc,
        })

    # ---- reconciliation: duplicate external invoice numbers --------------
    dup_rows = conn.execute(
        """SELECT value, COUNT(DISTINCT entity_id) AS n FROM external_identifiers
           WHERE namespace = 'invoice_number' GROUP BY value HAVING n > 1""",
    ).fetchall()
    for dr in dup_rows:
        conn.execute(
            """INSERT INTO reconciliation_findings(id, finding_type, severity, subject_ref,
               detail, created_at) VALUES (?, 'duplicate', 'high', ?, ?, ?)""",
            (new_id("reconciliation_finding"), dr["value"],
             f"invoice number {dr['value']} appears on {dr['n']} distinct transactions "
             f"(flagged, not merged)", utcnow_iso()),
        )

    # ---- reconciliation: freight under-recovery --------------------------
    freight_rows = conn.execute(
        """SELECT l.id AS line_id, l.customer_shipping_minor AS billed,
                  COALESCE((SELECT SUM(amount_minor) FROM cost_components c
                            WHERE c.transaction_line_id = l.id AND c.component_type = 'freight_out'), 0)
                  AS freight_out
           FROM transaction_lines l""",
    ).fetchall()
    for fr in freight_rows:
        if fr["freight_out"] > 0 and fr["freight_out"] > fr["billed"]:
            gap = Money.from_minor(fr["freight_out"] - fr["billed"])
            conn.execute(
                """INSERT INTO reconciliation_findings(id, finding_type, severity, subject_ref,
                   detail, created_at) VALUES (?, 'freight_under_recovery', 'medium', ?, ?, ?)""",
                (new_id("reconciliation_finding"), fr["line_id"],
                 f"freight-out exceeds freight billed by {gap.rounded()} USD", utcnow_iso()),
            )

    imports.post_batch(conn, batch_id)
    totals = compute_separated_totals(conn, policy)

    open_exc = exception_register.open_exceptions(conn)
    findings = conn.execute("SELECT finding_type, severity, detail FROM reconciliation_findings").fetchall()
    audit.record_event(conn, "smoke_completed", "sanitized smoke finished",
                       entity_kind="import_batch", entity_id=batch_id,
                       detail={"records": len(data["records"])})

    result = {
        "records": len(data["records"]),
        "classifications": classifications,
        "open_exceptions": [
            {"calculation_type": e["calculation_type"], "customer": e["customer_ref"],
             "missing": e["missing_information"], "priority": e["priority"]}
            for e in open_exc
        ],
        "reconciliation_findings": [
            {"type": f["finding_type"], "severity": f["severity"], "detail": f["detail"]}
            for f in findings
        ],
        "separated_totals": totals.to_dict(),
    }
    if db_path == ":memory:":
        conn.close()
    return result


def main() -> None:
    print(json.dumps(run_smoke(), indent=2))


if __name__ == "__main__":
    main()
