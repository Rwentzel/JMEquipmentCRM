"""Exact monetary and quantity representation.

Correction #8 (Exchange 1): authoritative financial values must NOT be stored as
binary floating point (SQLite ``REAL``). This module fixes the representation:

Storage strategy (ADR-0003):
  * Monetary amounts and quantities are stored as **integer minor units at a fixed
    scale of 4 decimal places** (value x 10_000). This is exact, covers 2-decimal
    line/invoice amounts and up to 4-decimal unit prices/costs, and round-trips
    losslessly through SQLite ``INTEGER``.
  * Single reporting currency for this milestone: **USD**. A ``currency`` field is
    carried so a future multi-currency milestone is additive, not a rewrite.
  * Dimensionless ratios (commission rate, tax rate, percentages) are NOT money and
    are stored as validated canonical decimal strings (``TEXT``) — see
    ``ratio_to_canonical`` / ``ratio_from_canonical``. They are never stored as REAL.

All arithmetic uses :class:`decimal.Decimal`. ``float`` never touches a money value.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext
from typing import Union

# Fixed storage scale: 4 fractional digits => minor unit = 1/10_000.
STORAGE_SCALE = 4
_SCALE_FACTOR = Decimal(10) ** STORAGE_SCALE
_QUANT = Decimal(1).scaleb(-STORAGE_SCALE)  # Decimal("0.0001")

# Display scale for whole-currency amounts (cents). Unit prices keep full scale.
MONEY_DISPLAY_SCALE = 2

DEFAULT_CURRENCY = "USD"

Numeric = Union["Money", Decimal, int, str]


def _to_decimal(value: Union[Decimal, int, str]) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, str):
        try:
            return Decimal(value.strip())
        except InvalidOperation as exc:
            raise ValueError(f"not a valid decimal: {value!r}") from exc
    raise TypeError(f"cannot convert {type(value).__name__} to Decimal for money")


@dataclass(frozen=True, order=True)
class Money:
    """An exact monetary amount, stored internally as integer minor units (scale 4).

    Instances are immutable and comparable. Construct with :meth:`of` /
    :meth:`from_minor`; arithmetic returns new ``Money`` in the same currency.
    """

    minor: int  # value * 10_000, exact
    currency: str = DEFAULT_CURRENCY

    # --- constructors -------------------------------------------------------
    @classmethod
    def of(cls, value: Union[Decimal, int, str], currency: str = DEFAULT_CURRENCY) -> "Money":
        """Build ``Money`` from a decimal/str/int amount, rounding to scale 4."""
        dec = _to_decimal(value)
        with localcontext() as ctx:
            ctx.prec = 34
            scaled = (dec * _SCALE_FACTOR).to_integral_value(rounding=ROUND_HALF_UP)
        return cls(int(scaled), currency)

    @classmethod
    def from_minor(cls, minor: int, currency: str = DEFAULT_CURRENCY) -> "Money":
        if not isinstance(minor, int):
            raise TypeError("minor units must be int")
        return cls(minor, currency)

    @classmethod
    def zero(cls, currency: str = DEFAULT_CURRENCY) -> "Money":
        return cls(0, currency)

    # --- conversions --------------------------------------------------------
    def as_decimal(self) -> Decimal:
        """Exact decimal value at storage scale (4 places)."""
        return (Decimal(self.minor) / _SCALE_FACTOR).quantize(_QUANT)

    def rounded(self, places: int = MONEY_DISPLAY_SCALE) -> Decimal:
        """Value rounded to ``places`` decimals (ROUND_HALF_UP) for display/reporting."""
        q = Decimal(1).scaleb(-places)
        return self.as_decimal().quantize(q, rounding=ROUND_HALF_UP)

    def __str__(self) -> str:
        return f"{self.rounded():.2f} {self.currency}"

    # --- arithmetic (currency-checked) -------------------------------------
    def _check(self, other: "Money") -> None:
        if not isinstance(other, Money):
            raise TypeError("can only combine Money with Money")
        if other.currency != self.currency:
            raise ValueError(
                f"currency mismatch: {self.currency} vs {other.currency}"
            )

    def __add__(self, other: "Money") -> "Money":
        self._check(other)
        return Money(self.minor + other.minor, self.currency)

    def __sub__(self, other: "Money") -> "Money":
        self._check(other)
        return Money(self.minor - other.minor, self.currency)

    def __neg__(self) -> "Money":
        return Money(-self.minor, self.currency)

    def multiply(self, factor: Union[Decimal, int, str]) -> "Money":
        """Multiply by a dimensionless quantity/factor, rounding to scale 4."""
        dec = _to_decimal(factor)
        with localcontext() as ctx:
            ctx.prec = 34
            product = (Decimal(self.minor) * dec).to_integral_value(rounding=ROUND_HALF_UP)
        return Money(int(product), self.currency)

    def is_zero(self) -> bool:
        return self.minor == 0

    def is_negative(self) -> bool:
        return self.minor < 0


def money_sum(items: "list[Money]", currency: str = DEFAULT_CURRENCY) -> Money:
    """Sum a list of ``Money`` (empty -> zero in ``currency``)."""
    total = Money.zero(currency)
    for m in items:
        total = total + m
    return total


# --- quantities -------------------------------------------------------------

def quantity_to_stored(value: Union[Decimal, int, str]) -> int:
    """Quantities use the same scale-4 integer storage as money (supports fractions
    such as labour hours). Returns integer minor units."""
    dec = _to_decimal(value)
    with localcontext() as ctx:
        ctx.prec = 34
        scaled = (dec * _SCALE_FACTOR).to_integral_value(rounding=ROUND_HALF_UP)
    return int(scaled)


def quantity_from_stored(stored: int) -> Decimal:
    return (Decimal(stored) / _SCALE_FACTOR).quantize(_QUANT)


# --- ratios (NOT money) -----------------------------------------------------

def ratio_to_canonical(value: Union[Decimal, int, str]) -> str:
    """Validate and canonicalise a dimensionless ratio (e.g. commission rate 0.05).

    Stored as TEXT, never REAL. Canonical form is a plain decimal string.
    """
    dec = _to_decimal(value)
    if dec != dec:  # NaN guard
        raise ValueError("ratio cannot be NaN")
    return format(dec.normalize(), "f")


def ratio_from_canonical(text: str) -> Decimal:
    return _to_decimal(text)
