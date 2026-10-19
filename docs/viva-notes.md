# MCA Final-Year Project Viva Defense Guide

**Project Title:** Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation
**Topic:** Natural Language Processing (NLP), Microservices Architecture, Vector Databases & RAG
**Academic Degree:** Master of Computer Applications (MCA) Final-Year Capstone

---

## 1. High-Probability Viva Examination Questions & Answers

### Q1: What is the core problem and real-world relevance of this project?

**Answer:** Enterprise financial support centers face thousands of multi-channel customer complaints daily under strict statutory SLAs (Regulation Z, FCRA, Regulation E, RESPA, FDCPA). Manual triage suffers from:

1. High triage latency and department misrouting.
2. Inconsistent resolution formulations.
3. Severe regulatory penalties if statutory deadlines are missed.

This platform automates NLP classification, emotion/urgency scoring, department routing, and uses a Retrieval-Augmented Generation (RAG) engine over PostgreSQL `pgvector` to provide evidence-grounded action plans with heuristic evidence strength scoring.

---

### Q2: How does your RAG system work from complaint ingestion to resolution recommendation?

**Answer:** The end-to-end pipeline operates in 6 stages:

1. **Input Normalization & PII Sanitization:** The complaint is normalized (Unicode NFC) and regex-sanitized to redact sensitive PII (SSNs, 16-digit card numbers, emails, phone numbers).
2. **Phase 1 Multitask NLP:** TF-IDF + Logistic Regression classifies product category (Macro F1 = 0.8385), VADER scores sentiment, Plutchik lexicons extract primary emotion, and rule heuristics compute explainable urgency.
3. **Dense Vector Embedding:** The normalized text is encoded into a 384-dimensional unit-length embedding using `sentence-transformers/all-MiniLM-L6-v2`.
4. **pgvector HNSW Retrieval:** PostgreSQL executes an HNSW nearest-neighbor cosine similarity query (`1.0 - (embedding <=> query_vec)`) against verified CFPB playbooks, applying category filters and threshold filtering (default $\ge 0.40$).
5. **Calibrated Generation & Evidence Grounding:** If OpenAI API keys are absent or unconfigured, the system automatically falls back to an offline extractive evidence-grounded provider. The recommendation synthesizes action steps strictly from retrieved precedents, citing source reference codes.
6. **Risk Rules & Human-in-the-Loop:** Complaints containing litigation keywords ("sue", "attorney", "court") or regulatory agency references automatically trigger `human_review_required = True`. Dispute officers can accept, modify, and rate recommendations, closing the feedback loop.

---

### Q3: Why `all-MiniLM-L6-v2` (384 dimensions) instead of OpenAI `text-embedding-3-small` (1536 dimensions)?

**Answer:**

1. **Local Offline Inference:** `all-MiniLM-L6-v2` runs locally on CPU with an average inference latency of ~4.8 ms per text. It requires 0 cloud API costs, no external API keys, and has zero network dependency.
2. **Compact Storage & Memory:** 384 dimensions require 75% less storage and RAM in pgvector compared to 1536 dimensions ($384 \times 4\text{ bytes} \approx 1.5\text{ KB}$ per vector vs $6\text{ KB}$).
3. **High Semantic Accuracy:** It is benchmarked extensively on MTEB (Massive Text Embedding Benchmark) for semantic search and sentence similarity, achieving a 1.0000 Hit@3 on our held-out dispute evaluation set.

---

### Q4: How do you empirically prove that Dense Retrieval is better than Keyword Search?

**Answer:** We implemented a reproducible retrieval evaluation script (`services/nlp/scripts/evaluate_retrieval.py`) comparing dense semantic retrieval against a TF-IDF lexical baseline across 20 held-out financial dispute queries:

| Metric                         | Dense Retrieval (`pgvector`) | TF-IDF Baseline | Improvement |
| ------------------------------ | :--------------------------: | :-------------: | :---------: |
| **Hit@3**                      |      **1.0000** (20/20)      | 0.9500 (19/20)  | **+5.26%**  |
| **Recall@3**                   |          **1.0000**          |     0.9500      | **+5.26%**  |
| **MRR (Mean Reciprocal Rank)** |          **0.9750**          |     0.9600      | **+1.56%**  |

Dense retrieval solves **vocabulary mismatch**. For example, a customer submitting _"bank debited my account but ATM failed to dispense cash"_ matches the playbook _"ATM Hardware Dispense Failure Refund Procedure"_ in dense retrieval, whereas TF-IDF fails because the customer did not use formal terms like _"hardware discrepancy"_ or _"electronic terminal log"_.

