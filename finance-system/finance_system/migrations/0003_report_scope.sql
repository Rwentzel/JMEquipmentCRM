-- finance-system Exchange 2.1 — scope + snapshot-currency support.
-- Additive only. Enables scoped reporting, current-commission selection, and scoped counts.

PRAGMA foreign_keys = ON;

-- Commission calculations gain a current/superseded concept so a recalculation does not
-- cause both the superseded and replacement commission to be counted.
ALTER TABLE commission_calculations ADD COLUMN is_current INTEGER NOT NULL DEFAULT 1;
ALTER TABLE commission_calculations ADD COLUMN superseded_calc_id TEXT;
ALTER TABLE commission_calculations ADD COLUMN transaction_line_id TEXT;
ALTER TABLE commission_calculations ADD COLUMN reporting_period_id TEXT;
ALTER TABLE commission_calculations ADD COLUMN import_batch_id TEXT;
CREATE INDEX idx_commcalc_current ON commission_calculations(transaction_id, is_current);

-- Findings and exceptions gain explicit scope columns so batch/period reports do not
-- inflate their counts with unrelated historical records.
ALTER TABLE reconciliation_findings ADD COLUMN import_batch_id TEXT;
ALTER TABLE reconciliation_findings ADD COLUMN reporting_period_id TEXT;
ALTER TABLE duplicate_candidates ADD COLUMN import_batch_id TEXT;
ALTER TABLE exceptions ADD COLUMN import_batch_id TEXT;
ALTER TABLE exceptions ADD COLUMN reporting_period_id TEXT;
ALTER TABLE exceptions ADD COLUMN source_record_id TEXT;
CREATE INDEX idx_recon_batch ON reconciliation_findings(import_batch_id);
CREATE INDEX idx_dupcand_batch ON duplicate_candidates(import_batch_id);
CREATE INDEX idx_exc_batch ON exceptions(import_batch_id);

-- Report manifests: a reproducibility record per generated report/export.
CREATE TABLE report_manifests (
    id                 TEXT PRIMARY KEY,
    generated_at       TEXT NOT NULL,
    database_id        TEXT,
    schema_version     TEXT,
    scope_json         TEXT NOT NULL,
    reporting_period_id TEXT,
    import_batch_id    TEXT,
    calculation_policy TEXT,
    evidence_matrix_version TEXT,
    formula_version    TEXT,
    currency           TEXT,
    integrity_ok       INTEGER NOT NULL,
    integrity_json     TEXT,
    record_counts_json TEXT,
    export_hashes_json TEXT
);
