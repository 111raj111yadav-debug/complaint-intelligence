# Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation

**MCA Final-Year Capstone Project**
**Current Milestone:** Phase 3 — Production Hardening, Analytics & Intelligent Operations (Completed)

---

## 1. Project Overview

The **Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation** platform is an enterprise-grade, microservice-powered platform designed to automate customer support triage, intent classification, sentiment analysis, urgency scoring, semantic retrieval, and evidence-grounded resolution generation.

By pairing modern Natural Language Processing (NLP) classification with dense vector retrieval using PostgreSQL `pgvector` and Retrieval-Augmented Generation (RAG), the system retrieves verified statutory playbooks and generates accurate, context-aware resolution drafts for support agents.

### Core Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios, Lucide React, Recharts.
- **Application Backend:** Node.js 24, Express, TypeScript, Zod, Prisma ORM, PostgreSQL, bcryptjs, jsonwebtoken, express-rate-limit.
- **NLP Microservice:** Python 3.12, FastAPI, PyTorch, SentenceTransformers (`all-MiniLM-L6-v2`), scikit-learn, NLTK VADER, Pydantic, pytest.
- **Database & Vectors:** PostgreSQL 16 with native `pgvector` extension (v0.8.7, HNSW index), Docker Compose.
- **Security & RBAC:** Role-Based Access Control (`ADMIN`, `MANAGER`, `AGENT`, `AUDITOR`), JWT bearer auth, password salting with bcrypt (cost factor 10), correlation IDs.
- **Tooling & Quality:** ESLint, Prettier, TypeScript strict mode, Vitest, pytest, Ruff.

---

## 2. Monorepo Repository Structure

```
complaint-intelligence/
├── apps/
│   └── web/                               # React 18 + Vite + Tailwind Frontend
│       ├── src/
│       │   ├── app/                       # Routing (routes.tsx) & root App component
│       │   ├── components/                # Reusable UI (ui/, layout/, charts/)
│       │   ├── features/                  # Feature views (dashboard, complaints, analytics, knowledge-base)
│       │   ├── hooks/                     # Custom React hooks
│       │   ├── lib/                       # Axios api-client and AuthContext
│       │   ├── services/                  # Backend API client services (auth, complaints, analytics)
│       │   ├── types/                     # Shared TypeScript interfaces
│       │   └── main.tsx                   # DOM entry point
│       ├── package.json
│       └── vite.config.ts
├── services/
│   ├── api/                               # Node.js + Express Application API
│   │   ├── src/
│   │   │   ├── config/                    # Zod validated environment config
│   │   │   ├── middleware/                # Error handling, request logger, Zod validator, auth, rate-limiter
│   │   │   ├── modules/                   # Business domain modules (auth, complaints, analytics, recommendations, resolutions)
│   │   │   ├── clients/                   # Internal NLP HTTP client
│   │   │   ├── lib/                       # Prisma client singleton, JWT utilities, response helpers
│   │   │   ├── app.ts                     # Express application factory
│   │   │   └── server.ts                  # Server entry point with graceful shutdown
│   │   ├── tests/                         # Vitest API test suite (60 tests)
│   │   └── package.json
│   └── nlp/                               # Python FastAPI Microservice
│       ├── app/
│       │   ├── api/routes/                # Health, readiness, analysis, embeddings, retrieval, rag routes
│       │   ├── core/                      # Pydantic Settings & structured logging
│       │   ├── schemas/                   # Request/Response schemas
│       │   ├── pipelines/                 # NLP pipelines (classification, sentiment, emotion, urgency, embeddings, retrieval, rag)
│       │   └── main.py                    # FastAPI application entry point
│       ├── scripts/                       # Benchmark & evaluation scripts
│       ├── tests/                         # pytest test suite (38 tests)
│       ├── requirements.txt
│       ├── pyproject.toml
│       └── Dockerfile
├── prisma/
│   ├── schema.prisma                      # Database datasource, extensions & models
│   └── migrations/                        # Version-controlled SQL migrations
├── data/                                  # Data assets (raw/, processed/, resolutions/)
├── docs/                                  # Technical & academic documentation
│   ├── architecture.md                    # System architecture & component topology
│   ├── api-specification.md               # Complete REST API specification
│   ├── database-design.md                 # Relational schema & pgvector index design
│   ├── data-governance.md                 # Provenance, PII handling & retention policy
│   ├── deployment-readiness.md            # Production deployment checklist & backup guide
│   ├── model-evaluation.md                # Multi-model evaluation & benchmark report
│   ├── retrieval_evaluation_report.json   # 35-query dense retrieval benchmark
│   ├── recommendation_evaluation_report.json # 15-case rubric evaluation report
│   ├── test-plan.md                       # Comprehensive testing strategy
│   └── viva-notes.md                      # Capstone viva defense question guide
├── scripts/                               # Development helper scripts
├── tests/                                 # Cross-service end-to-end integration tests
├── docker-compose.yml                     # PostgreSQL 16 + pgvector container definition
├── .env.example                           # Root environment variable template
├── .gitignore                             # Secret & build artifact exclusion rules
├── package.json                           # Root npm workspaces and orchestration scripts
└── README.md
```

