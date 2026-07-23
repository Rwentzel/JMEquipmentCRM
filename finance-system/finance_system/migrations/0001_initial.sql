-- finance-system initial schema (Exchange 1).
-- Correction #2: durable MINIMUM domain for the first workflow — not every future
-- table. Specialized quote/SO/invoice/PO/bill/payment tables are deferred to the
-- generic transactions core until a distinction is operationally required.
-- Correction #1: internal ids are the primary/join keys; external identifiers live
-- in external_identifiers and never act as a join key.
-- Correction #8: monetary amounts are INTEGER minor units (scale 4). Rates are TEXT
-- canonical decimals. No authoritative money is stored as REAL.

PRAGMA foreign_keys = ON;

-- ---- migration bookkeeping -------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    applied_at  TEXT NOT NULL
);

-- ---- import lineage (Correction #10) --------------------------------------
CREATE TABLE import_batches (
    id          TEXT PRIMARY KEY,
    status      TEXT NOT NULL,          -- ImportBatchStatus
    label       TEXT,
    created_at  TEXT NOT NULL,
    posted_at   TEXT,
    note        TEXT
);

CREATE TABLE source_files (
    id            TEXT PRIMARY KEY,
    import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
    filename      TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,       -- hash of raw bytes for idempotency/integrity
    byte_size     INTEGER NOT NULL,
    registered_at TEXT NOT NULL
);

CREATE TABLE source_records (
    id             TEXT PRIMARY KEY,
    source_file_id TEXT NOT NULL REFERENCES source_files(id),
    import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
    row_number     INTEGER,
    raw_json       TEXT NOT NULL,       -- original values preserved verbatim
    normalized_json TEXT,               -- standardized values (nullable pre-parse)
    row_error      TEXT                 -- row-level error, if any
);

-- ---- master data ----------------------------------------------------------
CREATE TABLE customers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    name_raw    TEXT,                   -- original spelling before normalization
    location    TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE vendors (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    name_raw    TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE products (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT,
    unit_of_measure TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE product_aliases (
    id          TEXT PRIMARY KEY,
    product_id  TEXT NOT NULL REFERENCES products(id),
    alias_type  TEXT NOT NULL,          -- e.g. sku, manufacturer_part_number
    alias_value TEXT NOT NULL,
    UNIQUE (alias_type, alias_value, product_id)
);

-- External identifiers preserved separately, NEVER used as a join key (Correction #1).
CREATE TABLE external_identifiers (
    id            TEXT PRIMARY KEY,
    entity_kind   TEXT NOT NULL,        -- customer|vendor|product|transaction|...
    entity_id     TEXT NOT NULL,        -- internal id of the owning entity
    namespace     TEXT NOT NULL,        -- ids.EXTERNAL_ID_NAMESPACES
    value         TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
CREATE INDEX idx_extid_lookup ON external_identifiers(namespace, value);
CREATE INDEX idx_extid_entity ON external_identifiers(entity_kind, entity_id);

-- ---- reporting periods (period-locking) -----------------------------------
CREATE TABLE reporting_periods (
    id          TEXT PRIMARY KEY,
    label       TEXT NOT NULL,          -- e.g. "2026-06"
    start_date  TEXT NOT NULL,
    end_date    TEXT NOT NULL,
    locked      INTEGER NOT NULL DEFAULT 0,  -- 1 = period locked; no new postings
    created_at  TEXT NOT NULL
);

-- ---- generic transaction core (Correction #2 & #3) ------------------------
CREATE TABLE transactions (
    id                  TEXT PRIMARY KEY,
    transaction_type    TEXT NOT NULL,   -- models.TransactionType (distinct!)
    customer_id         TEXT REFERENCES customers(id),
    vendor_id           TEXT REFERENCES vendors(id),
    import_batch_id     TEXT REFERENCES import_batches(id),
    source_record_id    TEXT REFERENCES source_records(id),
    reporting_period_id TEXT REFERENCES reporting_periods(id),
    currency            TEXT NOT NULL DEFAULT 'USD',
    -- distinct date concepts (Correction #3); any may be null
    transaction_date        TEXT,
    order_date              TEXT,
    invoice_date            TEXT,
    ship_date               TEXT,
    due_date                TEXT,
    payment_date            TEXT,
    cost_recognition_date   TEXT,
    commission_eligibility_date TEXT,
    period_assignment_date  TEXT,
    status              TEXT,
    payment_status      TEXT,
    salesperson         TEXT,
    posted              INTEGER NOT NULL DEFAULT 0,  -- 0 until batch posted
    created_at          TEXT NOT NULL
);
CREATE INDEX idx_txn_type ON transactions(transaction_type);
CREATE INDEX idx_txn_customer ON transactions(customer_id);
CREATE INDEX idx_txn_period ON transactions(reporting_period_id);

CREATE TABLE transaction_lines (
    id              TEXT PRIMARY KEY,
    transaction_id  TEXT NOT NULL REFERENCES transactions(id),
    product_id      TEXT REFERENCES products(id),
    line_number     INTEGER,
    description     TEXT,
    -- amounts as INTEGER minor units, scale 4 (money.py). quantity same scale.
    quantity_minor          INTEGER,
    unit_sales_price_minor  INTEGER,
    discount_minor          INTEGER NOT NULL DEFAULT 0,
    credit_minor            INTEGER NOT NULL DEFAULT 0,
    return_minor            INTEGER NOT NULL DEFAULT 0,
    customer_shipping_minor INTEGER NOT NULL DEFAULT 0,
    other_charges_minor     INTEGER NOT NULL DEFAULT 0,
    tax_minor               INTEGER NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'USD',
    created_at      TEXT NOT NULL
);
CREATE INDEX idx_line_txn ON transaction_lines(transaction_id);

CREATE TABLE cost_components (
    id              TEXT PRIMARY KEY,
    transaction_line_id TEXT REFERENCES transaction_lines(id),
    transaction_id  TEXT REFERENCES transactions(id),
    component_type  TEXT NOT NULL,       -- models.CostComponentType
    amount_minor    INTEGER NOT NULL,    -- scale 4
    currency        TEXT NOT NULL DEFAULT 'USD',
    vendor_id       TEXT REFERENCES vendors(id),
    vendor_bill_number TEXT,
    created_at      TEXT NOT NULL
);
CREATE INDEX idx_cost_line ON cost_components(transaction_line_id);

-- ---- commissions -----------------------------------------------------------
CREATE TABLE commission_rules (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    basis           TEXT,                -- policies.CommissionBasis; NULL => unverifiable
    rate_canonical  TEXT,               -- TEXT decimal (e.g. "0.05"); never REAL
    eligibility     TEXT,               -- policies.CommissionEligibility
    salesperson     TEXT,
    effective_from  TEXT,
    effective_to    TEXT,
    created_at      TEXT NOT NULL
);

CREATE TABLE commission_calculations (
    id                  TEXT PRIMARY KEY,
    transaction_id      TEXT REFERENCES transactions(id),
    commission_rule_id  TEXT REFERENCES commission_rules(id),
    basis_amount_minor  INTEGER,         -- scale 4
    rate_canonical      TEXT,
    commission_minor    INTEGER,         -- scale 4
    verification_level  TEXT NOT NULL,
    calculation_snapshot_id TEXT,
    created_at          TEXT NOT NULL
);

-- ---- calculation-level verification per record ----------------------------
CREATE TABLE record_verifications (
    id                TEXT PRIMARY KEY,
    transaction_id    TEXT REFERENCES transactions(id),
    transaction_line_id TEXT REFERENCES transaction_lines(id),
    calculation_type  TEXT NOT NULL,     -- verification.CalculationType
    level             TEXT NOT NULL,     -- verification.VerificationLevel
    missing_fields_json TEXT,
    note              TEXT,
    created_at        TEXT NOT NULL
);
CREATE INDEX idx_recver_txn ON record_verifications(transaction_id);

-- ---- exceptions ("Where's Your Proof?") -----------------------------------
CREATE TABLE exceptions (
    id                TEXT PRIMARY KEY,
    transaction_id    TEXT REFERENCES transactions(id),
    transaction_line_id TEXT REFERENCES transaction_lines(id),
    calculation_type  TEXT,
    customer_ref      TEXT,
    known_amount_minor INTEGER,
    missing_information TEXT NOT NULL,
    why_critical      TEXT NOT NULL,
    proof_needed      TEXT NOT NULL,
    effect_on_totals  TEXT,
    priority          TEXT NOT NULL,     -- ExceptionPriority
    status            TEXT NOT NULL,     -- ExceptionStatus
    resolved_at       TEXT,
    resolution_note   TEXT,
    created_at        TEXT NOT NULL
);
CREATE INDEX idx_exc_status ON exceptions(status);

-- ---- reconciliation --------------------------------------------------------
CREATE TABLE reconciliation_findings (
    id            TEXT PRIMARY KEY,
    finding_type  TEXT NOT NULL,         -- duplicate|conflict|unsupported|mismatch
    severity      TEXT NOT NULL,
    subject_ref   TEXT,
    detail        TEXT NOT NULL,
    resolved      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
);

-- ---- calculation snapshots (append-only) ----------------------------------
CREATE TABLE calculation_snapshots (
    id                  TEXT PRIMARY KEY,
    calculation_type    TEXT NOT NULL,
    policy_key          TEXT NOT NULL,
    formula_version     TEXT NOT NULL,
    inputs_json         TEXT NOT NULL,
    output_value        TEXT NOT NULL,
    output_kind         TEXT NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'USD',
    verification_level  TEXT NOT NULL,
    source_transaction_id TEXT,
    source_line_id      TEXT,
    created_at          TEXT NOT NULL
);

-- ---- audit events (append-only) -------------------------------------------
CREATE TABLE audit_events (
    id          TEXT PRIMARY KEY,
    kind        TEXT NOT NULL,
    entity_kind TEXT,
    entity_id   TEXT,
    summary     TEXT NOT NULL,           -- non-confidential summary only
    detail_json TEXT,                    -- structural, redaction-safe
    actor       TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX idx_audit_entity ON audit_events(entity_kind, entity_id);

-- Enforce append-only on audit + snapshots: block UPDATE/DELETE at the DB level.
CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only');
END;
CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only');
END;
CREATE TRIGGER calc_snapshots_no_update
BEFORE UPDATE ON calculation_snapshots
BEGIN
    SELECT RAISE(ABORT, 'calculation_snapshots is append-only');
END;
CREATE TRIGGER calc_snapshots_no_delete
BEFORE DELETE ON calculation_snapshots
BEGIN
    SELECT RAISE(ABORT, 'calculation_snapshots is append-only');
END;
