-- finance-system Exchange 3 — reporting-period lifecycle with authorized transitions.
PRAGMA foreign_keys = ON;

ALTER TABLE reporting_periods ADD COLUMN state TEXT NOT NULL DEFAULT 'open';
ALTER TABLE reporting_periods ADD COLUMN locked_at TEXT;
ALTER TABLE reporting_periods ADD COLUMN locked_by TEXT;
ALTER TABLE reporting_periods ADD COLUMN reopen_reason TEXT;
ALTER TABLE reporting_periods ADD COLUMN reopened_by TEXT;
ALTER TABLE reporting_periods ADD COLUMN reopened_at TEXT;

-- Existing locked periods keep their meaning under the new state machine.
UPDATE reporting_periods SET state = 'locked' WHERE locked = 1;

-- Every transition is recorded, including who authorized a reopen and why.
CREATE TABLE period_transitions (
    id            TEXT PRIMARY KEY,
    period_id     TEXT NOT NULL REFERENCES reporting_periods(id),
    from_state    TEXT NOT NULL,
    to_state      TEXT NOT NULL,
    reason        TEXT,
    authorized_by TEXT,
    created_at    TEXT NOT NULL
);
CREATE INDEX idx_period_trans ON period_transitions(period_id);
