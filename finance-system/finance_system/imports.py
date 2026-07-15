"""Reversible import-batch foundation and source lineage (Correction #10).

Pipeline stages: register file -> hash -> preserve raw -> (parse/map/normalize/validate
in Exchange 2) -> stage -> review -> post -> (calculate/reconcile/report). A batch only
contributes to POSTED records when :func:`post_batch` runs; before that everything is
discardable via :func:`rollback_batch`, so a failed or rejected batch never partially
contaminates posted data.

Idempotency: re-registering a file whose content hash already belongs to a posted batch
is detected by :func:`find_posted_file_by_hash`, so re-imports don't double-post.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

from . import audit
from .db import utcnow_iso
from .ids import new_id
from .models import ImportBatchStatus


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def create_batch(conn: sqlite3.Connection, label: str | None = None) -> str:
    batch_id = new_id("import_batch")
    conn.execute(
        "INSERT INTO import_batches(id, status, label, created_at) VALUES (?, ?, ?, ?)",
        (batch_id, ImportBatchStatus.REGISTERED.value, label, utcnow_iso()),
    )
    audit.record_event(conn, "import_batch_created", f"batch {label or ''}".strip(),
                       entity_kind="import_batch", entity_id=batch_id)
    return batch_id


def batch_status(conn: sqlite3.Connection, batch_id: str) -> str:
    row = conn.execute("SELECT status FROM import_batches WHERE id = ?", (batch_id,)).fetchone()
    if row is None:
        raise KeyError(f"unknown import batch {batch_id!r}")
    return row["status"]


def find_posted_file_by_hash(conn: sqlite3.Connection, content_sha256: str) -> sqlite3.Row | None:
    """Return a source_files row for this content hash already in a POSTED batch, if any."""
    return conn.execute(
        """SELECT sf.* FROM source_files sf
           JOIN import_batches b ON b.id = sf.import_batch_id
           WHERE sf.content_sha256 = ? AND b.status = ?
           LIMIT 1""",
        (content_sha256, ImportBatchStatus.POSTED.value),
    ).fetchone()


def register_file(
    conn: sqlite3.Connection, batch_id: str, filename: str, content: bytes
) -> tuple[str, bool]:
    """Register a raw source file into a batch. Returns (source_file_id, is_duplicate).

    ``is_duplicate`` is True when the identical content is already posted (idempotency
    signal); the caller decides whether to skip. The raw file hash + size are recorded
    for integrity and lineage.
    """
    digest = sha256_hex(content)
    duplicate = find_posted_file_by_hash(conn, digest) is not None
    file_id = new_id("source_file")
    conn.execute(
        """INSERT INTO source_files
           (id, import_batch_id, filename, content_sha256, byte_size, registered_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (file_id, batch_id, filename, digest, len(content), utcnow_iso()),
    )
    audit.record_event(conn, "source_file_registered", f"registered {filename}",
                       entity_kind="source_file", entity_id=file_id,
                       detail={"sha256": digest, "byte_size": len(content),
                               "duplicate": duplicate})
    return file_id, duplicate


def add_source_record(
    conn: sqlite3.Connection,
    batch_id: str,
    source_file_id: str,
    row_number: int,
    raw: dict[str, Any],
    normalized: dict[str, Any] | None = None,
    row_error: str | None = None,
) -> str:
    """Preserve one raw source row verbatim (Section 4A: never overwrite the original)."""
    rec_id = new_id("source_record")
    conn.execute(
        """INSERT INTO source_records
           (id, source_file_id, import_batch_id, row_number, raw_json, normalized_json, row_error)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (rec_id, source_file_id, batch_id, row_number,
         json.dumps(raw, sort_keys=True, default=str),
         json.dumps(normalized, sort_keys=True, default=str) if normalized is not None else None,
         row_error),
    )
    return rec_id


def set_status(conn: sqlite3.Connection, batch_id: str, status: ImportBatchStatus) -> None:
    conn.execute("UPDATE import_batches SET status = ? WHERE id = ?", (status.value, batch_id))


def _period_locked_for(conn: sqlite3.Connection, batch_id: str) -> list[str]:
    """Return labels of any locked reporting periods that staged txns would post into."""
    rows = conn.execute(
        """SELECT DISTINCT rp.label FROM transactions t
           JOIN reporting_periods rp ON rp.id = t.reporting_period_id
           WHERE t.import_batch_id = ? AND rp.locked = 1""",
        (batch_id,),
    ).fetchall()
    return [r["label"] for r in rows]


def post_batch(conn: sqlite3.Connection, batch_id: str) -> int:
    """Post a batch: mark its staged transactions ``posted=1`` and the batch POSTED.

    Refuses to post into a locked reporting period. Transactional — either the whole
    batch posts or nothing does. Returns the number of transactions posted.
    """
    status = batch_status(conn, batch_id)
    if status == ImportBatchStatus.POSTED.value:
        return 0  # idempotent: already posted
    if status in (ImportBatchStatus.REJECTED.value, ImportBatchStatus.ROLLED_BACK.value):
        raise ValueError(f"cannot post batch in status {status}")
    locked = _period_locked_for(conn, batch_id)
    if locked:
        raise ValueError(f"cannot post into locked reporting period(s): {', '.join(locked)}")
    with conn:
        cur = conn.execute(
            "UPDATE transactions SET posted = 1 WHERE import_batch_id = ? AND posted = 0",
            (batch_id,),
        )
        posted_count = cur.rowcount
        conn.execute(
            "UPDATE import_batches SET status = ?, posted_at = ? WHERE id = ?",
            (ImportBatchStatus.POSTED.value, utcnow_iso(), batch_id),
        )
        audit.record_event(conn, "import_batch_posted", f"posted {posted_count} transactions",
                           entity_kind="import_batch", entity_id=batch_id,
                           detail={"posted_count": posted_count})
    return posted_count


def rollback_batch(conn: sqlite3.Connection, batch_id: str) -> None:
    """Discard a not-yet-posted batch's staged rows. A posted batch cannot be rolled
    back here (that would be a correcting entry, an Exchange-2 concern)."""
    status = batch_status(conn, batch_id)
    if status == ImportBatchStatus.POSTED.value:
        raise ValueError("cannot roll back a posted batch; use a correcting entry instead")
    with conn:
        txn_ids = [r["id"] for r in conn.execute(
            "SELECT id FROM transactions WHERE import_batch_id = ?", (batch_id,))]
        for tid in txn_ids:
            line_ids = [r["id"] for r in conn.execute(
                "SELECT id FROM transaction_lines WHERE transaction_id = ?", (tid,))]
            for lid in line_ids:
                conn.execute("DELETE FROM cost_components WHERE transaction_line_id = ?", (lid,))
                conn.execute("DELETE FROM record_verifications WHERE transaction_line_id = ?", (lid,))
            conn.execute("DELETE FROM cost_components WHERE transaction_id = ?", (tid,))
            conn.execute("DELETE FROM record_verifications WHERE transaction_id = ?", (tid,))
            conn.execute("DELETE FROM transaction_lines WHERE transaction_id = ?", (tid,))
        conn.execute("DELETE FROM transactions WHERE import_batch_id = ?", (batch_id,))
        set_status(conn, batch_id, ImportBatchStatus.ROLLED_BACK)
        audit.record_event(conn, "import_batch_rolled_back",
                           f"rolled back {len(txn_ids)} staged transactions",
                           entity_kind="import_batch", entity_id=batch_id,
                           detail={"discarded_transactions": len(txn_ids)})
