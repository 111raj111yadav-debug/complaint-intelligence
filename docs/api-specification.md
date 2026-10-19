# API Specification (Phase 1, Phase 2 & Phase 3)

**Project Title:** Intelligent Customer Complaint Analysis and Automatic Resolution Recommendation
**Node.js Express API URL:** `http://localhost:5000`
**Python FastAPI NLP Service URL:** `http://localhost:8000`

---

## 1. Global Standard Response Envelopes & Headers

### 1.1 Success Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 42,
      "totalPages": 5
    }
  }
}
```

### 1.2 Error Response Envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request input failed validation schema.",
    "details": [ ... ]
  }
}
```

### 1.3 Standard HTTP Headers

- `X-Correlation-ID`: Trace identifier passed between client, Express API, and FastAPI microservice.
- `Authorization: Bearer <jwt>`: Required for protected endpoints.
- `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`: Rate-limiting metrics.

---

## 2. Authentication & Authorization Endpoints (`/api/v1/auth`)

### 2.1 `POST /api/v1/auth/login`

Authenticates a staff member and issues a stateless 24-hour JWT token.

**Request Body:**
```json
{
  "email": "agent.cards@complaint-intel.org",
  "password": "ChangeMePhase3!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "e8a2b531-...",
      "email": "agent.cards@complaint-intel.org",
      "fullName": "Card Dispute Specialist",
      "role": "AGENT"
    }
  }
}
```

### 2.2 `GET /api/v1/auth/me`

