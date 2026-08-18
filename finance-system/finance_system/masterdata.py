"""Customer / vendor / product lookup with history (Exchange 3).

Read-only lookups over master data: search, aliases, external identifiers, transaction
history, and price/cost history. Potential duplicate master records are *reported* for
review — no destructive merging is performed here (a merge would need a reversible,
audited process, which is deliberately not implemented).
"""

from __future__ import annotations

import sqlite3
from decimal import Decimal

from .money import Money, quantity_from_stored
from .normalize import canonical_key

_TABLES = {"customer": "customers", "vendor": "vendors", "product": "products"}


def search(conn: sqlite3.Connection, kind: str, query: str = "", limit: int = 50) -> list:
    """Search master data by name (and, for products, by alias value)."""
    table = _TABLES[kind]
    like = f"%{query.strip()}%"
    if kind == "product":
        rows = conn.execute(
            f"""SELECT DISTINCT p.id, p.name FROM products p
                LEFT JOIN product_aliases a ON a.product_id = p.id
                WHERE p.name LIKE ? OR a.alias_value LIKE ? ORDER BY p.name LIMIT ?""",
            (like, like, limit)).fetchall()
    else:
        rows = conn.execute(
            f"SELECT id, name FROM {table} WHERE name LIKE ? ORDER BY name LIMIT ?",
            (like, limit)).fetchall()
    return [{"id": r["id"], "name": r["name"]} for r in rows]


def potential_duplicate_masters(conn: sqlite3.Connection, kind: str) -> list:
    """Master records whose names collapse to the same canonical key.

    Reported only. Merging master data is NOT performed automatically — it would need a
    reversible, audited process.
    """
    table = _TABLES[kind]
    groups: dict[str, list] = {}
    for r in conn.execute(f"SELECT id, name FROM {table}"):
        groups.setdefault(canonical_key(r["name"]), []).append({"id": r["id"], "name": r["name"]})
    return [{"canonical_key": k, "records": v, "count": len(v),
             "recommended_disposition": "review — do not merge without an audited process"}
            for k, v in groups.items() if len(v) > 1]


def customer_profile(conn: sqlite3.Connection, customer_id: str) -> dict:
    row = conn.execute("SELECT * FROM customers WHERE id=?", (customer_id,)).fetchone()
    if row is None:
        raise KeyError(f"unknown customer {customer_id!r}")
    txns = [dict(r) for r in conn.execute(
        """SELECT id, transaction_type, invoice_date, line_count, posted, review_status
           FROM transactions WHERE customer_id=? ORDER BY COALESCE(invoice_date, transaction_date) DESC
           LIMIT 100""", (customer_id,))]
    price_history = []
    for r in conn.execute(
            """SELECT l.description AS item, l.unit_sales_price_minor AS price,
                      l.quantity_minor AS qty, t.invoice_date AS on_date
               FROM transaction_lines l JOIN transactions t ON t.id=l.transaction_id
               WHERE t.customer_id=? AND l.unit_sales_price_minor IS NOT NULL
               ORDER BY t.invoice_date DESC LIMIT 100""", (customer_id,)):
        price_history.append({"item": r["item"], "unit_price": str(Money.from_minor(r["price"]).rounded()),
                              "quantity": str(quantity_from_stored(r["qty"] or 0)), "date": r["on_date"]})
    receivable = conn.execute(
        """SELECT COUNT(*) AS n FROM transactions WHERE customer_id=? AND transaction_type='invoice'
           AND posted=1""", (customer_id,)).fetchone()["n"]
    return {"id": row["id"], "name": row["name"], "transaction_count": len(txns),
            "posted_invoices": receivable, "transactions": txns, "price_history": price_history}


def vendor_profile(conn: sqlite3.Connection, vendor_id: str) -> dict:
    row = conn.execute("SELECT * FROM vendors WHERE id=?", (vendor_id,)).fetchone()
    if row is None:
        raise KeyError(f"unknown vendor {vendor_id!r}")
    cost_history = []
    for r in conn.execute(
            """SELECT c.component_type, c.amount_minor, c.vendor_bill_number, t.invoice_date,
                      l.description AS item
               FROM cost_components c
               JOIN transaction_lines l ON l.id = c.transaction_line_id
               JOIN transactions t ON t.id = c.transaction_id
               WHERE c.vendor_id=? ORDER BY t.invoice_date DESC LIMIT 100""", (vendor_id,)):
        cost_history.append({"item": r["item"], "component": r["component_type"],
                             "amount": str(Money.from_minor(r["amount_minor"]).rounded()),
                             "vendor_bill": r["vendor_bill_number"], "date": r["invoice_date"]})
    evidence = [dict(r) for r in conn.execute(
        """SELECT evidence_type, source_reference, evidence_date FROM cost_evidence
           WHERE vendor_id=? ORDER BY created_at DESC LIMIT 50""", (vendor_id,))]
    return {"id": row["id"], "name": row["name"], "cost_history": cost_history,
            "cost_evidence": evidence}


def product_profile(conn: sqlite3.Connection, product_id: str) -> dict:
    row = conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
    if row is None:
        raise KeyError(f"unknown product {product_id!r}")
    aliases = [dict(r) for r in conn.execute(
        "SELECT alias_type, alias_value FROM product_aliases WHERE product_id=?", (product_id,))]
    sales, costs = [], []
    for r in conn.execute(
            """SELECT l.id, l.unit_sales_price_minor AS price, l.quantity_minor AS qty,
                      t.invoice_date AS on_date, c.name AS customer
               FROM transaction_lines l JOIN transactions t ON t.id=l.transaction_id
               LEFT JOIN customers c ON c.id = t.customer_id
               WHERE l.product_id=? ORDER BY t.invoice_date DESC LIMIT 100""", (product_id,)):
        if r["price"] is not None:
            sales.append({"unit_price": str(Money.from_minor(r["price"]).rounded()),
                          "quantity": str(quantity_from_stored(r["qty"] or 0)),
                          "date": r["on_date"], "customer": r["customer"]})
        cost_row = conn.execute(
            """SELECT COALESCE(SUM(amount_minor),0) AS s FROM cost_components
               WHERE transaction_line_id=? AND component_type='product_cost'""",
            (r["id"],)).fetchone()
        if cost_row["s"]:
            costs.append({"product_cost": str(Money.from_minor(cost_row["s"]).rounded()),
                          "date": r["on_date"]})
    prices = [Decimal(s["unit_price"]) for s in sales]
    return {"id": row["id"], "name": row["name"], "aliases": aliases,
            "price_history": sales, "cost_history": costs,
            "price_range": ({"low": str(min(prices)), "high": str(max(prices))} if prices else None)}
