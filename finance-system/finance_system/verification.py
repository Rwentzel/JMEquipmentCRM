"""Calculation-level verification (Correction #5).

A record is NOT verified with a single record-wide label. Verification is per
*calculation type*: a record can be verified for revenue yet unverified for
profitability or commission. This module defines the calculation types, the
verification levels, and the per-record verification map.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class CalculationType(str, Enum):
    TRANSACTION_IDENTITY = "transaction_identity"
    REVENUE = "revenue"
    COST = "cost"
    GROSS_PROFIT = "gross_profit"
    COMMISSION = "commission"
    PERIOD_ASSIGNMENT = "period_assignment"


class VerificationLevel(str, Enum):
    VERIFIED = "verified"          # complete evidence; may enter verified totals
    PROVISIONAL = "provisional"    # consistent but incomplete; separate totals only
    UNVERIFIED = "unverified"      # missing critical evidence ("Where's Your Proof?")

    def is_verified(self) -> bool:
        return self is VerificationLevel.VERIFIED


@dataclass
class CalcVerification:
    """Verification outcome for one calculation type on one record."""

    calculation: CalculationType
    level: VerificationLevel
    missing_fields: list[str] = field(default_factory=list)
    note: str = ""

    def to_dict(self) -> dict:
        return {
            "calculation": self.calculation.value,
            "level": self.level.value,
            "missing_fields": list(self.missing_fields),
            "note": self.note,
        }


@dataclass
class RecordVerification:
    """The full per-calculation verification state for a single transaction/line."""

    by_calc: dict[CalculationType, CalcVerification] = field(default_factory=dict)

    def set(self, cv: CalcVerification) -> None:
        self.by_calc[cv.calculation] = cv

    def level_for(self, calc: CalculationType) -> VerificationLevel:
        cv = self.by_calc.get(calc)
        return cv.level if cv else VerificationLevel.UNVERIFIED

    def is_verified_for(self, calc: CalculationType) -> bool:
        return self.level_for(calc).is_verified()

    def worst_level(self) -> VerificationLevel:
        """Lowest verification level across all tracked calculations (for a headline
        badge only — reports must still show the per-calculation breakdown)."""
        order = {
            VerificationLevel.VERIFIED: 0,
            VerificationLevel.PROVISIONAL: 1,
            VerificationLevel.UNVERIFIED: 2,
        }
        if not self.by_calc:
            return VerificationLevel.UNVERIFIED
        return max((cv.level for cv in self.by_calc.values()), key=lambda lv: order[lv])

    def to_dict(self) -> dict:
        return {c.value: cv.to_dict() for c, cv in self.by_calc.items()}
