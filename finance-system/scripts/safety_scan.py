#!/usr/bin/env python3
"""Repository safety scan (Correction #7).

Scans git-tracked and git-staged files under ``finance-system/`` for likely
confidential data using ``finance_system.scanner``, plus the tracked-file/staged-file
checks that gitignore alone cannot provide. Exits non-zero on any HIGH finding so it
can be wired into a pre-commit hook or run manually.

LIMIT: heuristic, not a guarantee. See docs/THREAT_MODEL.md.

Usage:
  python scripts/safety_scan.py            # scan tracked + staged finance-system files
  python scripts/safety_scan.py --all      # also scan untracked files in the tree
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent          # finance-system/
REPO_ROOT = HERE.parent

sys.path.insert(0, str(HERE))
from finance_system.scanner import scan_paths  # noqa: E402


def _git(args: list[str]) -> list[str]:
    try:
        out = subprocess.run(
            ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=True
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    return [line for line in out.stdout.splitlines() if line.strip()]


def collect(include_untracked: bool) -> list[Path]:
    rel = "finance-system"
    tracked = _git(["ls-files", rel])
    staged = _git(["diff", "--cached", "--name-only", "--", rel])
    names = set(tracked) | set(staged)
    if include_untracked:
        names |= set(_git(["ls-files", "--others", "--exclude-standard", rel]))
    return [REPO_ROOT / n for n in sorted(names) if (REPO_ROOT / n).is_file()]


def main() -> int:
    include_untracked = "--all" in sys.argv
    paths = collect(include_untracked)
    report = scan_paths(paths)
    print(f"[safety-scan] {report.summary()}")
    for f in report.findings:
        print(f"  [{f.severity.upper():6}] {f.kind:22} {f.path}:{f.line}  {f.excerpt}")
    if report.errors:
        for e in report.errors:
            print(f"  [ERROR] {e}")
    if not report.ok:
        print("[safety-scan] FAIL: high-severity finding(s) — do not commit.")
        return 1
    print("[safety-scan] OK: no high-severity findings "
          "(heuristic only; not a confidentiality guarantee).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