---

## 3. Seeded Staff Roles & Demonstration Credentials

> [!CAUTION]
> **DEVELOPMENT & ACADEMIC DEMONSTRATION USE ONLY:** The following pre-seeded credentials exist exclusively for local evaluation, automated vitest suites, and academic viva defense demonstration. In production environments, credentials must be generated securely, stored in an external secrets manager, and distributed out-of-band.

| Full Name | Email Address | Role | Local Dev Password | Privileges & Access Boundaries |
| :--- | :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@complaint-intel.org` | `ADMIN` | `Admin#Intel2026!` | User administration, staff registration, system health, all operational views. |
| **Operations Supervisor** | `supervisor@complaint-intel.org` | `MANAGER` | `Supervisor#Intel2026!` | Department assignment, reassignment, reopen justification approvals, full analytics. |
| **Card Dispute Specialist** | `agent.cards@complaint-intel.org` | `AGENT` | `Agent#Intel2026!` | Complaint workflow updates (`IN_REVIEW`, `RESOLVED`), RAG recommendations, feedback submission. |
| **Collections Specialist** | `agent.disputes@complaint-intel.org` | `AGENT` | `Agent#Intel2026!` | Debt dispute handling, status updates, recommendation feedback. |
| **Compliance Auditor** | `auditor@complaint-intel.org` | `AUDITOR` | `Auditor#Intel2026!` | Strictly read-only access across complaints, audit logs, and analytics. All mutation attempts return `403 FORBIDDEN`. |

### Credential Architecture & Security Policy:
- **Zero Frontend Passwords:** As of Phase 3.3, all embedded passwords have been removed from distributable client bundle code. The quick role switcher uses the authenticated endpoint `POST /api/v1/auth/demo-login`.
- **Production Guardrails:** `POST /api/v1/auth/demo-login` is strictly disabled in production (`NODE_ENV=production`), returning HTTP 403 `DEMO_MODE_DISABLED`. Production startup validates that neither the default dev JWT secret nor default PostgreSQL connection strings are used.
- **Local Database Reseeding:** If local passwords or database states need to be reinitialized, execute:
  ```bash
  npm run db:seed
  ```
  In production environments, `npm run db:seed` requires explicit environment variables (`ADMIN_INITIAL_PASSWORD`, `SUPERVISOR_INITIAL_PASSWORD`, `AGENT_INITIAL_PASSWORD`, `AUDITOR_INITIAL_PASSWORD`) and will abort if defaults are detected.

---

## 4. Installation & Setup Guide

### Step 1: Clone and Configure Environment

```bash
git clone <repository-url>
cd complaint-intelligence

# Copy environment template to .env
cp .env.example .env
```

*(On Windows PowerShell, use `Copy-Item .env.example .env`)*

### Step 2: Install Node.js Dependencies

```bash
npm install
```

### Step 3: Install Python NLP Microservice Dependencies

