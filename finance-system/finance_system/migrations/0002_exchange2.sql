-- finance-system Exchange 2 schema additions.
-- Additive only (SQLite ADD COLUMN / new tables) so Exchange 1 data survives.
-- Defect 1: calculation_snapshots gains the full required field set and is written on
-- posting. Defect 2 is enforced in code (reporting), not schema.

PRAGMA foreign_keys = ON;

-- ---- Defect 1: extend calculation_snapshots -------------------------------
ALTER TABLE calculation_snapshots ADD COLUMN entity_type TEXT;
ALTER TABLE calculation_snapshots ADD COLUMN entity_id TEXT;
ALTER TABLE calculation_snapshots ADD COLUMN calculation_name TEXT;
ALTER TABLE calculation_snapshots ADD COLUMN policy_id TEXT;
ALTER TABLE calculation_snapshots ADD COLUMN policy_version INTEGER;
ALTER TABLE calculation_snapshots ADD COLUMN output_scale INTEGER;
ALTER TABLE calculation_snapshots ADD COLUMN evidence_basis TEXT;
ALTER TABLE calculation_snapshots ADD COLUMN reporting_period_id TEXT;
ALTER TABLE calculation_snapshots ADD COLUMN import_batch_id TEXT;
ALTER TABLE calculation_snapshots ADD COLUMN superseded_snapshot_id TEXT;
CREATE INDEX idx_snapshot_entity ON calculation_snapshots(entity_type, entity_id);
CREATE INDEX idx_snapshot_txn ON calculation_snapshots(source_transaction_id);
CREATE INDEX idx_snapshot_name ON calculation_snapshots(calculation_name);

-- ---- staging / review metadata on transactions ----------------------------
ALTER TABLE transactions ADD COLUMN review_status TEXT NOT NULL DEFAULT 'staged';
ALTER TABLE transactions ADD COLUMN dedup_status TEXT;
ALTER TABLE transactions ADD COLUMN override_reason TEXT;
ALTER TABLE transactions ADD COLUMN header_total_minor INTEGER;
ALTER TABLE transactions ADD COLUMN source_row_hash TEXT;
ALTER TABLE transactions ADD COLUMN unknown_type_raw TEXT;   -- preserved when type unknown
ALTER TABLE transactions ADD COLUMN commission_rule_id TEXT REFERENCES commission_rules(id);
ALTER TABLE transactions ADD COLUMN mapping_profile_id TEXT;
CREATE INDEX idx_txn_review ON transactions(review_status);
CREATE INDEX idx_txn_rowhash ON transactions(source_row_hash);

-- ---- mapping profiles ------------------------------------------------------
CREATE TABLE mapping_profiles (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    source_type   TEXT NOT NULL,
    profile_json  TEXT NOT NULL,      -- full serialized MappingProfile
    version       INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    UNIQUE (name, version)
);

-- ---- duplicate candidates (likely duplicates; never auto-merged) ----------
CREATE TABLE duplicate_candidates (
    id                   TEXT PRIMARY KEY,
    candidate_group_id   TEXT NOT NULL,
    transaction_id       TEXT REFERENCES transactions(id),
    other_transaction_id TEXT REFERENCES transactions(id),
    match_score          TEXT NOT NULL,      -- canonical decimal string 0..1
    matching_fields_json TEXT NOT NULL,
    conflicting_fields_json TEXT NOT NULL,
    recommended_disposition TEXT NOT NULL,
    review_status        TEXT NOT NULL DEFAULT 'open',
    created_at           TEXT NOT NULL
);
CREATE INDEX idx_dupcand_group ON duplicate_candidates(candidate_group_id);

-- ---- extend reconciliation_findings ---------------------------------------
ALTER TABLE reconciliation_findings ADD COLUMN rule TEXT;
ALTER TABLE reconciliation_findings ADD COLUMN expected_value TEXT;
ALTER TABLE reconciliation_findings ADD COLUMN actual_value TEXT;
ALTER TABLE reconciliation_findings ADD COLUMN difference TEXT;
ALTER TABLE reconciliation_findings ADD COLUMN tolerance TEXT;
ALTER TABLE reconciliation_findings ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE reconciliation_findings ADD COLUMN explanation TEXT;
ALTER TABLE reconciliation_findings ADD COLUMN related_json TEXT;
ALTER TABLE reconciliation_findings ADD COLUMN affected_calculations TEXT;

-- ---- extend exceptions (fuller Where's-Your-Proof workflow) ----------------
ALTER TABLE exceptions ADD COLUMN exception_type TEXT;
ALTER TABLE exceptions ADD COLUMN entity_type TEXT;
ALTER TABLE exceptions ADD COLUMN entity_id TEXT;
ALTER TABLE exceptions ADD COLUMN owner TEXT;
ALTER TABLE exceptions ADD COLUMN due_date TEXT;
ALTER TABLE exceptions ADD COLUMN acceptable_evidence TEXT;
ALTER TABLE exceptions ADD COLUMN calculations_affected TEXT;
ALTER TABLE exceptions ADD COLUMN reports_affected TEXT;
ALTER TABLE exceptions ADD COLUMN resolution_evidence TEXT;
ALTER TABLE exceptions ADD COLUMN reclassification_result TEXT;

-- ---- duplicate-post override ledger (authorized overrides are recorded) ----
CREATE TABLE override_authorizations (
    id            TEXT PRIMARY KEY,
    scope         TEXT NOT NULL,       -- e.g. 'duplicate_post'
    subject_ref   TEXT NOT NULL,       -- hash or external id being overridden
    reason        TEXT NOT NULL,
    authorized_by TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
