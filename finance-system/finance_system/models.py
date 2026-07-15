"""Domain enums and lightweight value types shared across the package.

Correction #3: accounting distinctions are preserved — quote, sales order, invoice,
shipment, payment, credit memo, purchase order, item receipt, vendor bill, vendor
payment, and journal entry are DISTINCT transaction types, never conflated. Separate
date concepts are likewise kept distinct so revenue, cost, cash, commission, and
fulfillment timing are not merged.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum


class TransactionType(str, Enum):
    QUOTE = "quote"
    SALES_ORDER = "sales_order"
    INVOICE = "invoice"
    SHIPMENT = "shipment"
    PAYMENT = "payment"
    CREDIT_MEMO = "credit_memo"
    RETURN = "return"
    PURCHASE_ORDER = "purchase_order"
    ITEM_RECEIPT = "item_receipt"
    VENDOR_BILL = "vendor_bill"
    VENDOR_PAYMENT = "vendor_payment"
    JOURNAL_ENTRY = "journal_entry"


# Revenue-bearing sale documents (used by reporting to avoid double counting).
SALE_DOCUMENT_TYPES = frozenset(
    {TransactionType.INVOICE, TransactionType.CREDIT_MEMO, TransactionType.RETURN}
)


class DateKind(str, Enum):
    TRANSACTION = "transaction_date"
    ORDER = "order_date"
    INVOICE = "invoice_date"
    SHIP = "ship_date"
    DUE = "due_date"
    PAYMENT = "payment_date"
    COST_RECOGNITION = "cost_recognition_date"
    COMMISSION_ELIGIBILITY = "commission_eligibility_date"
    IMPORT = "import_date"
    PERIOD_ASSIGNMENT = "period_assignment_date"


class CostComponentType(str, Enum):
    PRODUCT_COST = "product_cost"
    FREIGHT_IN = "freight_in"
    FREIGHT_OUT = "freight_out"
    CRATING = "crating"
    DIRECT_LABOR = "direct_labor"
    OUTSIDE_SERVICES = "outside_services"
    INSTALLATION = "installation"
    TRAVEL = "travel"
    PROCESSING_FEES = "processing_fees"
    TARIFFS = "tariffs"
    OTHER_DIRECT = "other_direct"
    ALLOCATED_OVERHEAD = "allocated_overhead"


class ImportBatchStatus(str, Enum):
    # Reversible pipeline states (Correction #10). A batch only contributes to posted
    # records when it reaches POSTED; anything before that is fully discardable.
    REGISTERED = "registered"
    PARSED = "parsed"
    STAGED = "staged"
    UNDER_REVIEW = "under_review"
    POSTED = "posted"
    REJECTED = "rejected"
    ROLLED_BACK = "rolled_back"


class ExceptionStatus(str, Enum):
    OPEN = "open"
    IN_REVIEW = "in_review"
    RESOLVED = "resolved"


class ExceptionPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class CalculationSnapshot:
    """An immutable record of one calculation result (Correction #4).

    Retains policy version, formula version, inputs, output, timestamp, source, and
    verification classification so historical results are reproducible and are never
    silently recomputed under a new policy.
    """

    id: str
    calculation_type: str
    policy_key: str          # e.g. "jm-default@v1"
    formula_version: str
    inputs_json: str         # canonical JSON of decimal-string inputs
    output_value: str        # canonical decimal string (or integer minor units as str)
    output_kind: str         # "money_minor" | "decimal" | "percent" | "none"
    currency: str
    verification_level: str
    source_transaction_id: str | None
    source_line_id: str | None
    created_at: str          # ISO-8601 UTC
