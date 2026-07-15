"""Evidence-requirements matrix and the classification engine (Correction #5).

The matrix declares, for each ``CalculationType`` (optionally scoped by transaction
type), which record fields are REQUIRED evidence and which are merely
recommended. Given a record's present fields, :func:`classify_calculation` returns a
:class:`CalcVerification`:

  * all required present  -> VERIFIED
  * all required present but some recommended missing -> PROVISIONAL
  * any required missing   -> UNVERIFIED (drives a "Where's Your Proof?" exception)

The matrix is data, not code branches, so it is configurable per JM Equipment's real
documentation standards without touching the engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .verification import CalcVerification, CalculationType, VerificationLevel


@dataclass(frozen=True)
class EvidenceRequirement:
    calculation: CalculationType
    transaction_type: str  # "*" = applies to all transaction types
    required_fields: tuple[str, ...]
    recommended_fields: tuple[str, ...] = ()
    rationale: str = ""


# Default matrix. Field names refer to normalized record keys produced by intake.
DEFAULT_EVIDENCE_MATRIX: tuple[EvidenceRequirement, ...] = (
    EvidenceRequirement(
        CalculationType.TRANSACTION_IDENTITY, "*",
        required_fields=("transaction_type", "customer_id"),
        recommended_fields=("external_invoice_number", "transaction_date"),
        rationale="A record must at least name its type and counterparty.",
    ),
    EvidenceRequirement(
        CalculationType.REVENUE, "*",
        required_fields=("quantity", "unit_sales_price"),
        recommended_fields=("discount", "customer_shipping", "tax"),
        rationale="Revenue needs quantity and unit price; discounts refine it.",
    ),
    EvidenceRequirement(
        CalculationType.COST, "*",
        required_fields=("product_cost",),
        recommended_fields=("freight_in", "freight_out", "vendor_id", "vendor_bill_number"),
        rationale="Cost of goods needs at least a substantiated product cost.",
    ),
    EvidenceRequirement(
        CalculationType.GROSS_PROFIT, "*",
        required_fields=("quantity", "unit_sales_price", "product_cost"),
        recommended_fields=("freight_in", "freight_out"),
        rationale="Gross profit requires both verified revenue and verified cost inputs.",
    ),
    EvidenceRequirement(
        CalculationType.COMMISSION, "*",
        required_fields=("commission_rule_id", "commission_basis", "commission_rate"),
        recommended_fields=("commission_eligibility",),
        rationale="Commission basis is never assumed; without a rule it is unverifiable.",
    ),
    EvidenceRequirement(
        CalculationType.PERIOD_ASSIGNMENT, "*",
        required_fields=("period_assignment_date",),
        recommended_fields=("invoice_date", "ship_date"),
        rationale="A transaction must have a dated basis for period assignment.",
    ),
)


def _field_present(record: dict, name: str) -> bool:
    if name not in record:
        return False
    value = record[name]
    if value is None:
        return False
    if isinstance(value, str) and value.strip() == "":
        return False
    return True


@dataclass
class EvidenceMatrix:
    requirements: tuple[EvidenceRequirement, ...] = field(
        default_factory=lambda: DEFAULT_EVIDENCE_MATRIX
    )

    def for_calc(self, calc: CalculationType, transaction_type: str) -> EvidenceRequirement | None:
        # Prefer a type-specific rule, fall back to the wildcard rule.
        specific = None
        wildcard = None
        for req in self.requirements:
            if req.calculation is not calc:
                continue
            if req.transaction_type == transaction_type:
                specific = req
            elif req.transaction_type == "*":
                wildcard = req
        return specific or wildcard

    def classify_calculation(
        self, record: dict, calc: CalculationType, transaction_type: str
    ) -> CalcVerification:
        req = self.for_calc(calc, transaction_type)
        if req is None:
            return CalcVerification(calc, VerificationLevel.UNVERIFIED,
                                    note="no evidence requirement defined")
        missing_required = [f for f in req.required_fields if not _field_present(record, f)]
        missing_recommended = [f for f in req.recommended_fields if not _field_present(record, f)]
        if missing_required:
            return CalcVerification(
                calc, VerificationLevel.UNVERIFIED,
                missing_fields=missing_required,
                note=f"missing required evidence for {calc.value}",
            )
        if missing_recommended:
            return CalcVerification(
                calc, VerificationLevel.PROVISIONAL,
                missing_fields=missing_recommended,
                note=f"verifiable but incomplete for {calc.value}",
            )
        return CalcVerification(calc, VerificationLevel.VERIFIED)

    def classify_record(
        self, record: dict, transaction_type: str,
        calculations: tuple[CalculationType, ...] | None = None,
    ):
        """Classify every tracked calculation for a record. Returns RecordVerification."""
        from .verification import RecordVerification

        calcs = calculations or tuple(CalculationType)
        rv = RecordVerification()
        for calc in calcs:
            rv.set(self.classify_calculation(record, calc, transaction_type))
        return rv
