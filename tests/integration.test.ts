import { describe, it, expect, beforeAll } from "vitest";
import { nlpClient } from "../services/api/src/clients/nlp.client.js";

describe("Integration: Node.js API -> Python FastAPI Microservice Communication", () => {
  beforeAll(async () => {
    // Check if Python service is reachable before running integration tests
    const status = await nlpClient.checkHealth();
    if (!status.available) {
      console.warn(
        "⚠️ Python FastAPI service is not running on port 8000. Skipping live integration test.",
      );
    }
  });

  it("successfully contacts Python NLP health probe via internal client", async () => {
    const health = await nlpClient.checkHealth();
    if (!health.available) {
      console.log(
        "Skipping assertion: NLP service offline in current test run.",
      );
      return;
    }

    expect(health.available).toBe(true);
    expect(health.latencyMs).toBeDefined();
    expect(health.data?.status).toBe("ok");
    expect(health.data?.service).toBe("complaint-nlp-service");
  });

  it("successfully executes foundation ping echo through internal client", async () => {
    const health = await nlpClient.checkHealth();
    if (!health.available) {
      console.log(
        "Skipping assertion: NLP service offline in current test run.",
      );
      return;
    }

    const testMessage = "End-to-End Foundation Integration Verification";
    const result = await nlpClient.sendPing(testMessage);

    expect(result.success).toBe(true);
    expect(result.echo).toBe(testMessage);
    expect(result.notice).toContain("FOUNDATION_ONLY_ENDPOINT");
  });

  it("successfully analyzes complaint text through internal NLP client", async () => {
    const health = await nlpClient.checkHealth();
    if (!health.available) {
      console.log(
        "Skipping assertion: NLP service offline in current test run.",
      );
      return;
    }

    const complaintNarrative =
      "My credit card was charged twice for $249.99 on October 12th. Please reverse the duplicate fee immediately!";
    const result = await nlpClient.analyzeText(complaintNarrative);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.category.label).toBeDefined();
    expect(result.data?.sentiment.label).toBeDefined();
    expect(result.data?.emotion.primary).toBeDefined();
    expect(result.data?.urgency.level).toBeDefined();
    expect(result.data?.recommended_department.code).toBeDefined();
  });

  it("successfully searches resolutions via live pgvector cosine retrieval", async () => {
    const health = await nlpClient.checkHealth();
    if (!health.available) {
      console.log("Skipping assertion: NLP service offline.");
      return;
    }

    const searchRes = await nlpClient.searchResolutions({
      query:
        "Unauthorized charges and double billing dispute under Regulation Z",
      top_k: 2,
      similarity_threshold: 0.35,
    });

    expect(searchRes.success).toBe(true);
    expect(searchRes.data?.results.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.data?.results[0].similarity_score).toBeGreaterThanOrEqual(
      0.35,
    );
  });

  it("successfully generates grounded RAG recommendation via live NLP service", async () => {
    const health = await nlpClient.checkHealth();
    if (!health.available) {
      console.log("Skipping assertion: NLP service offline.");
      return;
    }

    const ragRes = await nlpClient.generateRecommendation({
      complaint_text:
        "I was charged twice on my credit card for $250. Customer service hung up on me.",
      predicted_category: "credit_card",
      urgency_level: "HIGH",
      department_code: "DEPT_CARDS",
      similarity_threshold: 0.35,
      top_k: 2,
    });

    expect(ragRes.success).toBe(true);
    expect(ragRes.data?.suggested_steps.length).toBeGreaterThanOrEqual(1);
    expect(ragRes.data?.evidence_strength).toBeDefined();
    expect(ragRes.data?.supporting_sources.length).toBeGreaterThanOrEqual(1);
  });
});