Retrieves the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "userId": "e8a2b531-...",
    "email": "agent.cards@complaint-intel.org",
    "fullName": "Card Dispute Specialist",
    "role": "AGENT"
  }
}
```

### 2.3 `GET /api/v1/auth/users`

Lists active staff members available for complaint assignments. Requires authenticated user.

### 2.4 `POST /api/v1/auth/register`

Registers a new staff user account. Restricted to `ADMIN` role.

---

## 3. Complaint Workflow & Lifecycle Endpoints (`/api/v1/complaints`)

### 3.1 `GET /api/v1/complaints`

Paginated complaint listing supporting advanced filtering:
- Query parameters: `page`, `limit`, `status`, `category`, `urgency`, `search`, `departmentId`, `assignedToUserId`, `isOverdue`, `humanReviewRequired`.

### 3.2 `POST /api/v1/complaints`

Intake complaint creation. Accessible to public intake or authenticated agents.
- Body: `{ "text": "...", "source": "WEB" }`
- Generates reference number format: `CMP-YYYYMMDD-XXXX`.
- Establishes initial `PENDING` status and emits initial audit log entry.

### 3.3 `GET /api/v1/complaints/:id`

Retrieves detailed complaint record including:
- Full text (original and sanitized)
- Analysis history
- SLA deadline, `firstAssignedAt`, `resolvedAt`, `isOverdue`
- Current assignment and department
- Complete chronological audit log trail (`auditLogs`)

### 3.4 `PATCH /api/v1/complaints/:id`

Transitions complaint workflow state. Validated by state machine:
- Allowed forward transitions: `PENDING` $\rightarrow$ `ANALYZED`, `IN_REVIEW`, `DISMISSED`; `ANALYZED` $\rightarrow$ `IN_REVIEW`, `DISMISSED`; `IN_REVIEW` $\rightarrow$ `RESOLVED`, `DISMISSED`.
- Reopening from `RESOLVED` requires mandatory `reason`.
- Rejects invalid transitions with `400 INVALID_STATUS_TRANSITION`.
- Rejects `AUDITOR` mutations with `403 FORBIDDEN_AUDITOR_MUTATION`.

### 3.5 `POST /api/v1/complaints/:id/analyze`

Triggers NLP microservice analysis:
- Predicts category, sentiment, emotion, explainable urgency.
- Calculates dynamic SLA deadline.
- Transitions status to `ANALYZED` (or `IN_REVIEW` if human review required).

---

## 4. Assignment & Routing Endpoints (`/api/v1/assignments`)

### 4.1 `POST /api/v1/assignments`

Assigns or reassigns a complaint to a department and/or specific agent. Restricted to `MANAGER` or `ADMIN`.
- Marks previous assignment as archived (`isCurrent = false`, sets `completedAt`).
- Sets `isCurrent = true` on new assignment.
- Records `firstAssignedAt` timestamp on the complaint if this is the initial assignment.
- Requires `reassignReason` when reassigning.
- Emits `INITIAL_ASSIGNMENT` or `REASSIGNMENT` event in `complaint_audit_logs`.

### 4.2 `GET /api/v1/assignments?complaintId=...`

Retrieves the complete assignment history for a complaint.

---

## 5. RAG Recommendations & 3-Way Feedback (`/api/v1/complaints/:id/recommendation`)

### 5.1 `POST /api/v1/complaints/:id/recommendation`

Generates an evidence-grounded resolution recommendation using dense vector retrieval against pgvector.
- Computes cosine similarity scores.
- Calibrates evidence strength (`HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT`).
- Flags mandatory human review for litigation, regulatory, or fraud claims.
- Links cited source playbooks in `recommendation_sources`.

### 5.2 `POST /api/v1/complaints/:id/recommendation/feedback`

Records support officer feedback on a generated recommendation.

**Request Body:**
```json
{
  "wasAccepted": true,
  "feedbackDecision": "ACCEPTED_AS_IS",
  "agentRating": 5,
  "agentModifications": null,
  "rejectionReason": null,
  "feedbackNotes": "Playbook accurately cited Regulation Z provisional credit timeline.",
  "rubricScores": {
    "relevanceScore": 5,
    "evidenceSupportScore": 5,
    "factualCorrectnessScore": 5,
    "actionabilityScore": 5,
    "policyComplianceScore": 5,
    "escalationAppropriate": true
  }
}
```

---

## 6. Real Operational Analytics (`/api/v1/analytics/overview`)

### 6.1 `GET /api/v1/analytics/overview`

Calculates database-aggregated operational metrics across specified date ranges.

**Query Parameters:**
- `startDate`: ISO date string (YYYY-MM-DD)
- `endDate`: ISO date string (YYYY-MM-DD)

**Response Structure (200 OK):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalComplaints": { "value": 15, "formula": "COUNT(*)", "denominator": "All complaints in period" },
      "openComplaints": { "value": 9, "formula": "COUNT(status != RESOLVED/DISMISSED)", "denominator": "Total complaints" },
      "resolvedComplaints": { "value": 6, "formula": "COUNT(status == RESOLVED)", "denominator": "Total complaints" }
    },
    "operationalPerformance": {
      "avgTimeToFirstAssignment": { "value": 14.2, "formatted": "14.2 hrs", "formula": "AVG(first_assigned_at - created_at)" },
      "medianTimeToFirstAssignment": { "value": 11.5, "formatted": "11.5 hrs", "formula": "MEDIAN(first_assigned_at - created_at)" },
      "avgTimeToResolution": { "value": 38.6, "formatted": "38.6 hrs", "formula": "AVG(resolved_at - created_at)" },
      "medianTimeToResolution": { "value": 32.0, "formatted": "32.0 hrs", "formula": "MEDIAN(resolved_at - created_at)" },
      "overdueComplaints": { "value": 2, "formula": "COUNT(NOW() > sla_deadline AND status != RESOLVED)" },
      "reassignmentRate": { "value": 0.133, "formatted": "13.3%", "formula": "COUNT(complaints with >1 assignment) / COUNT(assigned complaints)" },
      "backlogByDepartment": [ ... ]
    },
    "aiPerformance": {
      "categoryDistribution": [ ... ],
      "urgencyDistribution": [ ... ],
      "humanReviewRate": { "value": 0.20, "formatted": "20.0%", "formula": "COUNT(human_review_required) / COUNT(analyses)" },
      "recommendationGenerationRate": { "value": 0.85, "formatted": "85.0%", "formula": "COUNT(recommendations) / COUNT(complaints)" },
      "feedbackAcceptanceRate": { "value": 0.80, "formatted": "80.0%", "formula": "COUNT(ACCEPTED_AS_IS) / COUNT(feedback submissions)" },
      "rubricAverages": {
        "relevance": 5.0,
        "grounding": 4.8,
        "citation": 4.8,
        "actionability": 5.0,
        "safety": 5.0
      }
    },
    "charts": {
      "volumeOverTime": [ ... ],
      "volumeByDepartment": [ ... ],
      "volumeByChannel": [ ... ]
    }
  }
}
```

---

## 7. Python FastAPI NLP Service Endpoints (`:8000`)

- `GET /health` — Microservice liveness probe.
- `GET /ready` — Readiness check verifying loaded model weights.
- `POST /api/v1/analyze` — Multitask inference returning category, sentiment, emotion, urgency, and recommended department.
- `POST /api/v1/embeddings/generate` — Computes 384-d unit-normalized dense embeddings with regex PII redaction.
- `POST /api/v1/resolutions/search` — Direct pgvector cosine similarity search.
- `POST /api/v1/recommendations/generate` — RAG resolution generation with offline extractive fallback.