```bash
# Windows
python -m venv services\nlp\.venv
services\nlp\.venv\Scripts\pip install -r services\nlp\requirements.txt

# Linux / macOS
python3 -m venv services/nlp/.venv
source services/nlp/.venv/bin/activate
pip install -r services/nlp/requirements.txt
```

### Step 4: Start PostgreSQL with pgvector Container

```bash
npm run db:up
```

Verify container health:
```bash
docker compose ps
# Container complaint_intelligence_postgres reports (healthy) on port 5434
```

### Step 5: Apply Database Migrations & Seed Data

```bash
npm run db:migrate
npm run db:seed
```

This applies all versioned migrations (including `users`, `complaint_audit_logs`, SLA fields, and provenance columns) and seeds canonical departments, RBAC staff users, and 22 verified dispute playbooks.

### Step 6: Build pgvector Vector Index

```bash
python services/nlp/scripts/build_vector_index.py
```

---

## 5. Running the Application Services

### Option A: Run Services Individually (Recommended for Debugging)

1. **Start Python FastAPI NLP Service:**
   ```bash
   # Windows
   services\nlp\.venv\Scripts\python -m uvicorn app.main:app --app-dir services/nlp --host 127.0.0.1 --port 8000 --reload

   # Linux / macOS
   ./services/nlp/.venv/bin/uvicorn app.main:app --app-dir services/nlp --host 127.0.0.1 --port 8000 --reload
   ```
   *Available at:* `http://localhost:8000` (Swagger Docs: `http://localhost:8000/docs`)

2. **Start Node.js Express API:**
   ```bash
   npm run dev:api
   ```
   *Available at:* `http://localhost:5000` (Health: `http://localhost:5000/api/v1/health`)

3. **Start React Web Frontend:**
   ```bash
   npm run dev:web
   ```
   *Available at:* `http://localhost:3000`

---

## 6. Automated Testing & Verification

The repository contains **112 distinct automated tests** across 17 test suites with 100% pass rate:
- **107 Workspace Tests:** 64 API unit/lifecycle tests, 38 Python NLP microservice tests, and 5 React frontend component tests.
- **5 Cross-Service Integration Tests:** Real inter-service HTTP communication (`tests/integration.test.ts`) between Node.js API, Python FastAPI, and PostgreSQL `pgvector`.
- *Note on Denominators:* The 5 cross-service integration tests are maintained at the repository root and are **not** part of the 107 workspace unit tests. The grand total of all automated tests is **112**.

| Test Command | Target Package | Test Files | Passed | Failed | Skipped | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `npm run test:api` | Backend Express API (`services/api`) | 9 test files | **64** | 0 | 0 | **PASS** |
| `npm run test:nlp` | Python FastAPI NLP (`services/nlp`) | 5 test modules | **38** | 0 | 0 | **PASS** |
| `npm run test:web` | React 18 Frontend (`apps/web`) | 2 test files | **5** | 0 | 0 | **PASS** |
| **Workspace Subtotal** | **All 3 Sub-packages** | **16 test files** | **107** | **0** | **0** | **PASS** |
| `npm run test:integration` | Cross-Service Integration (`tests/`) | 1 test file | **5** | 0 | 0 | **PASS** |
| **Monorepo Grand Total** | **All Distinct Suites** | **17 test files** | **112** | **0** | **0** | **PASS** |
| `npm run build` | Full Production Build | TypeScript + Vite | **Exit 0** | 0 | 0 | **PASS** |

### Verification Commands

```bash
# 1. Run all API tests (auth, workflow, security, analytics, e2e lifecycle)
npm run test:api

# 2. Run all Python NLP tests (classification, sentiment, emotion, urgency, embeddings, retrieval)
npm run test:nlp

# 3. Run web frontend tests (components, navigation, recommendation panel)
npm run test:web

# 4. Run live cross-service integration tests (Node.js -> FastAPI -> pgvector)
npm run test:integration

# 5. Run full production build (TypeScript compile + Vite production bundling)
npm run build

# 6. Run 35-query semantic retrieval benchmark
npm run eval:retrieval

# 7. Run 15-case recommendation quality rubric evaluation
python services/nlp/scripts/evaluate_recommendations.py
```

---

