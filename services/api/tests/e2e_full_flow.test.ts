import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { nlpClient } from "../src/clients/nlp.client.js";

describe("Phase 3: End-to-End Complaint-to-Recommendation-to-Feedback Lifecycle", () => {
  let adminToken: string;
  let supervisorToken: string;
  let agentToken: string;
  let auditorToken: string;
  let complaintId: string;
  let departmentId: string;
  let resolutionId: string;
  let recommendationId: string;

  beforeAll(async () => {
    // Authenticate all test roles
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@complaint-intel.org", password: "Admin#Intel2026!" });
    adminToken = adminLogin.body.data.token;

    const supLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "supervisor@complaint-intel.org", password: "Supervisor#Intel2026!" });
    supervisorToken = supLogin.body.data.token;

    const agentLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "agent.cards@complaint-intel.org", password: "Agent#Intel2026!" });
    agentToken = agentLogin.body.data.token;

    const auditorLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "auditor@complaint-intel.org", password: "Auditor#Intel2026!" });
    auditorToken = auditorLogin.body.data.token;

    // Fetch verified resolution and cards department
    const res = await prisma.resolution.findFirst({
      where: { isVerified: true, category: "credit_card" },
    });
    expect(res).not.toBeNull();
    resolutionId = res!.id;

    const dept = await prisma.department.findUnique({
      where: { code: "DEPT_CARDS" },
    });
    expect(dept).not.toBeNull();
    departmentId = dept!.id;
  });

  it("Step 1: User submits a complaint and verifies reference generation", async () => {
    const res = await request(app)
      .post("/api/v1/complaints")
      .send({
        text: "I was billed twice on my credit card statement for an unauthorized international merchant charge of $150.00.",
        source: "PORTAL",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.referenceNumber).toMatch(/^CMP-\d{8}-[A-Z0-9]{4}$/);

    complaintId = res.body.data.id;
  });

  it("Step 2: NLP analysis completes and persists multi-signal classifications", async () => {
    vi.spyOn(nlpClient, "analyzeText").mockResolvedValueOnce({
      success: true,
      data: {
        text_preview: "I was billed twice on my credit card statement...",
        char_count: 98,
        word_count: 17,
        category: {
          label: "credit_card",
          confidence: 0.94,
          probabilities: { credit_card: 0.94, retail_banking: 0.06 },
          model_version: "1.0.0-tfidf-logreg",
        },
        sentiment: {
          label: "negative",
          score: 0.85,
          compound: -0.72,
          scores: { positive: 0.0, neutral: 0.15, negative: 0.85 },
          model_identifier: "nltk/vader_lexicon-3.3.0",
        },
        emotion: {
          primary: "anger",
          confidence: 0.78,
          scores: { anger: 0.78, sadness: 0.12, fear: 0.1 },
          secondary: [],
          model_identifier: "lexicon/plutchik-complaint-v1.0",
        },
        urgency: {
          level: "HIGH",
          score: 60,
          contributing_reasons: [
            {
              rule_id: "FINANCIAL_LOSS_DUPLICATE_CHARGE",
              rule_name: "Direct Financial Loss or Double Charge",
              weight: 35,
              matched_term: "charged twice",
              description: "Duplicate billing or erroneous fee.",
            },
          ],
          human_review_required: false,
        },
        recommended_department: {
          code: "DEPT_CARDS",
          name: "Credit Cards & Prepaid Services",
          confidence: 0.94,
        },
        model_versions: {
          classification: "1.0.0-tfidf-logreg",
          sentiment: "nltk/vader_lexicon-3.3.0",
        },
        latency_ms: 32.5,
      },
    });

    const res = await request(app)
      .post(`/api/v1/complaints/${complaintId}/analyze`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.predictedCategory).toBe("credit_card");
    expect(res.body.data.urgencyLevel).toBe("HIGH");

    // Complaint status transitions to ANALYZED, SLA deadline calculated
    const cmp = await request(app).get(`/api/v1/complaints/${complaintId}`);
    expect(cmp.body.data.status).toBe("ANALYZED");
    expect(cmp.body.data.slaDeadline).toBeDefined();
  });

  it("Step 3: Complaint is assigned to department and agent with recorded SLA and audit trail", async () => {
    const res = await request(app)
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        complaintId,
        departmentId,
        notes: "Assigned to Cards dispute team for investigation",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isCurrent).toBe(true);

    const cmp = await request(app).get(`/api/v1/complaints/${complaintId}`);
    expect(cmp.body.data.firstAssignedAt).toBeDefined();

    // Verify audit log exists
    expect(cmp.body.data.auditLogs.some((l: { action: string }) => l.action === "INITIAL_ASSIGNMENT")).toBe(true);
  });

  it("Step 4 & 5: Semantic retrieval produces grounded recommendation with valid sources", async () => {
    vi.spyOn(nlpClient, "generateRecommendation").mockResolvedValueOnce({
      success: true,
      data: {
        suggested_steps: [
          "Issue provisional credit for $150.00 within 2 business days under Regulation Z",
          "Block card account and issue replacement card with new PAN",
          "Transmit chargeback dispute to acquiring bank under Reason Code 4834",
        ],
        rationale: "Matched verified Regulation Z dispute playbook KB-CARDS-001 with 0.84 similarity.",
        supporting_sources: [
          {
            source_id: resolutionId,
            reference_code: "KB-CARDS-001",
            title: "Unauthorized Credit Card Charge Resolution Playbook",
            category: "credit_card",
            similarity_score: 0.84,
            resolution_outcome: "PROVISIONAL_CREDIT_AND_CHARGEBACK",
          },
        ],
        evidence_strength: "HIGH",
        confidence_score: 0.91,
        evidence_limitations: [],
        human_review_required: false,
        review_reasons: [],
        model_provider: "extractive_evidence_grounded",
        model_identifier: "rule-based-extractive-v1",
        prompt_version: "2.0.0-rag-resolution",
        retrieval_matched_count: 1,
        total_latency_ms: 38.4,
      },
    });

    const res = await request(app)
      .post(`/api/v1/complaints/${complaintId}/recommendation`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.evidenceStrength).toBe("HIGH");
    expect(res.body.data.sources.length).toBe(1);
    expect(res.body.data.sources[0].resolutionId).toBe(resolutionId);

    recommendationId = res.body.data.id;
  });

  it("Step 6 & 7: Authorized reviewer records structured 3-way feedback with rubric scores", async () => {
    const res = await request(app)
      .post(`/api/v1/complaints/${complaintId}/recommendation/feedback`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        wasAccepted: true,
        feedbackDecision: "ACCEPTED_AS_IS",
        agentRating: 5,
        rubricScores: {
          relevanceScore: 5,
          evidenceSupportScore: 5,
          factualCorrectnessScore: 5,
          actionabilityScore: 5,
          policyComplianceScore: 5,
          escalationAppropriate: true,
        },
        feedbackNotes: "Playbook was accurately cited with correct Reg Z timeframes.",
        submittedBy: "agent.cards@complaint-intel.org",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.feedbackDecision).toBe("ACCEPTED_AS_IS");
    expect(res.body.data.rubricScores.relevanceScore).toBe(5);

    // Verify recommendation status transitioned to ACCEPTED
    const recRes = await request(app).get(`/api/v1/complaints/${complaintId}/recommendation`);
    expect(recRes.body.data.status).toBe("ACCEPTED");
  });

  it("Step 8: Human-authorized workflow transitions complaint to RESOLVED", async () => {
    // 1. In Review
    await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "IN_REVIEW", notes: "Executing provisional credit" });

    // 2. Resolved
    const res = await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "RESOLVED", notes: "Provisional credit issued, dispute submitted." });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("RESOLVED");
    expect(res.body.data.resolvedAt).toBeDefined();
  });

  it("Step 9: Operational analytics reflect the persisted lifecycle events", async () => {
    const res = await request(app)
      .get("/api/v1/analytics/overview")
      .set("Authorization", `Bearer ${supervisorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.summary.totalComplaints.value).toBeGreaterThanOrEqual(1);
    expect(data.summary.resolvedComplaints.value).toBeGreaterThanOrEqual(1);
    expect(data.aiPerformance.feedbackAcceptanceRate.value).toBeGreaterThanOrEqual(0);
    expect(data.aiPerformance.rubricAverages.relevance).toBeDefined();
  });

  it("Step 10: Unauthorized access and invalid operations are strictly rejected", async () => {
    // 1. Auditor cannot change status
    const auditorRes = await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({ status: "IN_REVIEW" });
    expect(auditorRes.status).toBe(403);

    // 2. Reopening resolved complaint without reason is rejected
    const noReasonRes = await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({ status: "IN_REVIEW" });
    expect(noReasonRes.status).toBe(400);
    expect(noReasonRes.body.error.code).toBe("REOPEN_REASON_REQUIRED");

    // 3. Unauthenticated access to user administration is rejected
    const unauthUsers = await request(app).get("/api/v1/auth/users");
    expect(unauthUsers.status).toBe(401);
  });
});
