# Data Directory Architecture & Governance (Phase 3)

This directory stores datasets for training, evaluation, retrieval, and governance in the **Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation** system.

## Directory Structure

```
data/
├── raw/            # Immutable original complaint datasets (CSV, JSON, text dumps)
│   └── complaints_processed.csv    # Kaggle/CFPB 162,421 consumer financial complaint records
├── processed/      # Cleaned, normalized, deduplicated, and stratified train/val/test splits
│   ├── train.csv                   # 87,103 training examples (70%)
│   ├── val.csv                     # 18,665 validation examples (15%)
│   ├── test.csv                    # 18,666 test examples (15%)
│   ├── label_mapping.json          # Canonical 5-class product taxonomy
│   ├── split_metadata.json         # Class distributions, random seed 42, zero leakage verification
│   └── test_evaluation_report.json # Macro F1 = 0.8385 classification metrics
└── resolutions/    # Historical dispute playbooks and synthetic test fixtures for RAG
    ├── verified_resolutions_kb.json # 22 verified statutory playbooks with legal citations
    └── synthetic_test_fixtures.json # 5 synthetic edge-case test fixtures (marked is_verified: false)
```

## Folder Descriptions

### 1. `raw/`
- Contains the un-manipulated raw CFPB dataset (`complaints_processed.csv`).
- **Rule**: Files in this directory are strictly read-only.

### 2. `processed/`
- Output of `scripts/ingest_dataset.py`.
- **Deduplication:** 37,948 exact duplicate complaints (23.36%) were removed to eliminate cross-split data leakage.
- **Stratified Split:** 70% train (87,103), 15% validation (18,665), 15% test (18,666) preserving exact class ratios.
- **Categories:** `credit_reporting` (45.18%), `debt_collection` (16.91%), `mortgages_and_loans` (15.05%), `credit_card` (12.04%), `retail_banking` (10.82%).

### 3. `resolutions/`
- **`verified_resolutions_kb.json`**: 22 curated historical dispute playbooks modeled directly on CFPB dispute handling precedents and US financial consumer regulations:
  - Truth in Lending Act / Regulation Z (12 CFR 1026.13)
  - Fair Credit Reporting Act (15 U.S.C. 1681b / 1681i)
  - Electronic Fund Transfer Act / Regulation E (12 CFR 1005.11)
  - Fair Debt Collection Practices Act (15 U.S.C. 1692c / 1692g)
  - Real Estate Settlement Procedures Act (12 CFR 1024.35 / 1024.36)
  - **Phase 3 Provenance Attributes**: Every playbook tracks `source_title`, `source_url`, `source_org`, `content_type`, `version`, `effective_date`, `last_verified_at`, and `statutory_authority`.
  - All records feature `is_verified: true`, canonical department routing codes, and action steps.
- **`synthetic_test_fixtures.json`**: 5 synthetic records created specifically to test retrieval boundary conditions (out-of-domain claims, contradictory statements). All records feature `is_verified: false` and `verification_status: "SYNTHETIC_FIXTURE"`, ensuring they are never surfaced in production RAG recommendations.

---

## Data Governance & Privacy Policies

1. **PII Redaction:** Before complaint text is embedded or transmitted to vector indices, automated regex sanitizers scrub sensitive personal identifying information (SSNs, 16-digit credit card PANs, email addresses, phone numbers).
2. **Provenance Tiering:**
   - Tier 1: Official Statutory Authorities (CFR, USC, CFPB regulations).
   - Tier 2: Institutional Operational Standard Operating Procedures.
   - Tier 3: Synthetic Test Fixtures (quarantined with `is_verified: false`).
3. **Retention & Deletion Policy:**
   - Complaint records are retained for auditing up to statutory limitation periods.
   - In compliance with privacy standards, support supervisors can redact customer narratives without breaking relational referential integrity.
