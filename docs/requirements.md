# Requirements Specification Document

**Project:** Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation
**Type:** MCA Final-Year Capstone Project
**Status:** Phase 0 Baseline Established

---

## 1. Problem Statement

Modern enterprise customer support centers handle thousands of multi-channel complaints daily across billing, technical issues, service quality, account security, and logistics. Manual complaint triage and resolution suffer from three critical bottlenecks:

1. **High Triage Latency:** Manual review takes hours or days to identify urgent complaints (e.g., security breaches, fraud, executive escalations).
2. **Inconsistent Department Routing:** Complaints are frequently misclassified and bounced across departments.
3. **Repetitive, Ungrounded Resolutions:** Support agents repeatedly formulate solutions from scratch, ignoring verified historical resolutions and enterprise standard operating procedures (SOPs).

---

## 2. Project Goals & Objectives

The goal of this project is to develop an automated, end-to-end intelligence system that:

1. Ingests raw customer complaint text from web portals and external communication channels.
2. Automatically parses, tokenizes, and classifies complaints into domain-specific categories.
3. Extracts sentiment polarity, fine-grained emotions (frustration, anger, neutral), and priority urgency scores.
4. Identifies semantic similarity between new complaints and verified past resolution pairs using PostgreSQL `pgvector`.
5. Synthesizes evidence-grounded, context-aware resolution drafts using Retrieval-Augmented Generation (RAG).
6. Provides an agent dashboard for human-in-the-loop review, feedback tracking, and SLA performance analytics.

---

## 3. Functional Requirements (FR)

### Module 1: Ingestion & Management (Phase 1)

- **FR-1.1:** System shall ingest complaint text, metadata (customer name, channel, timestamp), and attachments.
- **FR-1.2:** System shall assign a unique, sequential ticket tracking identifier (`TICK-YYYYMMDD-XXXX`).
- **FR-1.3:** System shall mask Personally Identifiable Information (PII) such as credit card numbers, phone numbers, and emails during preprocessing.

### Module 2: NLP Analysis & Classification (Phase 1)

- **FR-2.1:** System shall classify complaints into primary and secondary categories with associated confidence scores.
- **FR-2.2:** System shall compute sentiment polarity (Positive, Neutral, Negative) and score normalized in `[-1.0, 1.0]`.
- **FR-2.3:** System shall extract primary customer emotion (Anger, Frustration, Sadness, Disappointment, Neutral).
- **FR-2.4:** System shall compute a composite Urgency Score (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) based on emotion, sentiment, key indicators, and VIP flags.

### Module 3: Semantic Retrieval & RAG Resolution (Phase 2)

- **FR-3.1:** System shall convert complaint text into dense embeddings using a sentence-transformer model.
- **FR-3.2:** System shall retrieve top-k similar historical complaints and SOPs using cosine similarity in `pgvector`.
- **FR-3.3:** System shall generate an evidence-grounded resolution draft citing source knowledge items.
- **FR-3.4:** Support agents shall be able to accept, edit, or reject the suggested resolution, feeding back into model evaluation.

### Module 4: Analytics & SLA Management (Phase 3)

- **FR-4.1:** System shall visualize complaint trends over time by category and department.
- **FR-4.2:** System shall highlight complaints at risk of SLA breach based on urgency.

---

## 4. Non-Functional Requirements (NFR)

- **NFR-1 (Latency):** API health and status probes must respond in under 100ms. NLP classification inference shall complete within 1.5 seconds.
- **NFR-2 (Security):** All secrets, passwords, and API keys must be loaded via validated environment variables and excluded from version control.
- **NFR-3 (Data Integrity):** Parameterized queries must prevent SQL injection across all database interactions.
- **NFR-4 (Architecture Decoupling):** The browser client must never directly communicate with internal ML microservices.
- **NFR-5 (Reproducibility):** The entire infrastructure must start using standard Docker Compose and npm/python commands without proprietary dependencies.
