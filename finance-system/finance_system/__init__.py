"""JM Equipment finance-system — local-first sales/cost/profitability engine.

Exchange 1 foundation. Standard-library only (no third-party runtime deps) so the
package runs on a stock Python 3.11 install. See docs/adr/ for the architecture
decision records that govern this package.

DATA PROTECTION: this package operates on confidential financial data. Real data
is never committed to git — only sanitized fixtures are. See docs/THREAT_MODEL.md
and finance_system.scanner.
"""

__all__ = ["__version__"]

# Schema/app version. Bump the minor when migrations are added.
__version__ = "0.1.0"
