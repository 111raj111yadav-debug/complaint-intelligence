# Quality Assurance & Test Plan (Phase 1, Phase 2 & Phase 3.3 Security Verified)

**Project:** Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation
**Document Status:** Phase 3.3 Security Sign-off Reconciled & Verified
**Total Automated Test Count:** **113 Workspace Tests** (118 Monorepo Tests including Cross-Service Integration)

---

## 1. Testing Philosophy, Denominators & Mocking Strategy

The testing architecture strictly distinguishes **Unit / Service Isolation Tests** from **Live Cross-Service Integration Tests**:

1. **Workspace Isolation Suites (113 tests across 16 files):**
   - **Backend API (70 tests across 9 files):** Uses a real PostgreSQL database instance (via Prisma) for relational transactions, audit logs, and status transitions. Downstream calls to the Python NLP microservice are isolated with Vitest spies where appropriate. Includes dedicated tests for authentication, authorization (RBAC), rate limiting, SQL injection resilience, and operational analytics authorization (401 unauthenticated, 403 deactivated, 200 across all 4 roles).
   - **NLP Microservice (38 tests across 5 modules):** Standalone pytest suite exercising text cleaning, TF-IDF inference, VADER sentiment, Plutchik emotion heuristics, urgency scoring, PII redaction, L2 vector normalization, and FastAPI router schemas.
   - **Frontend Web (5 tests across 2 files):** Vitest + React Testing Library suite exercising navigation rendering, layout containers, and evidence badge displays.
   - *Workspace Total:* $70 + 38 + 5 = \mathbf{113\text{ tests}}$.

2. **Cross-Service Live Integration Suite (5 tests in `tests/integration.test.ts`):**
   - Maintained at the monorepo root, this suite does **not** mock any service. It communicates directly over HTTP to the live Python FastAPI microservice on port 8000 and executes real `pgvector` HNSW cosine similarity searches against PostgreSQL on port 5434.
   - *Integration Total:* $\mathbf{5\text{ tests}}$.
   - *Denominator Accounting:* The 5 integration tests are **not** included in the 113 workspace count. The monorepo grand total is $113 + 5 = \mathbf{118\text{ distinct tests}}$, with zero unverified double-counting.

---

## 2. Test Matrix & Implementation Status

| Scope | Workspace / Path | Test File | Target Under Test | Passed | Failed | Skipped | Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **Frontend** | `apps/web` | `src/test/App.test.tsx` | Layout rendering, navigation, route loading | 2 | 0 | 0 | **PASS** |
| **Frontend** | `apps/web` | `src/test/RecommendationPanel.test.tsx` | Evidence badges, checklist toggling, empty state | 3 | 0 | 0 | **PASS** |
| **API** | `services/api` | `tests/health.test.ts` | Liveness, readiness, 404 handler, schema validation | 4 | 0 | 0 | **PASS** |
| **API** | `services/api` | `tests/complaints.test.ts` | Complaint intake, pagination, detail, status update, NLP analysis | 7 | 0 | 0 | **PASS** |
| **API** | `services/api` | `tests/resolutions.test.ts` | Historical resolutions list, category filter, detail, search proxy, create | 7 | 0 | 0 | **PASS** |
| **API** | `services/api` | `tests/recommendations.test.ts` | RAG recommendation generation, retrieval persistence, officer feedback, departments | 5 | 0 | 0 | **PASS** |
| **API** | `services/api` | `tests/auth.test.ts` | Login, JWT generation, invalid passwords, `/auth/me`, user list, admin registration, demo-login authorization | 11 | 0 | 0 | **PASS** |
| **API** | `services/api` | `tests/workflow_audit.test.ts` | State machine transitions, reopening justification, assignment/reassignment, audit trail | 7 | 0 | 0 | **PASS** |
| **API** | `services/api` | `tests/security.test.ts` | Unauthenticated 401, RBAC 403, SQL injection resistance, payload limit (413), correlation ID, token validation, real-time deactivation, analytics 401 | 12 | 0 | 0 | **PASS** |
| **API** | `services/api` | `tests/analytics.test.ts` | Operational analytics RBAC (401 unauth, 403 deactivated, 200 for 4 roles), date filtering, zero division handling | 6 | 0 | 0 | **PASS** |
| **API** | `services/api` | `tests/e2e_full_flow.test.ts` | Full 10-step complaint-to-recommendation-to-feedback lifecycle (real DB, mocked NLP) | 8 | 0 | 0 | **PASS** |
| **NLP** | `services/nlp` | `tests/test_health.py` | Liveness probe, readiness check, ping echo, validation rejection | 4 | 0 | 0 | **PASS** |
| **NLP** | `services/nlp` | `tests/test_analysis_api.py` | Full NLP analysis endpoint, text validation, empty text handling | 3 | 0 | 0 | **PASS** |
| **NLP** | `services/nlp` | `tests/test_pipelines.py` | Cleaner, preprocessor, TF-IDF classifier, VADER sentiment, Plutchik emotion, urgency rules, router | 21 | 0 | 0 | **PASS** |
| **NLP** | `services/nlp` | `tests/test_embeddings.py` | 384-d dimension, L2 normalization, PII masking, batch processing | 4 | 0 | 0 | **PASS** |
| **NLP** | `services/nlp` | `tests/test_retrieval_and_rag.py` | pgvector cosine search, threshold filtering, RAG generation, risk rules, FastAPI routes | 6 | 0 | 0 | **PASS** |
| **Subtotal** | **Workspace** | **16 Test Files** | **All Workspace Unit & Isolated Lifecycle Suites** | **113** | **0** | **0** | **PASS** |
| **Integration** | Monorepo Root | `tests/integration.test.ts` | Real Node.js Express -> Python FastAPI -> pgvector live HTTP roundtrips | 5 | 0 | 0 | **PASS** |
| **Grand Total** | **Monorepo** | **17 Test Files** | **Complete Automated Test Surface** | **118** | **0** | **0** | **PASS** |

---

## 3. Test Execution Commands & Outputs

### 3.1 Run All Backend API Tests (Vitest)

```powershell
npm run test:api
# Result: 9 test files passed, 70 tests passed in 2.77s
```

### 3.2 Run Python NLP & Vector Retrieval Test Suite (pytest)

```powershell
npm run test:nlp
# Result: 38 passed in 22.41s
```

### 3.3 Run Frontend Web Tests (Vitest + React Testing Library)

```powershell
npm run test:web
# Result: 2 test files passed, 5 tests passed in 2.53s
```

### 3.4 Run Full Workspace Build Verification

```powershell
npm run build
# Result: TypeScript compile & Vite production build exit 0 in 3.46s
```

### 3.5 Run Empirical Evaluation Benchmarks

```powershell
# 35-query semantic retrieval benchmark comparing pgvector against TF-IDF
python services/nlp/scripts/evaluate_retrieval.py

# 15-case recommendation quality rubric evaluation
python services/nlp/scripts/evaluate_recommendations.py
```
