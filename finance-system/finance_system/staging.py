"""Staging: turn a mapped source row into staged (unposted) records (§2 steps 6–15).

Builds a normalized record (preserving the raw row), resolves/creates master data by
canonical key, inserts an unposted transaction + line + cost components + external
identifiers, classifies each calculation at the calculation level, and opens
"Where's Your Proof?" exceptions for unverified critical calculations. Nothing here posts;
posting is a separate, transactional step.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass, field
from typing import Any, Optional

from . import exception_register
from .db import utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .mapping import MappingResult, MappingProfile
from .models import CostComponentType, ExceptionPriority, TransactionType
from .money import Money, quantity_to_stored
from . import normalize
from .verification import CalculationType

# normalized field -> (normalizer, kind)
_MONEY_FIELDS = ("unit_sales_price", "discount", "credit", "return", "customer_shipping",
                 "other_charges", "tax", "header_total")
_COST_FIELDS = {
    "product_cost": CostComponentType.PRODUCT_COST,
    "freight_in": CostComponentType.FREIGHT_IN,
    "freight_out": CostComponentType.FREIGHT_OUT,
    "crating": CostComponentType.CRATING,
    "direct_labor": CostComponentType.DIRECT_LABOR,
    "outside_services": CostComponentType.OUTSIDE_SERVICES,
    "installation": CostComponentType.INSTALLATION,
    "travel": CostComponentType.TRAVEL,
    "processing_fees": CostComponentType.PROCESSING_FEES,
    "tariffs": CostComponentType.TARIFFS,
    "other_direct": CostComponentType.OTHER_DIRECT,
}
_DATE_FIELDS = ("transaction_date", "invoice_date", "order_date", "ship_date",
                "due_date", "payment_date", "period_assignment_date")
_EXTERNAL_ID_FIELDS = {
    "external_invoice_number": "invoice_number",
    "external_so_number": "sales_order_number",
    "external_po_number": "purchase_order_number",
}


@dataclass
class StageContext:
    conn: sqlite3.Connection
    batch_id: str
    source_file_id: str
    profile: MappingProfile
    matrix: EvidenceMatrix
    period_id: Optional[str] = None
    rule_lookup: dict[str, str] = field(default_factory=dict)   # source code -> commission_rule_id


@dataclass
class StagedRow:
    transaction_id: Optional[str]
    normalized: dict
    per_calc: dict
    row_error: Optional[str] = None
    source_row_hash: str = ""


def _apply_mapping(raw: dict, mapping: MappingResult) -> dict:
    """Pull source values into destination keys per the mapping."""
    out: dict[str, Any] = {}
    for dest, header in mapping.field_map.items():
        out[dest] = raw.get(header, "")
    return out


def build_normalized(mapped: dict) -> tuple[dict, list[str]]:
    """Normalize mapped values; return (normalized_record, notes). Missing/invalid fields
    are omitted from the record so evidence classification sees them as absent."""
    norm: dict[str, Any] = {}
    notes: list[str] = []
    # transaction type (always present; may be 'unknown')
    tt = normalize.normalize_transaction_type(mapped.get("transaction_type"))
    norm["transaction_type"] = tt.value
    if not tt.ok:
        notes.append(tt.note)
    for key in ("customer", "vendor", "product", "salesperson", "vendor_bill_number",
                "commission_rule_id", "commission_basis", "commission_eligibility",
                "external_invoice_number", "external_so_number", "external_po_number",
                "status", "payment_status"):
        if key in mapped and str(mapped[key]).strip():
            n = normalize.normalize_name(mapped[key]) if key in ("customer", "vendor", "product") \
                else normalize.Normalized(mapped[key], str(mapped[key]).strip(), True)
            if n.ok:
                norm[key] = n.value
    for key in _DATE_FIELDS:
        if key in mapped and str(mapped[key]).strip():
            n = normalize.normalize_date(mapped[key])
            if n.ok:
                norm[key] = n.value
            else:
                notes.append(n.note)
    for key in ("quantity",):
        if key in mapped and str(mapped[key]).strip() != "":
            n = normalize.normalize_quantity(mapped[key])
            if n.ok:
                norm[key] = n.value
            else:
                notes.append(n.note)
    for key in _MONEY_FIELDS + tuple(_COST_FIELDS):
        if key in mapped and str(mapped[key]).strip() != "":
            n = normalize.normalize_money(mapped[key])
            if n.ok:
                norm[key] = n.value
            else:
                notes.append(n.note)
    if "commission_rate" in mapped and str(mapped["commission_rate"]).strip():
        n = normalize.normalize_percent(mapped["commission_rate"])
        if n.ok:
            norm["commission_rate"] = n.value
    return norm, notes


def _resolve_named(conn, table, kind, name) -> Optional[str]:
    if not name:
        return None
    key = normalize.canonical_key(name)
    for r in conn.execute(f"SELECT id, name FROM {table}"):
        if normalize.canonical_key(r["name"]) == key:
            return r["id"]
    ent_id = new_id(kind)
    if table == "products":
        conn.execute("INSERT INTO products(id, name, created_at) VALUES (?, ?, ?)",
                     (ent_id, str(name).strip(), utcnow_iso()))
    else:
        conn.execute(f"INSERT INTO {table}(id, name, name_raw, created_at) VALUES (?, ?, ?, ?)",
                     (ent_id, str(name).strip(), name, utcnow_iso()))
    return ent_id


def stage_row(ctx: StageContext, row_number: int, raw: dict, mapping: MappingResult) -> StagedRow:
    conn = ctx.conn
    mapped = _apply_mapping(raw, mapping)
    norm, notes = build_normalized(mapped)
    row_hash = hashlib.sha256(
        json.dumps(raw, sort_keys=True, default=str).encode("utf-8")).hexdigest()

    # preserve raw + normalized (lineage)
    src_id = new_id("source_record")
    conn.execute(
        """INSERT INTO source_records(id, source_file_id, import_batch_id, row_number,
           raw_json, normalized_json, row_error) VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (src_id, ctx.source_file_id, ctx.batch_id, row_number,
         json.dumps(raw, sort_keys=True, default=str),
         json.dumps(norm, sort_keys=True, default=str),
         "; ".join(notes) if notes else None))

    customer_id = _resolve_named(conn, "customers", "customer", norm.get("customer"))
    vendor_id = _resolve_named(conn, "vendors", "vendor", norm.get("vendor"))
    product_id = _resolve_named(conn, "products", "product", norm.get("product"))
    norm["customer_id"] = customer_id  # for evidence classification

    tt_value = norm["transaction_type"]
    try:
        tt = TransactionType(tt_value)
        unknown_raw = None
    except ValueError:
        tt = None
        unknown_raw = str(mapped.get("transaction_type", ""))
    rule_id = ctx.rule_lookup.get(norm.get("commission_rule_id", "")) if norm.get("commission_rule_id") else None

    txn_id = new_id("transaction")
    header_total_minor = Money.of(norm["header_total"]).minor if "header_total" in norm else None
    conn.execute(
        """INSERT INTO transactions(id, transaction_type, customer_id, vendor_id, import_batch_id,
           source_record_id, reporting_period_id, currency, transaction_date, order_date,
           invoice_date, ship_date, due_date, payment_date, period_assignment_date,
           status, payment_status, salesperson, posted, review_status, header_total_minor,
           source_row_hash, unknown_type_raw, commission_rule_id, mapping_profile_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'staged', ?, ?, ?, ?, ?, ?)""",
        (txn_id, tt.value if tt else "unknown", customer_id, vendor_id, ctx.batch_id, src_id,
         ctx.period_id, norm.get("transaction_date"), norm.get("order_date"),
         norm.get("invoice_date"), norm.get("ship_date"), norm.get("due_date"),
         norm.get("payment_date"), norm.get("period_assignment_date"),
         norm.get("status"), norm.get("payment_status"), norm.get("salesperson"),
         header_total_minor, row_hash, unknown_raw, rule_id, ctx.profile.id, utcnow_iso()))

    for field_name, namespace in _EXTERNAL_ID_FIELDS.items():
        if norm.get(field_name):
            conn.execute(
                """INSERT INTO external_identifiers(id, entity_kind, entity_id, namespace, value, created_at)
                   VALUES (?, 'transaction', ?, ?, ?, ?)""",
                (f"extid_{new_id('transaction')[4:]}", txn_id, namespace, norm[field_name], utcnow_iso()))

    line_id = new_id("transaction_line")
    conn.execute(
        """INSERT INTO transaction_lines(id, transaction_id, product_id, line_number, description,
           quantity_minor, unit_sales_price_minor, discount_minor, credit_minor, return_minor,
           customer_shipping_minor, other_charges_minor, tax_minor, currency, created_at)
           VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?)""",
        (line_id, txn_id, product_id, norm.get("product"),
         quantity_to_stored(norm["quantity"]) if "quantity" in norm else None,
         Money.of(norm["unit_sales_price"]).minor if "unit_sales_price" in norm else None,
         Money.of(norm.get("discount", "0")).minor, Money.of(norm.get("credit", "0")).minor,
         Money.of(norm.get("return", "0")).minor, Money.of(norm.get("customer_shipping", "0")).minor,
         Money.of(norm.get("other_charges", "0")).minor, Money.of(norm.get("tax", "0")).minor,
         utcnow_iso()))

    for field_name, ctype in _COST_FIELDS.items():
        if field_name in norm:
            conn.execute(
                """INSERT INTO cost_components(id, transaction_line_id, transaction_id,
                   component_type, amount_minor, currency, vendor_id, vendor_bill_number, created_at)
                   VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?)""",
                (new_id("cost_component"), line_id, txn_id, ctype.value,
                 Money.of(norm[field_name]).minor, vendor_id, norm.get("vendor_bill_number"),
                 utcnow_iso()))

    # calculation-level classification + exceptions
    record_ver = ctx.matrix.classify_record(norm, tt.value if tt else "unknown")
    per_calc = {}
    for calc, cv in record_ver.by_calc.items():
        conn.execute(
            """INSERT INTO record_verifications(id, transaction_id, transaction_line_id,
               calculation_type, level, missing_fields_json, note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (new_id("calculation_snapshot"), txn_id, line_id, calc.value, cv.level.value,
             json.dumps(cv.missing_fields), cv.note, utcnow_iso()))
        per_calc[calc.value] = cv.level.value
        if calc in (CalculationType.COST, CalculationType.GROSS_PROFIT, CalculationType.COMMISSION):
            exception_register.exception_from_verification(
                conn, cv, transaction_id=txn_id, transaction_line_id=line_id,
                customer_ref=norm.get("customer"), priority=ExceptionPriority.HIGH)

    return StagedRow(txn_id, norm, per_calc, "; ".join(notes) if notes else None, row_hash)
