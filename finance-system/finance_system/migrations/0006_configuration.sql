-- finance-system Exchange 3 — controlled configuration with versioned policy history.
PRAGMA foreign_keys = ON;

-- Operator-editable settings (export/backup location, reporting defaults, ...).
CREATE TABLE app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    updated_by  TEXT
);

-- Versioned calculation-policy records. A change NEVER edits a historical version: it
-- inserts a new version and marks it active, so snapshots that reference an older version
-- stay reproducible.
CREATE TABLE policy_versions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    version     INTEGER NOT NULL,
    policy_json TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 0,
    note        TEXT,
    created_by  TEXT,
    created_at  TEXT NOT NULL,
    UNIQUE (name, version)
);

-- Commission rules gain versioning + an active flag (existing rows stay valid).
ALTER TABLE commission_rules ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE commission_rules ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE commission_rules ADD COLUMN source_code TEXT;
ALTER TABLE commission_rules ADD COLUMN superseded_rule_id TEXT;
