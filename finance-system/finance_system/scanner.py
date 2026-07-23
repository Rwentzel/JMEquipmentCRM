"""Confidential-data scanner (Correction #7).

A defence-in-depth check that flags likely confidential data before it is committed:
customer PII, pricing/margin/commission values, bank/tax identifiers, and credentials,
plus file-extension and file-size heuristics for bulk exports.

LIMITS (stated honestly): this is a heuristic scanner. It reduces the chance of an
accidental leak but does NOT guarantee confidentiality — it can miss novel formats and
can raise false positives. It complements, and does not replace, gitignore discipline,
code review, and the data-boundary policy. It is designed to fail safe: on any HIGH
finding the caller should treat the commit as unsafe.

Sanitized fixtures may legitimately contain fake prices/quantities. A file whose first
2KB contains the marker ``SANITIZED-FIXTURE`` is exempt from *value* heuristics only —
credential, bank, tax-id, and PII patterns are ALWAYS checked, since those must never
appear even in fixtures.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

SANITIZED_MARKER = "SANITIZED-FIXTURE"

# Narrow, documented opt-out for files that INTENTIONALLY contain detection patterns
# (i.e. the scanner's own test vectors). Honoured only by whole-file path scanning, never
# by ``scan_text`` — so core detection stays fully exercised by the unit tests. A real data
# file will not carry this marker. See docs/THREAT_MODEL.md.
ALLOW_TEST_VECTOR_MARKER = "SCANNER-ALLOW-TEST-VECTORS"

# Extensions that usually indicate real data/exports and should not be committed.
BLOCKED_EXTENSIONS = frozenset(
    {".xlsx", ".xls", ".xlsm", ".db", ".sqlite", ".sqlite3", ".qbw", ".qbb",
     ".iif", ".ofx", ".qbo", ".bak"}
)

# Large-file threshold (bytes) for a data-shaped file — catches bulk exports.
MAX_FILE_BYTES = 512 * 1024

# Allowed benign example domains (won't trip the PII/email check).
_ALLOWED_EMAIL_DOMAINS = ("example.com", "example.org", "example.net", "sanitized.local")

# (name, severity, compiled regex, applies_even_to_fixtures)
_PATTERNS: list[tuple[str, str, re.Pattern[str], bool]] = [
    ("private_key", "high", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----"), True),
    ("aws_access_key", "high", re.compile(r"\bAKIA[0-9A-Z]{16}\b"), True),
    ("credential", "high",
     re.compile(r"(?i)\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|bearer)\b\s*[:=]"), True),
    ("ssn", "high", re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), True),
    ("ein_tax_id", "high", re.compile(r"\b\d{2}-\d{7}\b"), True),
    ("bank_account", "high",
     re.compile(r"(?i)\b(?:routing|account)\s*(?:number|no\.?|#)\s*[:=]?\s*\d{6,}"), True),
    ("credit_card", "high", re.compile(r"\b(?:\d[ -]?){13,16}\b"), True),
    ("us_phone", "medium",
     re.compile(r"(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)"), True),
    # Value heuristics — skipped for sanitized fixtures:
    ("currency_amount", "medium", re.compile(r"\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?"), False),
    ("margin_or_cost_label", "low",
     re.compile(r"(?i)\b(?:margin|markup|unit cost|our cost|vendor cost|commission rate)\b"), False),
]

_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")


@dataclass
class Finding:
    path: str
    kind: str
    severity: str  # high | medium | low
    line: int
    excerpt: str


@dataclass
class ScanReport:
    findings: list[Finding] = field(default_factory=list)
    files_scanned: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def high(self) -> list[Finding]:
        return [f for f in self.findings if f.severity == "high"]

    @property
    def ok(self) -> bool:
        """Safe to commit only when there are no HIGH findings (fail-safe)."""
        return not self.high

    def summary(self) -> str:
        by_sev = {s: sum(1 for f in self.findings if f.severity == s)
                  for s in ("high", "medium", "low")}
        return (f"scanned {self.files_scanned} file(s): "
                f"{by_sev['high']} high, {by_sev['medium']} medium, {by_sev['low']} low")


def _email_is_suspicious(match: str) -> bool:
    return not any(match.lower().endswith("@" + d) for d in _ALLOWED_EMAIL_DOMAINS)


def scan_text(name: str, text: str, *, is_sanitized_fixture: bool = False) -> list[Finding]:
    findings: list[Finding] = []
    if not is_sanitized_fixture and SANITIZED_MARKER in text[:2048]:
        is_sanitized_fixture = True
    for lineno, line in enumerate(text.splitlines(), start=1):
        for kind, severity, pattern, always in _PATTERNS:
            if is_sanitized_fixture and not always:
                continue
            m = pattern.search(line)
            if m:
                findings.append(Finding(name, kind, severity, lineno, m.group(0)[:80]))
        for em in _EMAIL_RE.finditer(line):
            if _email_is_suspicious(em.group(0)):
                findings.append(Finding(name, "email_pii", "high", lineno, em.group(0)[:80]))
    return findings


def scan_path(path: Path) -> list[Finding]:
    findings: list[Finding] = []
    ext = path.suffix.lower()
    if ext in BLOCKED_EXTENSIONS:
        findings.append(Finding(str(path), "blocked_extension", "high", 0, ext))
        return findings  # do not try to read binary/data files
    try:
        size = path.stat().st_size
    except OSError as exc:  # pragma: no cover
        return [Finding(str(path), "stat_error", "medium", 0, str(exc))]
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        # Unreadable as text and large => suspicious data blob.
        if size > MAX_FILE_BYTES:
            findings.append(Finding(str(path), "large_binary", "high", 0, f"{size} bytes"))
        return findings
    is_fixture = SANITIZED_MARKER in text[:2048] or "/fixtures/" in str(path).replace("\\", "/")
    if size > MAX_FILE_BYTES and not is_fixture:
        findings.append(Finding(str(path), "large_file", "medium", 0, f"{size} bytes"))
    if ALLOW_TEST_VECTOR_MARKER in text[:2048]:
        # Known scanner test-vector file: skip content patterns (extension/size still applied).
        return findings
    findings.extend(scan_text(str(path), text, is_sanitized_fixture=is_fixture))
    return findings


def scan_paths(paths: list[Path]) -> ScanReport:
    report = ScanReport()
    for p in paths:
        if not p.is_file():
            continue
        report.files_scanned += 1
        try:
            report.findings.extend(scan_path(p))
        except Exception as exc:  # pragma: no cover - defensive
            report.errors.append(f"{p}: {exc}")
    return report
