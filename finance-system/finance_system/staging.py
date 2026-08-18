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
                 "customer_crating", "other_charges", "tax", "header_total")
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


# ---------------------------------------------------------------------------
# Multi-line documents (Exchange 3)
#
# Source rows that belong to the same business document (same type + same external
# document number + same customer) are grouped into ONE transaction carrying MANY lines.
# Document identity and line identity stay separate, so a legitimate multi-line invoice is
# never mistaken for a duplicated document. Rows with no document number remain
# single-line documents of their own.
# ---------------------------------------------------------------------------

# The external id that identifies the DOCUMENT, in priority order per transaction type.
_DOC_ID_PRIORITY = {
    "invoice": ("external_invoice_number", "external_so_number"),
    "credit_memo": ("external_invoice_number",),
    "return": ("external_invoice_number",),
    "sales_order": ("external_so_number",),
    "quote": ("external_so_number",),
    "shipment": ("external_so_number", "external_invoice_number"),
    "payment": ("external_invoice_number",),
    "purchase_order": ("external_po_number",),
    "vendor_bill": ("external_po_number", "vendor_bill_number"),
    "item_receipt": ("external_po_number",),
    "vendor_payment": ("external_po_number", "vendor_bill_number"),
}


@dataclass
class PreparedRow:
    row_number: int
    raw: dict
    mapped: dict
    norm: dict
    notes: list
    row_hash: str
    source_record_id: str = ""


@dataclass
class StagedDocument:
    transaction_id: str
    line_ids: list
    document_key: tuple
    per_calc: dict
    row_errors: int = 0


def document_key(norm: dict, row_number: int) -> tuple:
    """Identity of the business document this row belongs to.

    Returns ``("doc", type, id_namespace, id_value, customer)`` when the row carries a
    document number, otherwise a row-unique key so the row stands alone. Payments are
    deliberately NOT grouped with the invoice they reference — a payment is its own
    document that gets *applied* to an invoice (see cash.py).
    """
    tt = norm.get("transaction_type", "unknown")
    for fieldname in _DOC_ID_PRIORITY.get(tt, ()):
        value = norm.get(fieldname)
        if value:
            party = normalize.canonical_key(norm.get("customer") or norm.get("vendor") or "")
            return ("doc", tt, fieldname, str(value).strip(), party)
    return ("row", tt, row_number)


