import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { nlpClient } from "../src/clients/nlp.client.js";

describe("Complaints & Intelligence API Endpoints", () => {
  let createdComplaintId: string;
  let referenceNumber: string;
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

  it("POST /api/v1/complaints should create a complaint and return 201", async () => {
    const payload = {
      text: "I was charged twice for my credit card payment and nobody responded to my inquiry.",
      source: "WEB",
    };

    const response = await request(app)
      .post("/api/v1/complaints")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.referenceNumber).toMatch(
      /^CMP-\d{8}-[A-Z0-9]{4}$/,
    );
    expect(response.body.data.status).toBe("PENDING");
    expect(response.body.data.originalText).toBe(payload.text);

    createdComplaintId = response.body.data.id;
    referenceNumber = response.body.data.referenceNumber;
  });

  it("POST /api/v1/complaints should reject text shorter than 10 chars with 422", async () => {
    const response = await request(app).post("/api/v1/complaints").send({
      text: "Too short",
    });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/complaints should return paginated list of complaints", async () => {
    const response = await request(app).get(
      "/api/v1/complaints?page=1&limit=5",
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    expect(response.body.meta.pagination).toBeDefined();
    expect(response.body.meta.pagination.page).toBe(1);
    expect(response.body.meta.pagination.limit).toBe(5);
  });

  it("GET /api/v1/complaints/:id should return complaint details", async () => {
    const response = await request(app).get(
      `/api/v1/complaints/${createdComplaintId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdComplaintId);
    expect(response.body.data.referenceNumber).toBe(referenceNumber);
    expect(Array.isArray(response.body.data.analyses)).toBe(true);
  });

  it("GET /api/v1/complaints/:id should return 404 for non-existent UUID", async () => {
    const randomUuid = "00000000-0000-0000-0000-000000000000";
    const response = await request(app).get(`/api/v1/complaints/${randomUuid}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("COMPLAINT_NOT_FOUND");
  });

  it("GET /api/v1/complaints/:id/analysis should return 404 when not yet analyzed", async () => {
    const response = await request(app).get(
      `/api/v1/complaints/${createdComplaintId}/analysis`,
    );

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("ANALYSIS_NOT_FOUND");
  });

  it("POST /api/v1/complaints/:id/analyze should execute NLP analysis and persist result", async () => {
    // Mock NLP client to ensure deterministic testing without requiring background service
    vi.spyOn(nlpClient, "analyzeText").mockResolvedValueOnce({
      success: true,
      data: {
        text_preview: "I was charged twice for my credit card payment...",
        char_count: 83,
        word_count: 14,
        category: {
          label: "credit_card",
          confidence: 0.88,
          probabilities: { credit_card: 0.88, retail_banking: 0.12 },
          model_version: "1.0.0-tfidf-logreg",
        },
        sentiment: {
          label: "negative",
          score: 0.75,
          compound: -0.65,
          scores: { positive: 0.0, neutral: 0.25, negative: 0.75 },
          model_identifier: "nltk/vader_lexicon-3.3.0",
        },
        emotion: {
          primary: "anger",
          confidence: 0.65,
          scores: { anger: 0.65, sadness: 0.2, fear: 0.15 },
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
          name: "Card Services & Billing",
          rationale:
            "Category 'credit_card' mapped to Card Services & Billing.",
        },
        model_versions: {
          classification: "1.0.0-tfidf-logreg",
          sentiment: "nltk/vader_lexicon-3.3.0",
        },
        analysis_timestamp: new Date().toISOString(),
        status: "success",
      },
    });

    const response = await request(app)
      .post(`/api/v1/complaints/${createdComplaintId}/analyze`)
      .set("Authorization", `Bearer ${agentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.predictedCategory).toBe("credit_card");
    expect(response.body.data.urgencyLevel).toBe("HIGH");
    expect(response.body.data.departmentCode).toBe("DEPT_CARDS");
    expect(response.body.data.recommendedDepartment?.name).toBe(
      "Card Services & Billing",
    );

    // Verify complaint status updated in DB
    const updatedComplaint = await prisma.complaint.findUnique({
      where: { id: createdComplaintId },
    });
    expect(updatedComplaint?.status).toBe("ANALYZED");
  });

  it("GET /api/v1/complaints/:id/analysis should now return persisted analysis", async () => {
    const response = await request(app).get(
      `/api/v1/complaints/${createdComplaintId}/analysis`,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.predictedCategory).toBe("credit_card");
    expect(response.body.data.urgencyLevel).toBe("HIGH");
  });

  it("PATCH /api/v1/complaints/:id should update complaint status", async () => {
    const response = await request(app)
      .patch(`/api/v1/complaints/${createdComplaintId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "RESOLVED" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("RESOLVED");
  });

  it("POST /api/v1/complaints/:id/analyze should handle downstream NLP service error gracefully", async () => {
    vi.spyOn(nlpClient, "analyzeText").mockResolvedValueOnce({
      success: false,
      code: "NLP_SERVICE_UNAVAILABLE",
      error: "NLP microservice is currently unreachable.",
      statusCode: 502,
    });

    const response = await request(app)
      .post(`/api/v1/complaints/${createdComplaintId}/analyze`)
      .set("Authorization", `Bearer ${agentToken}`);

    expect(response.status).toBe(502);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NLP_SERVICE_UNAVAILABLE");
    expect(response.body.error.message).toContain("unreachable");
  });
});