---

### Q5: How do you prevent hallucinations in RAG recommendations?

**Answer:** Hallucinations in financial and legal domains can lead to compliance violations. We prevent them through 5 layers of defense:

1. **Strict Evidence Citations:** Every recommendation must cite the primary key (`source_id`), `reference_code`, and `similarity_score` of the underlying playbook.
2. **Offline Fallback Provider:** When LLM providers are unavailable, the extractive provider extracts verified statutory action steps directly from the matched playbook.
3. **Calibrated Evidence Strength:** If the top similarity score is below 0.40, evidence strength is rated `INSUFFICIENT`, preventing ungrounded advice.
4. **Deterministic Risk Filter:** Complaints mentioning lawsuits, attorneys, or regulators mandate human review.
5. **Separate Synthetic Fixtures:** Synthetic test fixtures are explicitly marked `is_verified = false` and excluded from production RAG queries.

---

### Q6: Why PostgreSQL with pgvector instead of a standalone vector database like Pinecone or Chroma?

**Answer:**

1. **ACID Transactions & Unified Storage:** Relational business entities (complaints, departments, resolution recommendations, feedback audit logs) live alongside vector embeddings in a single database. This eliminates dual-write anomalies, distributed transactions, and synchronization lag.
2. **Relational + Vector Joins:** In a single SQL query, we can filter by department, verification status, and compute vector cosine distance.
3. **Index Method:** pgvector supports native HNSW indexing (`vector_cosine_ops`), executing sub-5ms searches in $O(\log N)$ time.
4. **Cost & Privacy:** Completely self-hosted via Docker with 0 recurring cloud subscription costs and no customer data shared with third-party vector DBs.

---

### Q7: Why separate the architecture into Node.js (Express) and Python (FastAPI)?

**Answer:** This follows the **separation of concerns** principle:

- **Node.js (Express):** API Gateway handling high-concurrency client requests, request logging, Zod validation, CORS, and relational transactions via Prisma.
- **Python (FastAPI):** Specialized AI/ML microservice with PyTorch, SentenceTransformers, NLTK, and scikit-learn.
- The Python service is internal-only, protected behind the Express gateway.

---

### Q8: How is Security and Role-Based Access Control (RBAC) implemented in Phase 3?

**Answer:** We implemented a defense-in-depth security model:

1. **Authentication:** Stateless JSON Web Tokens (JWT) signed with HMAC-SHA256, expiring after 24 hours. Passwords are salted and hashed using `bcryptjs` (cost factor 10).
2. **Four Distinct Roles:**
   - `ADMIN`: User administration, staff onboarding, system health diagnostics.
   - `MANAGER`: Department routing, assignment, reassignment, reopen approvals.
   - `AGENT`: Complaint investigation, workflow progression (`IN_REVIEW`, `RESOLVED`), RAG recommendations, feedback submission.
   - `AUDITOR`: Strictly read-only access. Any attempt to modify data returns `403 FORBIDDEN`.
3. **No Frontend-Only Security:** Authorization checks are enforced server-side via `requireRoles(...)` middleware on Express route handlers.
4. **Brute-Force & Injection Protection:** Rate-limiting via `express-rate-limit` (100 req / 15 min), payload caps (1MB), and parameterized queries via Prisma prevent SQL injection.

---

### Q9: How does the Complaint Workflow State Machine prevent unauthorized state transitions or data corruption?

**Answer:** The complaint lifecycle follows an explicit directed state graph:
$$\text{PENDING} \rightarrow \text{ANALYZED} \rightarrow \text{IN\_REVIEW} \rightarrow \text{RESOLVED}$$

- **Transition Validation:** The service checks requested transitions against an allowed-transition map (`VALID_STATUS_TRANSITIONS`). Illegal leaps (e.g. `RESOLVED` directly to `ANALYZED`) are rejected with `400 INVALID_STATUS_TRANSITION`.
- **Reopen Justification:** Reopening a resolved case requires a mandatory documented reason. Requests without a reason are rejected with `400 REOPEN_REASON_REQUIRED`.
- **Immutable Chronological Auditing:** Every event (creation, analysis, assignment, reassignment, status change) creates an append-only row in `complaint_audit_logs` storing previous status, new status, actor ID, actor role, and reason.

---

### Q10: How are Operational Analytics computed without fabrication or division by zero?

