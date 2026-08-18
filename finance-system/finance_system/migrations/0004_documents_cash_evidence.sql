-- finance-system Exchange 3 — multi-line documents, cash application, vendor evidence,
-- and crating revenue. Additive only; existing data survives.

PRAGMA foreign_keys = ON;

-- ---- Multi-line documents -------------------------------------------------
-- Document identity and line identity are SEPARATE. A document (one invoice) may carry
-- many lines; duplicate detection runs at document, line, and source-row level.
ALTER TABLE transactions ADD COLUMN document_hash TEXT;   -- hash of the whole document
ALTER TABLE transactions ADD COLUMN line_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE transaction_lines ADD COLUMN source_record_id TEXT REFERENCES source_records(id);
ALTER TABLE transaction_lines ADD COLUMN source_row_hash TEXT;  -- per-LINE source row
ALTER TABLE transaction_lines ADD COLUMN customer_crating_minor INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_txn_dochash ON transactions(document_hash);
CREATE INDEX idx_line_rowhash ON transaction_lines(source_row_hash);

-- ---- Cash application (payments, credits, returns applied to invoices) ----
-- Preserves the distinction between invoiced revenue, collected cash, outstanding
-- receivable, and unapplied payment. This is NOT a general ledger.
CREATE TABLE payment_applications (
    id                     TEXT PRIMARY KEY,
    payment_transaction_id TEXT NOT NULL REFERENCES transactions(id),
    invoice_transaction_id TEXT REFERENCES transactions(id),  -- NULL = unapplied cash
    kind                   TEXT NOT NULL,   -- payment | credit | return | reversal
    amount_minor           INTEGER NOT NULL,
    currency               TEXT NOT NULL DEFAULT 'USD',
    reversed_application_id TEXT REFERENCES payment_applications(id),
    note                   TEXT,
    reporting_period_id    TEXT,
    import_batch_id        TEXT,
    created_at             TEXT NOT NULL
);
CREATE INDEX idx_payapp_invoice ON payment_applications(invoice_transaction_id);
CREATE INDEX idx_payapp_payment ON payment_applications(payment_transaction_id);

-- ---- Vendor-cost evidence (configurable types, not vendor-bill-only) ------
CREATE TABLE cost_evidence (
    id                  TEXT PRIMARY KEY,
    evidence_type       TEXT NOT NULL,   -- vendor_bill | purchase_order | vendor_quote |
                                         -- historical_approved_cost | authorized_manual_cost |
                                         -- manufacturer_price_list | freight_invoice |
                                         -- crating_invoice | internal_labor_record
    source_reference    TEXT,
    evidence_date       TEXT,
    amount_minor        INTEGER,
    currency            TEXT NOT NULL DEFAULT 'USD',
    vendor_id           TEXT REFERENCES vendors(id),
    product_id          TEXT REFERENCES products(id),
    transaction_id      TEXT REFERENCES transactions(id),
    transaction_line_id TEXT REFERENCES transaction_lines(id),
    approved_by         TEXT,
    expires_on          TEXT,
    created_at          TEXT NOT NULL
);
CREATE INDEX idx_costev_line ON cost_evidence(transaction_line_id);

-- Which evidence types satisfy cost verification, per policy (versioned, configurable).
CREATE TABLE cost_evidence_policy (
    id             TEXT PRIMARY KEY,
    policy_key     TEXT NOT NULL,
    evidence_type  TEXT NOT NULL,
    satisfies      TEXT NOT NULL DEFAULT 'verified',  -- verified | provisional
    created_at     TEXT NOT NULL,
    UNIQUE (policy_key, evidence_type)
);
