"""`python -m finance_system` — entry hint listing the operator surfaces."""

from __future__ import annotations

import sys


def main() -> int:
    print("JM Equipment finance-system — local monthly-close engine\n")
    print("Operator surfaces:")
    print("  python -m finance_system.webapp      # local web console (browser, recommended)")
    print("  python -m finance_system.cli --help  # command-line workflow")
    print("  python -m finance_system.cli selfcheck   # verify the install works end-to-end")
    print("  python -m finance_system.demo        # sanitized end-to-end demonstration")
    print("\nDocs: finance-system/docs/RUNBOOK.md (real-data activation), OPERATOR_GUIDE.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
