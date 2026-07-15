# Data dictionary

Schema version: migrations `0001_initial` + `0002_exchange2` + `0003_report_scope`. All monetary columns are
INTEGER minor units at scale 4 (suffix `_minor`); rates are TEXT canonical decimals; dates
are ISO-8601 TEXT. Internal ids are opaque (`<prefix>_<uuid4hex>`); external identifiers live
only in `external_identifiers` and are never join keys.

## Core tables
| Table | Purpose | Key columns |
|---|---|---|
| import_batches | one import run | id, status, created_at, posted_at |
| source_files | registered raw file | id, import_batch_id, content_sha256, byte_size |
| source_records | raw + normalized row (lineage) | id, raw_json, normalized_json, row_error |
| customers / vendors | master data (name + name_raw) | id, name, name_raw |
| products / product_aliases | product + alias values (incl. SKU) | id, name / alias_type, alias_value |
| external_identifiers | preserved external ids (never a join key) | entity_kind, entity_id, namespace, value |
| reporting_periods | period + lock flag | id, label, start_date, end_date, locked |
| transactions | generic transaction core (distinct types) | id, transaction_type, customer_id, posted, review_status, dedup_status, header_total_minor, source_row_hash, commission_rule_id, **all date concepts** |
| transaction_lines | line amounts (minor, scale 4) | quantity_minor, unit_sales_price_minor, discount/credit/return/customer_shipping/other/tax _minor |
| cost_components | typed cost components | component_type, amount_minor, vendor_id, vendor_bill_number |
| commission_rules / commission_calculations | rules + computed commission | basis, rate_canonical / basis_amount_minor, commission_minor, verification_level |
| record_verifications | per-calculation verification state | calculation_type, level, missing_fields_json |
| calculation_snapshots | immutable calculation results (append-only) | calculation_name, policy_id/version, formula_version, inputs_json, output_value/kind/scale, verification_level, superseded_snapshot_id |
| exceptions | Where's-Your-Proof register | exception_type, calculation_type, missing_information, why_critical, proof_needed, priority, status, resolution_evidence, reclassification_result |
| duplicate_candidates | likely duplicates (never merged) | candidate_group_id, match_score, matching/conflicting_fields_json, recommended_disposition |
| reconciliation_findings | conflicts + reconciliations | finding_type, rule, expected/actual/difference/tolerance, status, severity, explanation |
| override_authorizations | recorded duplicate-post overrides | scope, subject_ref, reason, authorized_by |
| audit_events | append-only, PII-free events | kind, summary, detail_json, actor |
| report_manifests | reproducibility record per generated report/export | scope_json, calculation_policy, integrity_ok, integrity_json, export_hashes_json |
| schema_migrations | applied migrations | version, applied_at |

**Exchange 2.1 scope columns:** `commission_calculations` gains `is_current`,
`superseded_calc_id`, `transaction_line_id`, `reporting_period_id`, `import_batch_id`;
`reconciliation_findings` and `exceptions` gain `import_batch_id`/`reporting_period_id`;
`duplicate_candidates` gains `import_batch_id`; `exceptions` gains `source_record_id`.
Reports scope on these so batch/period counts never include unrelated historical records.

## Transaction types (distinct; never conflated)
quote, sales_order, invoice, shipment, payment, credit_memo, return, purchase_order,
item_receipt, vendor_bill, vendor_payment, journal_entry, and `unknown` (preserved).

## Date concepts (separate columns)
transaction, order, invoice, ship, due, payment, cost_recognition, commission_eligibility,
period_assignment.
