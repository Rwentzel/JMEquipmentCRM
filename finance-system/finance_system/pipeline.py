"""Import pipeline orchestrator (§2). Ties parse -> map -> stage -> analyze -> post ->
reconcile together with a review gate. A parse/validation failure stages nothing that can
post, and posting is transactional, so a failed batch never partially contaminates.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Optional

from . import conflicts, dedup, imports, parsing, posting, reconcile
from .db import utcnow_iso
from .evidence import EvidenceMatrix
from .ids import new_id
from .mapping import MappingProfile, map_headers
from .models import ImportBatchStatus
from .policies import CalculationPolicy
from .staging import StageContext, stage_row


@dataclass
class ImportOutcome:
    batch_id: str
    source_file_id: str
    is_duplicate_file: bool
    rows_received: int = 0
    rows_staged: int = 0
    row_errors: int = 0
    mapping: dict = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    staged_ids: list[str] = field(default_factory=list)


def register_and_stage(
    conn: sqlite3.Connection, *, filename: str, content: bytes, profile: MappingProfile,
    matrix: EvidenceMatrix, policy: CalculationPolicy, period_id: Optional[str] = None,
    rule_lookup: Optional[dict] = None, label: str | None = None,
) -> ImportOutcome:
    batch_id = imports.create_batch(conn, label=label or filename)
    source_file_id, is_dup = imports.register_file(conn, batch_id, filename, content)
    parsed = parsing.parse_source(filename, content)
    mapping = map_headers(parsed.headers, profile)
    imports.set_status(conn, batch_id, ImportBatchStatus.PARSED)

    ctx = StageContext(conn, batch_id, source_file_id, profile, matrix, period_id,
                       rule_lookup or {})
    outcome = ImportOutcome(batch_id, source_file_id, is_dup,
                            rows_received=len(parsed.rows), mapping=mapping.to_dict(),
                            warnings=list(parsed.warnings))
    for i, raw in enumerate(parsed.rows, start=1):
        staged = stage_row(ctx, i, raw, mapping)
        if staged.transaction_id:
            outcome.staged_ids.append(staged.transaction_id)
            outcome.rows_staged += 1
        if staged.row_error:
            outcome.row_errors += 1
    imports.set_status(conn, batch_id, ImportBatchStatus.STAGED)
    return outcome


@dataclass
class AnalysisResult:
    exact_duplicates: list = field(default_factory=list)
    likely_duplicates: int = 0
    conflicts: int = 0


def analyze(conn: sqlite3.Connection, batch_id: str, *, allow_duplicates: bool = False,
            override_reason: str | None = None, actor: str | None = None) -> AnalysisResult:
    """Detect exact + likely duplicates and conflicts; reject exact dups unless overridden."""
    with conn:
        exact = dedup.find_exact_duplicates(conn, batch_id)
        for d in exact:
            if allow_duplicates:
                conn.execute(
                    """INSERT INTO override_authorizations(id, scope, subject_ref, reason,
                       authorized_by, created_at) VALUES (?, 'duplicate_post', ?, ?, ?, ?)""",
                    (new_id("reconciliation_finding"), d.staged_transaction_id,
                     override_reason or "authorized override", actor or "operator", utcnow_iso()))
                conn.execute("UPDATE transactions SET dedup_status='exact_duplicate_overridden' WHERE id=?",
                             (d.staged_transaction_id,))
            else:
                conn.execute(
                    "UPDATE transactions SET review_status='rejected', dedup_status='exact_duplicate' WHERE id=?",
                    (d.staged_transaction_id,))
        likely = dedup.find_likely_duplicates(conn, batch_id)
        dedup.persist_duplicates(conn, likely)
        confs = conflicts.detect_conflicts(conn, batch_id)
        conflicts.persist_conflicts(conn, confs)
        imports.set_status(conn, batch_id, ImportBatchStatus.UNDER_REVIEW)
    return AnalysisResult([d.__dict__ for d in exact], len(likely), len(confs))


def review_summary(conn: sqlite3.Connection, batch_id: str) -> dict:
    def one(q, *a):
        return conn.execute(q, a).fetchone()[0]
    staged = one("SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND posted=0 AND review_status='staged'", batch_id)
    rejected = one("SELECT COUNT(*) FROM transactions WHERE import_batch_id=? AND review_status='rejected'", batch_id)
    exceptions = one("""SELECT COUNT(*) FROM exceptions e JOIN transactions t ON t.id=e.transaction_id
                        WHERE t.import_batch_id=? AND e.status!='resolved'""", batch_id)
    return {
        "batch_id": batch_id,
        "staged_ready_to_post": staged,
        "rejected": rejected,
        "open_exceptions": exceptions,
        "likely_duplicate_candidates": one("SELECT COUNT(*) FROM duplicate_candidates", ),
        "conflicts": one("SELECT COUNT(*) FROM reconciliation_findings WHERE finding_type='conflict'", ),
    }


def post(conn: sqlite3.Connection, batch_id: str, policy: CalculationPolicy,
         *, actor: str | None = None) -> dict:
    return posting.post_batch(conn, batch_id, policy, actor=actor)


def run_reconciliation(conn: sqlite3.Connection, period_id: str | None = None) -> int:
    with conn:
        recons = reconcile.reconcile_posted(conn, period_id)
        return reconcile.persist_recon(conn, recons)
