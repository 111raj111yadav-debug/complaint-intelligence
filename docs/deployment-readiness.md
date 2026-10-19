# Production Deployment Readiness & Operations Guide

**Project Title:** Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation
**Document Status:** Phase 3 Operational Standard
**Target Environments:** Staging / Controlled Pilot / Production

---

## 1. Pre-Deployment Readiness Checklist

Before promoting this application from a local development environment to a staging pilot or production deployment, verify each of the following operational criteria:

| Category | Verification Item | Status | Verification Evidence / Command |
| :--- | :--- | :---: | :--- |
| **Security** | No default passwords in production | ⚠️ Manual | Change `ChangeMePhase3!` passwords in `.env` and database. |
| **Security** | Secure JWT Secret | ⚠️ Manual | Set cryptographically strong `JWT_SECRET` (min 64 chars). |
| **Security** | HTTPS / TLS Termination | ⚠️ Manual | Terminate TLS via Nginx / Cloudflare reverse proxy. |
| **Security** | Role-Based Access Control verified | ✅ Verified | Tested via 9 Vitest auth/security suites (`npm run test:api`). |
| **Security** | SQL Injection & Payload Caps | ✅ Verified | Supertest verifies 1MB body limit and parameterized SQL. |
| **Database** | PostgreSQL 16 + pgvector healthy | ✅ Verified | Running on container `complaint_intelligence_postgres`. |
| **Database** | Migrations Applied Cleanly | ✅ Verified | All 4 Prisma migrations applied via `npm run db:migrate`. |
| **Database** | HNSW Vector Index Populated | ✅ Verified | 384-d cosine index populated on `resolutions.embedding`. |
| **ML & NLP** | Classifier Artifacts Present | ✅ Verified | `services/nlp/artifacts/category_model.joblib` loaded. |
| **ML & NLP** | SentenceTransformer Cached | ✅ Verified | `all-MiniLM-L6-v2` runs offline without internet access. |
| **ML & NLP** | Offline Extractive RAG Fallback | ✅ Verified | Functions deterministically without paid OpenAI keys. |
| **Observability** | Request Correlation IDs | ✅ Verified | `X-Correlation-ID` header emitted and logged across services. |
| **Observability** | Health & Readiness Probes | ✅ Verified | `/api/v1/health/ready` validates DB & NLP connectivity. |
| **Tests** | All Monorepo Tests Passing | ✅ Verified | 103 tests passing (60 API, 38 NLP, 5 Web). |
| **Build** | Zero Compilation Errors | ✅ Verified | `npm run build` exits with code 0. |

---

## 2. Environment Configuration Matrix

| Variable | Recommended Dev Value | Recommended Prod Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `development` | `production` | Enables Express production performance & caching. |
| `PORT` | `5000` | `5000` | Node.js Express API internal listening port. |
| `DATABASE_URL` | `postgresql://...:5434/...` | `postgresql://...:5432/...` | PostgreSQL connection string with pgvector. |
| `JWT_SECRET` | `dev-insecure-secret` | `openssl rand -hex 32` | Secret key for signing authorization tokens. |
| `NLP_SERVICE_URL` | `http://127.0.0.1:8000` | `http://nlp-service:8000` | Internal network URL for Python FastAPI. |
| `RAG_PROVIDER` | `extractive_evidence_grounded` | `extractive_evidence_grounded` | Offline fallback or `openai` if key provided. |
| `OPENAI_API_KEY` | *(empty)* | *(optional)* | Optional paid LLM provider API key. |

---

## 3. Database Backup & Disaster Recovery Procedures

### 3.1 Automated Database Dump (Backup)

To create a timestamped logical backup of the PostgreSQL database including all relational entities, audit logs, and vector embeddings:

```bash
# Windows PowerShell
$TIMESTAMP = (Get-Date -Format "yyyyMMdd_HHmmss")
docker exec -t complaint_intelligence_postgres pg_dump -U postgres -d complaint_intelligence_db -F c -b -v -f /tmp/backup_$TIMESTAMP.dump
docker cp complaint_intelligence_postgres:/tmp/backup_$TIMESTAMP.dump ./backups/backup_$TIMESTAMP.dump

# Linux / macOS
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec -t complaint_intelligence_postgres pg_dump -U postgres -d complaint_intelligence_db -F c -b -v -f /tmp/backup_${TIMESTAMP}.dump
docker cp complaint_intelligence_postgres:/tmp/backup_${TIMESTAMP}.dump ./backups/backup_${TIMESTAMP}.dump
```

### 3.2 Database Restoration

To restore from a backup file:

```bash
# Copy dump file into container
docker cp ./backups/backup_target.dump complaint_intelligence_postgres:/tmp/restore.dump

# Execute pg_restore
docker exec -t complaint_intelligence_postgres pg_restore -U postgres -d complaint_intelligence_db -v --clean --if-exists /tmp/restore.dump
```

### 3.3 Offline NLP Artifact Restoration

If setting up in an air-gapped or fresh container environment:
1. Ensure `services/nlp/artifacts/category_model.joblib` and `vocabulary.joblib` are copied into `services/nlp/artifacts/`.
2. Pre-cache `sentence-transformers/all-MiniLM-L6-v2` in torch cache (`~/.cache/torch/sentence_transformers/`).
3. Re-run `python services/nlp/scripts/build_vector_index.py` to regenerate vector embeddings from `verified_resolutions_kb.json`.

---

## 4. Readiness Assessment & Deployment Recommendation

- **Academic Capstone & Viva Demonstration:** **100% READY.** All components, test suites, benchmarks, and interactive workflows pass.
- **Controlled Institutional Pilot:** **READY WITH PROCEDURES.** Suitable for internal deployment with 5-20 support agents with pre-seeded roles.
- **Full Public Enterprise Production:** **REQUIRES REMAINING HARDENING.** Specifically:
  - Migrate single-node PostgreSQL container to high-availability managed database (e.g. AWS RDS or Google Cloud SQL with pgvector).
  - Deploy TLS certificate termination and WAF.
  - Implement an asynchronous task queue (e.g. Celery / BullMQ + Redis) for large batch complaint ingestion.
