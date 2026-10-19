import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { nlpClient } from "../src/clients/nlp.client.js";
import { prisma } from "../src/lib/prisma.js";

describe("RAG Recommendations & Feedback API Endpoints", () => {
  let complaintId: string;
  let resolutionId: string;
  let agentToken: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "agent.cards@complaint-intel.org", password: "Agent#Intel2026!" });
    agentToken = loginRes.body.data.token;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Setup: Create complaint and find verified resolution", async () => {
    const complaintRes = await request(app).post("/api/v1/complaints").send({
      text: "I found an inquiry on my Equifax credit report from a debt collection agency that I never authorized.",
      source: "WEB",
    });
    expect(complaintRes.status).toBe(201);
    complaintId = complaintRes.body.data.id;

    const resRecord = await prisma.resolution.findFirst({
      where: { isVerified: true },
    });
    expect(resRecord).not.toBeNull();
    resolutionId = resRecord!.id;
  });

  it("GET /api/v1/complaints/:id/recommendation should return null or 200 before generation", async () => {
    const response = await request(app).get(
      `/api/v1/complaints/${complaintId}/recommendation`,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeNull();
  });

  it("POST /api/v1/complaints/:id/recommendation should generate and persist recommendation", async () => {
    vi.spyOn(nlpClient, "generateRecommendation").mockResolvedValueOnce({
      success: true,
      data: {
        suggested_steps: [
          "Initiate FCRA Section 611 investigation into disputed credit inquiry",
          "Request permissible purpose verification documentation from creditor",
          "Issue automated deletion notice to Equifax bureau if no valid authorization exists",
        ],
        rationale:
          "Under FCRA 15 U.S.C. 1681b, hard credit inquiries require permissible purpose or direct consumer consent. The matched playbook mandates 30-day investigation and bureau correction.",
        supporting_sources: [
          {
            source_id: resolutionId,
            reference_code: "KB-CREDIT-001",
            title: "Unauthorized Hard Credit Inquiry Removal",
            category: "credit_reporting",
            similarity_score: 0.812,
            resolution_outcome: "INQUIRY_DELETED_AND_CREDIT_RESTORED",
          },
        ],
        evidence_strength: "HIGH",
        confidence_score: 0.88,
        evidence_limitations: [],
        human_review_required: false,
        review_reasons: [],
        model_provider: "extractive_evidence_grounded",
        model_identifier: "rule-based-extractive-v1",
        prompt_version: "2.0.0-rag-resolution",
        retrieval_matched_count: 1,
        total_latency_ms: 45.2,
      },
    });

    const response = await request(app)
      .post(`/api/v1/complaints/${complaintId}/recommendation`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.evidenceStrength).toBe("HIGH");
    expect(response.body.data.confidenceScore).toBe(0.88);
    expect(Array.isArray(response.body.data.suggestedSteps)).toBe(true);
    expect(response.body.data.suggestedSteps.length).toBe(3);
    expect(response.body.data.sources.length).toBe(1);
    expect(response.body.data.sources[0].resolutionId).toBe(resolutionId);
    expect(response.body.data.sources[0].resolution).toBeDefined();
  });

  it("GET /api/v1/complaints/:id/recommendation should retrieve latest generated recommendation", async () => {
    const response = await request(app).get(
      `/api/v1/complaints/${complaintId}/recommendation`,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.evidenceStrength).toBe("HIGH");
    expect(response.body.data.sources.length).toBe(1);
  });

  it("POST /api/v1/complaints/:id/recommendation/feedback should record agent feedback", async () => {
    const feedbackPayload = {
      wasAccepted: true,
      agentRating: 5,
      feedbackNotes:
        "High quality recommendation. Followed standard FCRA dispute timeline exactly.",
      submittedBy: "SENIOR_DISPUTE_OFFICER",
    };

    const response = await request(app)
      .post(`/api/v1/complaints/${complaintId}/recommendation/feedback`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send(feedbackPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.wasAccepted).toBe(true);
    expect(response.body.data.agentRating).toBe(5);
    expect(response.body.data.submittedBy).toBe("Card Dispute Specialist (AGENT)");

    // Verify status updated in recommendation table
    const recResponse = await request(app).get(
      `/api/v1/complaints/${complaintId}/recommendation`,
    );
    expect(recResponse.body.data.status).toBe("ACCEPTED");
    expect(recResponse.body.data.feedback).toBeDefined();
    expect(recResponse.body.data.feedback.agentRating).toBe(5);
  });

  it("GET /api/v1/departments should list available departments", async () => {
    const response = await request(app).get("/api/v1/departments");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