**Answer:**
1. **Real Database Aggregations:** All metrics query real PostgreSQL rows via Prisma aggregations (`count`, `avg`, `groupBy`). Zero values are never fabricated or hardcoded.
2. **Documented Denominators:** Every metric object exposes its mathematical formula and explicit denominator (e.g. feedback acceptance rate uses feedback submissions as denominator, not all generated recommendations).
3. **Empty Dataset Handling:** Date ranges with zero complaints return `null` with a formatted `"N/A"` string, preventing `NaN` or `ZeroDivisionError`.
4. **Agent Workload Metrics:** Workload distribution counts active assigned cases by staff user ID from current assignments.

---

### Q11: How does the Recommendation Feedback and Evaluation Rubric work?

**Answer:**
1. **3-Way Human Decisions:** Dispute officers record whether a recommendation was `ACCEPTED_AS_IS`, `MODIFIED` (with override notes), or `REJECTED` (with mandatory rejection reason).
2. **6-Dimension Evaluation Rubric:** Assesses Relevance (5.0/5), Evidence Grounding (4.83/5), Citation Accuracy (4.83/5), Actionability (5.0/5), Safety (5.0/5), and Escalation Appropriateness (86.7%).
3. **Human Review vs Automated Execution:** A recommendation never resolves a complaint automatically. Human dispute officers must verify actions and confirm resolution.

---

### Q12: What is the distinction between Cosine Similarity, Confidence Probability, and Calibrated Evidence Strength?

**Answer:** This is a vital scientific distinction:
- **Cosine Similarity:** Measures geometric vector proximity in 384-dimensional latent space. It is uncalibrated and does **not** equal a Bayesian probability $P(\text{correct} | \text{text})$.
- **Heuristic Evidence Score:** A combination of top retrieval similarity and candidate density.
- **Evidence Strength:** Categorical operational thresholds (`HIGH` $\ge 0.70$, `MEDIUM` $0.55-0.70$, `LOW` $0.40-0.55$, `INSUFFICIENT` $< 0.40$).
- We never claim these heuristic scores are calibrated probabilities because that would require empirical Platt scaling on a large labeled dataset.

---

### Q13: What are the main production limitations and architectural trade-offs of this capstone?

**Answer:**
1. **Embedding Truncation:** `all-MiniLM-L6-v2` caps inputs at 256 WordPiece tokens; extremely long legal attachments must be chunked.
2. **Single-Node PostgreSQL:** Currently hosted as a single container instance; production enterprise scale would require read replicas and pgvector partition pruning.
3. **Synchronous Ingestion:** NLP analysis is synchronous over HTTP; an enterprise deployment would place an asynchronous message broker (RabbitMQ/Kafka) between complaint intake and NLP worker pools.

---

## 2. Live Viva Demonstration Script

During your viva defense, execute this step-by-step walkthrough:

### 1. Show pgvector Vector Index in PostgreSQL

```powershell
docker exec complaint_intelligence_postgres psql -U postgres -d complaint_intelligence_db -c "\dx vector; \d+ resolutions;"
# Point out: vector 0.8.7 extension and resolutions_embedding_hnsw_idx on embedding vector(384)
```

### 2. Run All Automated Tests Across Monorepo (103 passing tests)

```powershell
# Backend Express API (60 tests passing)
npm run test:api

# Python FastAPI NLP Service (38 tests passing)
npm run test:nlp

# React Web Frontend (5 tests passing)
npm run test:web

# Full Monorepo Build (Code 0)
npm run build
```

### 3. Run Retrieval and Recommendation Evaluation Benchmarks

```powershell
# 35-query semantic retrieval benchmark
python services/nlp/scripts/evaluate_retrieval.py

# 15-case recommendation quality rubric evaluation
python services/nlp/scripts/evaluate_recommendations.py
```

### 4. Demonstrate Full Stack in Browser (`http://localhost:3000`)

1. **RBAC Role Switcher:** Demonstrate logging in as `ADMIN`, `MANAGER`, `AGENT`, and `AUDITOR` using the quick switcher in the top navigation bar.
2. **Auditor Restriction:** As `AUDITOR`, attempt to edit a complaint status or reassign; point out the read-only notice and disabled controls.
3. **Complaint Workflow & SLA:** Open a complaint, review the SLA countdown badge and urgency level, assign to an agent with notes, and inspect the chronological audit trail.
4. **RAG Recommendation & 3-Way Feedback:** Open the recommendation panel, review the grounded statutory citations (e.g. 12 CFR 1026.13), and submit structured feedback (Accept As-Is, Modify, or Reject with rubric scores).
5. **Operational Analytics Dashboard:** Navigate to **Operational Analytics**, demonstrate real-time charts (volume by department, open vs resolved donut, feedback breakdown, agent workload table, and transparent formula tooltips).
