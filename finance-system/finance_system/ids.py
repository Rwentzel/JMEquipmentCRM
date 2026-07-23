"""Typed internal identifiers and external-identifier handling.

Correction #1 (Exchange 1): SKU and other external identifiers must NOT be used as
primary transaction join keys. Internal keys are immutable, opaque, unique, and
generated here. External identifiers (QuickBooks list/txn IDs, invoice numbers,
part numbers, ...) are preserved separately and may be duplicated, changed, missing,
or scoped to other entities — they never replace an internal key.

Internal id format: ``<prefix>_<32 hex>`` from ``uuid4``. The prefix is a human aid
only; equality/joins use the whole opaque string. ``typing.NewType`` gives the type
checker distinct id types without any runtime cost.
"""

from __future__ import annotations

import uuid
from typing import NewType

# --- Internal primary-key types (opaque, immutable) -------------------------

CustomerId = NewType("CustomerId", str)
VendorId = NewType("VendorId", str)
ProductId = NewType("ProductId", str)
ProductAliasId = NewType("ProductAliasId", str)
TransactionId = NewType("TransactionId", str)
TransactionLineId = NewType("TransactionLineId", str)
CostComponentId = NewType("CostComponentId", str)
CommissionRuleId = NewType("CommissionRuleId", str)
CommissionCalcId = NewType("CommissionCalcId", str)
ImportBatchId = NewType("ImportBatchId", str)
SourceFileId = NewType("SourceFileId", str)
SourceRecordId = NewType("SourceRecordId", str)
ExceptionId = NewType("ExceptionId", str)
EvidenceRequirementId = NewType("EvidenceRequirementId", str)
ReconciliationFindingId = NewType("ReconciliationFindingId", str)
ReportingPeriodId = NewType("ReportingPeriodId", str)
CalculationSnapshotId = NewType("CalculationSnapshotId", str)
AuditEventId = NewType("AuditEventId", str)

# Registry of prefixes so the scanner / tooling can recognise our ids.
PREFIXES: dict[str, str] = {
    "customer": "cust",
    "vendor": "vend",
    "product": "prod",
    "product_alias": "alias",
    "transaction": "txn",
    "transaction_line": "line",
    "cost_component": "cost",
    "commission_rule": "crule",
    "commission_calc": "ccalc",
    "import_batch": "batch",
    "source_file": "sfile",
    "source_record": "srec",
    "exception": "exc",
    "evidence_requirement": "evreq",
    "reconciliation_finding": "recon",
    "reporting_period": "period",
    "calculation_snapshot": "calc",
    "audit_event": "audit",
}


def new_id(kind: str) -> str:
    """Mint a fresh opaque internal id for ``kind`` (a key in ``PREFIXES``)."""
    try:
        prefix = PREFIXES[kind]
    except KeyError as exc:  # pragma: no cover - programmer error
        raise ValueError(f"unknown id kind: {kind!r}") from exc
    return f"{prefix}_{uuid.uuid4().hex}"


def is_internal_id(value: str) -> bool:
    """True if ``value`` looks like one of our opaque internal ids."""
    if not isinstance(value, str) or "_" not in value:
        return False
    prefix, _, rest = value.partition("_")
    if prefix not in PREFIXES.values():
        return False
    return len(rest) == 32 and all(c in "0123456789abcdef" for c in rest)


# --- External identifiers (preserved, never a primary key) ------------------

# Namespaces for external identifiers we deliberately keep but never join on as a
# primary key. Stored in the external_identifiers table (see migrations).
EXTERNAL_ID_NAMESPACES: frozenset[str] = frozenset(
    {
        "qb_list_id",
        "qb_txn_id",
        "qb_edit_sequence",
        "invoice_number",
        "sales_order_number",
        "purchase_order_number",
        "vendor_item_number",
        "manufacturer_part_number",
        "jm_part_number",
        "customer_part_number",
        "sku",
    }
)


def validate_external_namespace(namespace: str) -> str:
    """Return ``namespace`` if recognised, else raise. Keeps external-id data clean."""
    if namespace not in EXTERNAL_ID_NAMESPACES:
        raise ValueError(
            f"unknown external identifier namespace: {namespace!r}; "
            f"add it to EXTERNAL_ID_NAMESPACES first"
        )
    return namespace
