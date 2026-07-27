"""Field normalization that PRESERVES the original value (Exchange 2, §4).

Each function converts a raw imported string to a canonical form and returns a
:class:`Normalized` carrying both the original and the normalized value plus a note. The
caller keeps the raw record intact (source_records.raw_json); nothing here overwrites the
original representation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

from .money import ratio_to_canonical


@dataclass
class Normalized:
    raw: Any
    value: Optional[Any]
    ok: bool
    note: str = ""


_DATE_FORMATS = (
    "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%m/%d/%y", "%m-%d-%Y", "%d-%b-%Y",
    "%d %b %Y", "%b %d, %Y", "%B %d, %Y", "%Y%m%d",
)


def normalize_date(raw: Any) -> Normalized:
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return Normalized(raw, None, False, "empty date")
    s = str(raw).strip()
    for fmt in _DATE_FORMATS:
        try:
            d = datetime.strptime(s, fmt).date()
            return Normalized(raw, d.isoformat(), True)
        except ValueError:
            continue
    return Normalized(raw, None, False, f"unrecognized date format: {s!r}")


def normalize_money(raw: Any) -> Normalized:
    """Return a canonical decimal string. Handles $, thousands commas, and (parens)=negative."""
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return Normalized(raw, None, False, "empty amount")
    s = str(raw).strip()
    negative = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    s = s.replace("$", "").replace(",", "").replace(" ", "")
    if s.endswith("-"):  # trailing-minus accounting style
        negative = True
        s = s[:-1]
    try:
        val = Decimal(s)
    except (InvalidOperation, ValueError):
        return Normalized(raw, None, False, f"not a monetary value: {raw!r}")
    if negative:
        val = -val
    return Normalized(raw, format(val, "f"), True)


def normalize_quantity(raw: Any) -> Normalized:
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return Normalized(raw, None, False, "empty quantity")
    s = str(raw).strip().replace(",", "")
    try:
        return Normalized(raw, format(Decimal(s), "f"), True)
    except (InvalidOperation, ValueError):
        return Normalized(raw, None, False, f"not a quantity: {raw!r}")


def normalize_percent(raw: Any) -> Normalized:
    """'10%' -> '0.1'; '0.1' -> '0.1'. Returns a canonical ratio string."""
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return Normalized(raw, None, False, "empty percent")
    s = str(raw).strip()
    try:
        if s.endswith("%"):
            val = Decimal(s[:-1].strip()) / Decimal(100)
        else:
            val = Decimal(s)
        return Normalized(raw, ratio_to_canonical(val), True)
    except (InvalidOperation, ValueError):
        return Normalized(raw, None, False, f"not a percent/ratio: {raw!r}")


_WS = re.compile(r"\s+")


def normalize_name(raw: Any) -> Normalized:
    if raw is None:
        return Normalized(raw, None, False, "empty name")
    s = _WS.sub(" ", str(raw).strip())
    return Normalized(raw, s, bool(s), "" if s else "empty name")


def canonical_key(name: str) -> str:
    """Case/space/punct-insensitive key for matching (NOT for display)."""
    return _WS.sub(" ", re.sub(r"[^a-z0-9 ]", "", str(name).lower())).strip()


_TRUE = {"true", "yes", "y", "1", "t"}
_FALSE = {"false", "no", "n", "0", "f", ""}


def normalize_bool(raw: Any) -> Normalized:
    s = str(raw).strip().lower()
    if s in _TRUE:
        return Normalized(raw, True, True)
    if s in _FALSE:
        return Normalized(raw, False, True)
    return Normalized(raw, None, False, f"not boolean: {raw!r}")


# Transaction-type synonyms -> canonical TransactionType value. Unknown stays unknown.
_TYPE_SYNONYMS = {
    "quote": "quote", "estimate": "quote", "rfq": "quote",
    "sales order": "sales_order", "so": "sales_order", "salesorder": "sales_order",
    "order": "sales_order",
    "invoice": "invoice", "inv": "invoice",
    "shipment": "shipment", "ship": "shipment", "packing slip": "shipment",
    "payment": "payment", "customer payment": "payment", "receipt": "payment",
    "credit memo": "credit_memo", "credit": "credit_memo", "cm": "credit_memo",
    "return": "return", "rma": "return",
    "purchase order": "purchase_order", "po": "purchase_order",
    "item receipt": "item_receipt", "receipt of goods": "item_receipt",
    "vendor bill": "vendor_bill", "bill": "vendor_bill",
    "vendor payment": "vendor_payment", "bill payment": "vendor_payment",
    "cost adjustment": "journal_entry", "commission adjustment": "journal_entry",
    "journal": "journal_entry", "journal entry": "journal_entry",
}


def normalize_transaction_type(raw: Any) -> Normalized:
    if raw is None or not str(raw).strip():
        return Normalized(raw, "unknown", False, "missing transaction type")
    key = canonical_key(raw)
    mapped = _TYPE_SYNONYMS.get(key)
    if mapped:
        return Normalized(raw, mapped, True)
    return Normalized(raw, "unknown", False, f"unknown transaction type: {raw!r}")


def normalize_status(raw: Any) -> Normalized:
    if raw is None:
        return Normalized(raw, None, False, "empty status")
    return Normalized(raw, str(raw).strip().lower().replace(" ", "_"), True)
