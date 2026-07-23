"""Import mapping profiles + header-to-field mapping with explicit confidence (§3).

A :class:`MappingProfile` is a reusable, versioned description of how a source's columns
map to the system's normalized fields. :func:`map_headers` classifies each mapping as
Exact / Strong / Ambiguous / Unmapped and never silently applies an uncertain mapping;
ambiguous or unmapped **critical** fields require review (and drive an exception at intake).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from enum import Enum

from .normalize import canonical_key


class MapConfidence(str, Enum):
    EXACT = "exact"
    STRONG = "strong"
    AMBIGUOUS = "ambiguous"
    UNMAPPED = "unmapped"


# Destination (normalized) fields and the header spellings we accept for each.
DEFAULT_ALIASES: dict[str, tuple[str, ...]] = {
    "transaction_type": ("transaction type", "type", "doc type", "document type", "txn type"),
    "customer": ("customer", "customer name", "bill to", "account", "client"),
    "vendor": ("vendor", "vendor name", "supplier", "manufacturer"),
    "product": ("product", "item", "item name", "part", "description", "product name"),
    "salesperson": ("salesperson", "sales rep", "rep", "account owner", "owner"),
    "external_invoice_number": ("invoice", "invoice number", "invoice #", "inv no", "inv#"),
    "external_so_number": ("so", "sales order", "so number", "so #", "order number"),
    "external_po_number": ("po", "purchase order", "po number", "po #"),
    "transaction_date": ("date", "transaction date", "txn date"),
    "invoice_date": ("invoice date", "inv date"),
    "order_date": ("order date", "so date"),
    "ship_date": ("ship date", "shipped", "shipped date"),
    "due_date": ("due date", "due"),
    "payment_date": ("payment date", "paid date", "paid on"),
    "period_assignment_date": ("period date", "reporting date", "posting date"),
    "quantity": ("qty", "quantity", "units", "count"),
    "unit_sales_price": ("unit price", "price", "unit sales price", "sell price", "rate"),
    "discount": ("discount", "disc", "discount amount"),
    "credit": ("credit", "credit amount"),
    "return": ("return", "return amount", "returned"),
    "customer_shipping": ("freight billed", "shipping", "shipping charged", "freight revenue"),
    "other_charges": ("other charges", "misc", "other"),
    "tax": ("tax", "sales tax", "tax amount"),
    "product_cost": ("cost", "unit cost", "product cost", "cogs", "our cost"),
    "freight_in": ("freight in", "freight-in", "inbound freight"),
    "freight_out": ("freight out", "freight-out", "outbound freight", "freight cost"),
    "crating": ("crating", "packaging", "crate cost"),
    "direct_labor": ("labor", "direct labor", "labour"),
    "outside_services": ("outside services", "subcontract", "outside service"),
    "installation": ("installation", "install"),
    "travel": ("travel",),
    "processing_fees": ("processing", "processing fees", "cc fees", "merchant fees"),
    "tariffs": ("tariff", "tariffs", "customs", "duty"),
    "other_direct": ("other direct", "other cost"),
    "vendor_bill_number": ("vendor bill", "bill number", "vendor invoice"),
    "commission_rule_id": ("commission rule", "commission plan", "comm rule"),
    "commission_basis": ("commission basis", "comm basis"),
    "commission_rate": ("commission rate", "comm rate", "commission %"),
    "commission_eligibility": ("commission eligibility", "comm trigger"),
    "header_total": ("total", "invoice total", "amount", "grand total", "doc total"),
    "status": ("status", "transaction status"),
    "payment_status": ("payment status", "paid status"),
    "currency": ("currency", "curr"),
}

# Fields whose ambiguous/unmapped state is critical (blocks silent posting).
CRITICAL_FIELDS = ("transaction_type", "customer", "quantity", "unit_sales_price")


@dataclass
class MappingProfile:
    id: str
    name: str
    source_type: str = "csv"
    header_aliases: dict[str, tuple[str, ...]] = field(default_factory=lambda: dict(DEFAULT_ALIASES))
    required_fields: tuple[str, ...] = CRITICAL_FIELDS
    date_formats: tuple[str, ...] = ()
    currency: str = "USD"
    default_reporting_basis: str = "invoiced"
    uom_mappings: dict[str, str] = field(default_factory=dict)
    version: int = 1
    created_at: str = ""
    updated_at: str = ""

    def to_json(self) -> str:
        d = asdict(self)
        d["header_aliases"] = {k: list(v) for k, v in self.header_aliases.items()}
        d["required_fields"] = list(self.required_fields)
        return json.dumps(d, sort_keys=True)

    @classmethod
    def from_json(cls, text: str) -> "MappingProfile":
        d = json.loads(text)
        d["header_aliases"] = {k: tuple(v) for k, v in d.get("header_aliases", {}).items()}
        d["required_fields"] = tuple(d.get("required_fields", CRITICAL_FIELDS))
        d["date_formats"] = tuple(d.get("date_formats", ()))
        return cls(**d)


@dataclass
class MappingResult:
    field_map: dict[str, str] = field(default_factory=dict)          # dest -> source header
    confidence: dict[str, str] = field(default_factory=dict)         # dest -> MapConfidence
    unmapped_headers: list[str] = field(default_factory=list)
    ambiguous: list[str] = field(default_factory=list)
    missing_critical: list[str] = field(default_factory=list)

    def is_reviewable(self) -> bool:
        return bool(self.ambiguous or self.missing_critical)

    def to_dict(self) -> dict:
        return {
            "field_map": self.field_map,
            "confidence": self.confidence,
            "unmapped_headers": self.unmapped_headers,
            "ambiguous": self.ambiguous,
            "missing_critical": self.missing_critical,
        }


def map_headers(headers: list[str], profile: MappingProfile) -> MappingResult:
    """Map source headers to destination fields with per-field confidence."""
    result = MappingResult()
    # dest -> list of (source_header, confidence)
    candidates: dict[str, list[tuple[str, MapConfidence]]] = {}
    for header in headers:
        ckey = canonical_key(header)
        matched_dest = None
        conf = MapConfidence.UNMAPPED
        for dest, aliases in profile.header_aliases.items():
            alias_keys = {canonical_key(a) for a in aliases} | {canonical_key(dest)}
            if ckey == canonical_key(dest):
                matched_dest, conf = dest, MapConfidence.EXACT
                break
            if ckey in alias_keys:
                matched_dest, conf = dest, MapConfidence.STRONG
                # keep scanning only to detect exact; strong is fine otherwise
        if matched_dest is None:
            result.unmapped_headers.append(header)
        else:
            candidates.setdefault(matched_dest, []).append((header, conf))

    for dest, cand in candidates.items():
        if len(cand) == 1:
            header, conf = cand[0]
            result.field_map[dest] = header
            result.confidence[dest] = conf.value
        else:
            # Multiple source headers claim the same destination -> ambiguous.
            result.ambiguous.append(dest)
            result.confidence[dest] = MapConfidence.AMBIGUOUS.value

    for crit in profile.required_fields:
        if crit not in result.field_map:
            result.missing_critical.append(crit)
    return result
