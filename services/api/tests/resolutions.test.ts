import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { nlpClient } from "../src/clients/nlp.client.js";

describe("Resolutions & Knowledge Base API Endpoints", () => {
  let sampleResolutionId: string;
  let adminToken: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@complaint-intel.org", password: "Admin#Intel2026!" });
    adminToken = loginRes.body.data.token;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/v1/resolutions should return paginated list of historical resolutions", async () => {
    const response = await request(app).get(
      "/api/v1/resolutions?page=1&limit=5",
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    expect(response.body.meta.pagination).toBeDefined();
    expect(response.body.meta.pagination.page).toBe(1);

    sampleResolutionId = response.body.data[0].id;
    expect(response.body.data[0].referenceCode).toBeDefined();
    expect(response.body.data[0].title).toBeDefined();
    expect(response.body.data[0].resolutionOutcome).toBeDefined();
  });

  it("GET /api/v1/resolutions with category filter should filter by category", async () => {
    const response = await request(app).get(
      "/api/v1/resolutions?category=credit_card&limit=10",
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    for (const item of response.body.data) {
      expect(item.category).toBe("credit_card");
    }
  });

  it("GET /api/v1/resolutions/:id should return single resolution details", async () => {
    const response = await request(app).get(
      `/api/v1/resolutions/${sampleResolutionId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(sampleResolutionId);
    expect(response.body.data.complaintText).toBeDefined();
    expect(response.body.data.resolutionText).toBeDefined();
  });

  it("GET /api/v1/resolutions/:id with non-existent UUID should return 404", async () => {
    const randomUuid = "00000000-0000-0000-0000-000000000000";
    const response = await request(app).get(
      `/api/v1/resolutions/${randomUuid}`,
    );

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("RESOLUTION_NOT_FOUND");
  });

  it("POST /api/v1/resolutions/search should proxy semantic search", async () => {
    vi.spyOn(nlpClient, "searchResolutions").mockResolvedValueOnce({
      success: true,
      data: {
        query: "Unrecognized international charge on card",
        query_preview: "Unrecognized international charge on card...",
        similarity_threshold: 0.4,
        top_k: 2,
        category_filter: "credit_card",
        department_filter: null,
        matched_count: 1,
        is_empty: false,
        empty_reason: null,
        results: [
          {
            id: sampleResolutionId,
            referenceCode: "KB-CARD-001",
            title: "Unauthorized Fraudulent Foreign Charge Dispute",
            complaint_text: "Customer noticed foreign transactions...",
            resolution_text: "Card blocked, provisional credit issued...",
            resolution_outcome: "PROVISIONAL_CREDIT_ISSUED",
            category: "credit_card",
            department_code: "DEPT_CARDS",
            similarity_score: 0.825,
            is_verified: true,
            verification_status: "VERIFIED",
            data_source: "CFPB_REG_Z_PLAYBOOKS",
            provenance: {},
            metadata: {},
          },
        ],
      },
    });

    const response = await request(app)
      .post("/api/v1/resolutions/search")
      .send({
        query: "Unrecognized international charge on card",
        category_filter: "credit_card",
        top_k: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.results.length).toBe(1);
    expect(response.body.data.results[0].referenceCode).toBe("KB-CARD-001");
    expect(response.body.data.results[0].similarity_score).toBe(0.825);
  });

  it("POST /api/v1/resolutions should create a new resolution playbook", async () => {
    const payload = {
      title: "ATM Hardware Dispense Failure Refund Procedure",
      category: "retail_banking",
      departmentCode: "DEPT_BANKING",
      complaintText:
        "Customer attempted ATM withdrawal of $200, account was debited but no cash was dispensed.",
      resolutionText:
        "ATM electronic journal inspected, cash discrepancy confirmed, immediate provisional credit posted under Reg E.",
      resolutionOutcome: "PROVISIONAL_CREDIT_ISSUED",
      actionSteps: [
        "Pull ATM electronic transaction log and cash-out telemetry",
        "Verify terminal cash cassette balance discrepancy",
        "Credit cardholder checking account under Regulation E 12 CFR 1005.11",
      ],
      isVerified: true,
      verificationStatus: "VERIFIED",
      dataSource: "CFPB_REG_E_DISPUTES",
    };

    const response = await request(app)
      .post("/api/v1/resolutions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.title).toBe(payload.title);
    expect(response.body.data.category).toBe(payload.category);
  });
});