## 7. Key Phase 3 Highlights

1. **Role-Based Access Control (RBAC):** Real-time verified token authorization protecting sensitive endpoints with least-privilege enforcement (`ADMIN`, `MANAGER`, `AGENT`, `AUDITOR`) and immediate access revocation upon account deactivation. Frontend account switcher authenticates against server `/auth/login` and issues authentic JWTs.
2. **Complaint State Machine & Audit Trail:** Validated lifecycle transitions (`PENDING -> ANALYZED -> IN_REVIEW -> RESOLVED`), mandatory justification for reopening, and immutable chronological audit logging in `ComplaintAuditLog`.
3. **Dynamic SLA Deadlines:** SLA deadlines calculated by urgency tier (`CRITICAL` = 24h, `HIGH` = 48h, `MEDIUM` = 120h, `LOW` = 240h) with real-time overdue tracking across operational lists.
4. **Real Operational Analytics:** Real-time database aggregations computing volume trends, department backlogs, average/median time to assign and resolve, feedback acceptance rates, and rubric scores with transparent formulas.
5. **Recommendation Feedback & Rubric:** 3-way decision capture (`ACCEPTED_AS_IS`, `MODIFIED`, `REJECTED`) and 6-dimension evaluation rubric (Relevance, Grounding, Citation, Actionability, Safety, Escalation).
6. **Data Governance & Provenance:** 22 verified resolution playbooks grounded strictly in United States consumer financial protection statutes (CFPB 12 CFR 1026 Reg Z, 15 U.S.C. 1681 FCRA, 12 CFR 1005 Reg E, 15 U.S.C. 1692 FDCPA, 12 CFR 1024 RESPA). *Note: The regulatory domain is US federal financial law; it does not model Indian banking or consumer protection codes.*
7. **Empirical Benchmarks (Reproduced):**
   - Classification Macro F1: **0.8385** (18,666 held-out CFPB test samples).
   - Dense Semantic Retrieval Hit@3: **0.9333** vs 0.8667 TF-IDF baseline (35 queries, 30 answerable).
   - Dense Semantic Retrieval Hit@5: **0.9333** (28/30) vs 0.9000 TF-IDF baseline (earlier Phase 2 report recorded 1.0000 on smaller 20-query preliminary set).
   - Out-of-Domain Abstention Rate: **100.0%** (5/5).
   - Recommendation Grounding & Safety Score: **5.00 / 5.00** (0 hallucinations).

---

## 8. Release Sign-Off (Phase 3.2 Audit Verdict)

| Milestone / Gate | Evaluation Criteria | Result | Verdict |
| :--- | :--- | :---: | :---: |
| **Academic Demonstration Readiness** | All unit, NLP, web & cross-service integration tests pass; production build succeeds; live RBAC enforcement verified; zero hallucinations on evaluated sample. | 112/112 tests pass; build exit 0; live RBAC verified. | **PASS** |
| **Controlled Internal Pilot Readiness** | Multi-account role switching; real-time user deactivation; audit trail logging; SLA tracking; documented backup & runbook procedures. | Fully operational with pre-seeded staff roles. | **PASS** |
| **Public Production Readiness** | Requires TLS termination reverse proxy, managed database clustering with multi-AZ failover, and cloud KMS/secrets manager for JWT secret and API keys. | Pending infrastructure provisioning. | **CONDITIONAL PASS** |

### Verified Limitations & Unverified Items
1. **Live Paid OpenAI Generation:** Optional OpenAI LLM provider was not tested with a live billing key; verified using the deterministic `extractive_evidence_grounded` provider.
2. **Third-Party Email/SMS Notifications:** Notification delivery is mocked locally; external SMTP/Twilio gateways were not tested.
3. **Database Topology:** Evaluated on single-node PostgreSQL 16 container with `pgvector`; distributed multi-node clustering and automated replication failover remain unverified.

---

## 9. License & Academic Attribution

This project is submitted in partial fulfillment of the requirements for the **Master of Computer Applications (MCA)** degree.
Dataset credit: Consumer Financial Protection Bureau (CFPB) public complaint database via Kaggle.
