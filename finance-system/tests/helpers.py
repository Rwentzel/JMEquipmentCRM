"""Shared test helpers for Exchange 2."""

from __future__ import annotations

from pathlib import Path

from finance_system import pipeline
from finance_system.db import init_db, utcnow_iso
from finance_system.evidence import EvidenceMatrix
from finance_system.ids import new_id
from finance_system.mapping import MappingProfile
from finance_system.policies import DEFAULT_POLICY

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "sample_month_v2.csv"


def make_profile():
    return MappingProfile(id=new_id("import_batch"), name="test-csv",
                          created_at=utcnow_iso(), updated_at=utcnow_iso())


def seed_rules(conn):
    lookup = {}
    for code, name, basis, rate in (
        ("CR-GP10", "GP 10%", "gross_profit", "0.10"),
        ("CR-REV5", "Rev 5%", "revenue", "0.05"),
    ):
        rid = new_id("commission_rule")
        conn.execute(
            """INSERT INTO commission_rules(id, name, basis, rate_canonical, eligibility, created_at)
               VALUES (?, ?, ?, ?, 'on_invoice', ?)""", (rid, name, basis, rate, utcnow_iso()))
        lookup[code] = rid
    return lookup


def make_period(conn, label="2026-06", start="2026-06-01", end="2026-06-30", locked=0):
    pid = new_id("reporting_period")
    conn.execute(
        """INSERT INTO reporting_periods(id, label, start_date, end_date, locked, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""", (pid, label, start, end, locked, utcnow_iso()))
    return pid


def import_fixture(conn, *, post=True, period_id=None, content=None, filename=None):
    """Import the sample fixture (or given content) and optionally post. Returns batch_id."""
    rules = seed_rules(conn)
    pid = period_id or make_period(conn)
    out = pipeline.register_and_stage(
        conn, filename=filename or "sample_month_v2.csv",
        content=content if content is not None else FIXTURE.read_bytes(),
        profile=make_profile(), matrix=EvidenceMatrix(), policy=DEFAULT_POLICY,
        period_id=pid, rule_lookup=rules)
    pipeline.analyze(conn, out.batch_id)
    if post:
        pipeline.post(conn, out.batch_id, DEFAULT_POLICY)
    return out.batch_id, pid


def fresh_db():
    return init_db(":memory:")


# A tiny second sanitized batch (distinct invoices) for scope-isolation tests.
SMALL_CSV = (
    b"Type,Customer,Item,Sales Rep,Invoice #,SO #,Date,Period Date,Qty,Unit Price,Discount,"
    b"Return,Freight Billed,Tax,Cost,Freight In,Freight Out,Crating,Commission Plan,"
    b"Commission Basis,Commission %\n"
    b"Sales Order,SmallCo Test,Sample Part K,Sample Rep,,SO-9001,2026-06-02,2026-06-02,10,20.00,0,0,0,0,120.00,0,0,0,,,\n"
    b"Invoice,SmallCo Test,Sample Part K,Sample Rep,INV-9001,,2026-06-05,2026-06-05,4,30.00,0,0,0,0,60.00,0,0,0,CR-GP10,gross_profit,10%\n"
    b"Payment,SmallCo Test,Sample Part K,Sample Rep,INV-9001,,2026-06-09,2026-06-09,1,50.00,0,0,0,0,0,0,0,0,,,\n"
    b"Return,SmallCo Test,Sample Part K,Sample Rep,RMA-9001,,2026-06-10,2026-06-10,1,0,0,20.00,0,0,0,0,0,0,,,\n"
)


def import_content(conn, content, *, period_id, post=True, filename="small.csv", rules=None):
    from finance_system import pipeline
    rules = rules if rules is not None else seed_rules(conn)
    out = pipeline.register_and_stage(
        conn, filename=filename, content=content, profile=make_profile(),
        matrix=EvidenceMatrix(), policy=DEFAULT_POLICY, period_id=period_id, rule_lookup=rules)
    pipeline.analyze(conn, out.batch_id)
    if post:
        pipeline.post(conn, out.batch_id, DEFAULT_POLICY)
        pipeline.run_reconciliation(conn, period_id, out.batch_id)
    return out.batch_id