def prepare_row(ctx: StageContext, row_number: int, raw: dict, mapping: MappingResult) -> PreparedRow:
    """Normalize one source row and persist its raw+normalized lineage."""
    mapped = _apply_mapping(raw, mapping)
    norm, notes = build_normalized(mapped)
    row_hash = hashlib.sha256(
        json.dumps(raw, sort_keys=True, default=str).encode("utf-8")).hexdigest()
    src_id = new_id("source_record")
    ctx.conn.execute(
        """INSERT INTO source_records(id, source_file_id, import_batch_id, row_number,
           raw_json, normalized_json, row_error) VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (src_id, ctx.source_file_id, ctx.batch_id, row_number,
         json.dumps(raw, sort_keys=True, default=str),
         json.dumps(norm, sort_keys=True, default=str),
         "; ".join(notes) if notes else None))
    return PreparedRow(row_number, raw, mapped, norm, notes, row_hash, src_id)


def _insert_line(ctx: StageContext, txn_id: str, line_number: int, pr: PreparedRow,
                 vendor_id: Optional[str]) -> str:
    conn, norm = ctx.conn, pr.norm
    product_id = _resolve_named(conn, "products", "product", norm.get("product"))
    line_id = new_id("transaction_line")
    conn.execute(
        """INSERT INTO transaction_lines(id, transaction_id, product_id, line_number, description,
           quantity_minor, unit_sales_price_minor, discount_minor, credit_minor, return_minor,
           customer_shipping_minor, customer_crating_minor, other_charges_minor, tax_minor,
           currency, source_record_id, source_row_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?)""",
        (line_id, txn_id, product_id, line_number, norm.get("product"),
         quantity_to_stored(norm["quantity"]) if "quantity" in norm else None,
         Money.of(norm["unit_sales_price"]).minor if "unit_sales_price" in norm else None,
         Money.of(norm.get("discount", "0")).minor, Money.of(norm.get("credit", "0")).minor,
         Money.of(norm.get("return", "0")).minor, Money.of(norm.get("customer_shipping", "0")).minor,
         Money.of(norm.get("customer_crating", "0")).minor,
         Money.of(norm.get("other_charges", "0")).minor, Money.of(norm.get("tax", "0")).minor,
         pr.source_record_id, pr.row_hash, utcnow_iso()))
    for field_name, ctype in _COST_FIELDS.items():
        if field_name in norm:
            conn.execute(
                """INSERT INTO cost_components(id, transaction_line_id, transaction_id,
                   component_type, amount_minor, currency, vendor_id, vendor_bill_number, created_at)
                   VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?)""",
                (new_id("cost_component"), line_id, txn_id, ctype.value,
                 Money.of(norm[field_name]).minor, vendor_id, norm.get("vendor_bill_number"),
                 utcnow_iso()))
    return line_id


def stage_document(ctx: StageContext, rows: list, key: tuple) -> StagedDocument:
    """Create ONE transaction with one line per source row in the group."""
    conn = ctx.conn
    header = rows[0]                      # header fields come from the first row
    hnorm = header.norm
    customer_id = _resolve_named(conn, "customers", "customer", hnorm.get("customer"))
    vendor_id = _resolve_named(conn, "vendors", "vendor", hnorm.get("vendor"))

    tt_value = hnorm.get("transaction_type", "unknown")
    try:
        tt = TransactionType(tt_value)
        unknown_raw = None
    except ValueError:
        tt = None
        unknown_raw = str(header.mapped.get("transaction_type", ""))
    rule_code = hnorm.get("commission_rule_id")
    rule_id = ctx.rule_lookup.get(rule_code) if rule_code else None

    # Header total: first row that supplies one. Document hash: all member rows.
    header_total_minor = None
    for r in rows:
        if "header_total" in r.norm:
            header_total_minor = Money.of(r.norm["header_total"]).minor
            break
    doc_hash = hashlib.sha256(
        json.dumps(sorted(r.row_hash for r in rows)).encode("utf-8")).hexdigest()

    txn_id = new_id("transaction")
    conn.execute(
        """INSERT INTO transactions(id, transaction_type, customer_id, vendor_id, import_batch_id,
           source_record_id, reporting_period_id, currency, transaction_date, order_date,
           invoice_date, ship_date, due_date, payment_date, period_assignment_date,
           status, payment_status, salesperson, posted, review_status, header_total_minor,
           source_row_hash, document_hash, line_count, unknown_type_raw, commission_rule_id,
           mapping_profile_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'staged', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (txn_id, tt.value if tt else "unknown", customer_id, vendor_id, ctx.batch_id,
         header.source_record_id, ctx.period_id, hnorm.get("transaction_date"),
         hnorm.get("order_date"), hnorm.get("invoice_date"), hnorm.get("ship_date"),
         hnorm.get("due_date"), hnorm.get("payment_date"), hnorm.get("period_assignment_date"),
         hnorm.get("status"), hnorm.get("payment_status"), hnorm.get("salesperson"),
         header_total_minor, header.row_hash, doc_hash, len(rows), unknown_raw, rule_id,
         ctx.profile.id, utcnow_iso()))

    for field_name, namespace in _EXTERNAL_ID_FIELDS.items():
        if hnorm.get(field_name):
            conn.execute(
                """INSERT INTO external_identifiers(id, entity_kind, entity_id, namespace, value, created_at)
                   VALUES (?, 'transaction', ?, ?, ?, ?)""",
                (new_id("external_identifier"), txn_id, namespace, hnorm[field_name], utcnow_iso()))

    line_ids, per_calc = [], {}
    for n, pr in enumerate(rows, start=1):
        line_id = _insert_line(ctx, txn_id, n, pr, vendor_id)
        line_ids.append(line_id)
        norm = dict(pr.norm)
        norm["customer_id"] = customer_id          # for evidence classification
        record_ver = ctx.matrix.classify_record(norm, tt.value if tt else "unknown")
        for calc, cv in record_ver.by_calc.items():
            conn.execute(
                """INSERT INTO record_verifications(id, transaction_id, transaction_line_id,
                   calculation_type, level, missing_fields_json, note, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (new_id("calculation_snapshot"), txn_id, line_id, calc.value, cv.level.value,
                 json.dumps(cv.missing_fields), cv.note, utcnow_iso()))
            per_calc.setdefault(calc.value, cv.level.value)
            if calc in (CalculationType.COST, CalculationType.GROSS_PROFIT,
                        CalculationType.COMMISSION):
                exception_register.exception_from_verification(
                    conn, cv, transaction_id=txn_id, transaction_line_id=line_id,
                    customer_ref=hnorm.get("customer"), priority=ExceptionPriority.HIGH,
                    import_batch_id=ctx.batch_id, reporting_period_id=ctx.period_id,
                    source_record_id=pr.source_record_id)

    return StagedDocument(txn_id, line_ids, key, per_calc,
                          sum(1 for r in rows if r.notes))


def stage_rows(ctx: StageContext, rows: list, mapping: MappingResult) -> list:
    """Prepare every source row, group into documents, and stage each document."""
    prepared = [prepare_row(ctx, i, raw, mapping) for i, raw in enumerate(rows, start=1)]
    groups: dict = {}
    for pr in prepared:
        groups.setdefault(document_key(pr.norm, pr.row_number), []).append(pr)
    return [stage_document(ctx, members, key) for key, members in groups.items()]


def stage_row(ctx: StageContext, row_number: int, raw: dict, mapping: MappingResult) -> StagedRow:
    """Stage a single row as its own one-line document (compatibility helper)."""
    pr = prepare_row(ctx, row_number, raw, mapping)
    key = document_key(pr.norm, pr.row_number)
    doc = stage_document(ctx, [pr], key)
    return StagedRow(doc.transaction_id, pr.norm, doc.per_calc,
                     "; ".join(pr.notes) if pr.notes else None, pr.row_hash)
