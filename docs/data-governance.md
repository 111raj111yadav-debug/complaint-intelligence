# Data Governance, Provenance & Privacy Policy

**Project Title:** Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation
**Document Status:** Phase 3 Approved
**Classification:** Enterprise Operational Guidelines

---

## 1. Overview & Objectives

In automated financial dispute processing, data governance protects customer privacy, prevents the leakage of Personally Identifiable Information (PII), ensures the legal validity of retrieved standard operating procedures (SOPs), and maintains regulatory compliance under frameworks such as GLBA (Gramm-Leach-Bliley Act), CCPA, and statutory disclosure mandates.

---

## 2. Knowledge Base Provenance Tiering

The resolution knowledge base categorizes all precedent materials into three strictly segregated tiers:

### Tier 1: Official Regulatory & Statutory References
- **Definition:** Codified federal and state financial consumer protection regulations.
- **Attributes:** Must cite exact statutory chapters (e.g. 12 CFR 1026.13 for Regulation Z, 15 U.S.C. 1681b for FCRA, 12 CFR 1005.11 for Regulation E).
- **Verification Requirement:** Requires review by a compliance supervisor before setting `is_verified = true`.
- **RAG Eligibility:** 100% eligible for dense vector retrieval and recommendation synthesis.

### Tier 2: Institutional Operational Playbooks
- **Definition:** Internal dispute resolution standard operating procedures developed by bank dispute resolution units.
- **Attributes:** Documented step-by-step agent actions, turnaround SLAs, and chargeback reason codes (e.g. Visa 4834, Mastercard 4853).
- **Verification Requirement:** Requires annual audit and validation against updated card network operating regulations.
- **RAG Eligibility:** Eligible for retrieval if marked `is_verified = true`.

### Tier 3: Synthetic Test Fixtures
- **Definition:** Artificially generated complaint-resolution pairs used exclusively to stress-test system boundary conditions (e.g. cryptocurrency smart contracts, food delivery, out-of-domain edge cases).
- **Attributes:** Explicitly marked `is_verified = false` and `verification_status = "SYNTHETIC_FIXTURE"`.
- **RAG Eligibility:** **Strictly blocked** from production semantic search queries through mandatory SQL filter `WHERE is_verified = TRUE`.

---

## 3. Personally Identifiable Information (PII) Redaction

Customer dispute narratives frequently contain sensitive identifiers that must not be embedded or shared across unencrypted boundaries:

1. **Social Security Numbers (SSN):** Regex pattern `\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b` masked to `[REDACTED_SSN]`.
2. **Primary Account Numbers (PAN / Credit Card):** 13 to 19 digit card numbers validated via Luhn check masked to `[REDACTED_CARD]`.
3. **Email Addresses:** Pattern `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b` masked to `[REDACTED_EMAIL]`.
4. **Phone Numbers:** Pattern `\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b` masked to `[REDACTED_PHONE]`.

### Storage & Sanitization Flow

$$\text{Original Raw Text} \xrightarrow{\text{Regex Redactor}} \text{Sanitized Text} \xrightarrow{\text{Tokenizer}} \text{Vector Embedding (384-d)}$$

- The vector embedding is computed **strictly from sanitized text** to prevent latent representation leakage.
- Unsanitized original text is accessible only to authorized agents assigned to the specific case.

---

## 4. Data Retention & Deletion Policy

1. **Active Disputes:** Retained with full audit trail until 90 days after `RESOLVED` status.
2. **Archived Disputes:** Retained for 7 years in cold storage to comply with federal financial record-keeping mandates (e.g. Bank Secrecy Act / Dodd-Frank).
3. **Right to Erasure (Privacy Compliance):** When a customer submits an authorized deletion request:
   - The complaint text is permanently overwritten with `"[REDACTED PURSUANT TO DATA PRIVACY REQUEST]"`.
   - The associated vector embedding is dropped from `pgvector`.
   - Relational foreign keys, metadata timestamps, and audit actions are preserved to protect business reporting integrity without retaining PII.

---

## 5. Auditability & Non-Repudiation

- Every workflow status transition, assignment change, NLP analysis, and recommendation feedback submission is logged in `complaint_audit_logs`.
- Logs record the immutable `timestamp`, `actor_id`, `actor_name`, `action`, `from_status`, `to_status`, and `reason`.
- Audit logs cannot be updated or deleted via API endpoints.
