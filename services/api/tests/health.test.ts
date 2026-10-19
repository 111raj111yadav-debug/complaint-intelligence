import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Health and Readiness Endpoints", () => {
  it("GET /api/v1/health should return 200 and liveness data", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.service).toBe("complaint-intelligence-api");
    expect(response.body.data.uptimeSeconds).toBeDefined();
  });

  it("GET /api/v1/health/ready should verify database readiness", async () => {
    const response = await request(app).get("/api/v1/health/ready");

    // With our active PostgreSQL database container, it should return 200
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ready");
    expect(response.body.data.dependencies.database.healthy).toBe(true);
    expect(response.body.data.dependencies.database.latencyMs).toBeTypeOf(
      "number",
    );
  });

  it("GET /api/v1/non-existent-route should return 404 with structured error", async () => {
    const response = await request(app).get("/api/v1/non-existent-route");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(response.body.error.message).toContain("Route not defined");
  });

  it("POST /api/v1/health/nlp-ping should reject invalid payloads with 422", async () => {
    const response = await request(app)
      .post("/api/v1/health/nlp-ping")
      .send({ message: "" }); // Invalid: empty string

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
