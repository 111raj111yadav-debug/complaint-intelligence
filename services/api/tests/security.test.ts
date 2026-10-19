import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Phase 3: Security, Privacy & Robustness Testing", () => {
  it("should block unauthenticated access to user administration endpoints with 401", async () => {
    const res = await request(app).get("/api/v1/auth/users");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("should block unauthenticated access to operational analytics endpoints with 401", async () => {
    const res = await request(app).get("/api/v1/analytics/overview");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("should enforce least-privilege role-based access control with 403", async () => {
    // Authenticate as support AGENT
    const agentLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "agent.cards@complaint-intel.org", password: "Agent#Intel2026!" });
    const agentToken = agentLogin.body.data.token;

    // Attempt to register a new user (restricted to ADMIN)
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        email: "malicious.agent@intel.org",
        password: "Pass#12345678",
        fullName: "Unauthorized Actor",
        role: "ADMIN",
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_REGISTRATION");
  });

  it("should resist SQL injection attempts on complaints search and filters", async () => {
    const maliciousSearch = "'; DROP TABLE complaints; --";
    const res = await request(app).get(
      `/api/v1/complaints?search=${encodeURIComponent(maliciousSearch)}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Verify complaints table is completely intact
    const verifyRes = await request(app).get("/api/v1/complaints?limit=1");
    expect(verifyRes.status).toBe(200);
  });

  it("should safely reject payloads exceeding body limit with 413 Payload Too Large", async () => {
    // Generate large body > 1MB
    const largeText = "A".repeat(1.2 * 1024 * 1024);
    const res = await request(app)
      .post("/api/v1/complaints")
      .send({ text: largeText });

    expect(res.status).toBe(413);
  });

  it("should include rate limit headers on incoming requests", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.headers["ratelimit-limit"]).toBeDefined();
    expect(res.headers["ratelimit-remaining"]).toBeDefined();
  });

  it("should never expose password hashes or sensitive auth secrets in user responses", async () => {
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@complaint-intel.org", password: "Admin#Intel2026!" });
    const token = adminLogin.body.data.token;

    const usersRes = await request(app)
      .get("/api/v1/auth/users")
      .set("Authorization", `Bearer ${token}`);

    expect(usersRes.status).toBe(200);
    const users = usersRes.body.data;
    for (const u of users) {
      expect(u.passwordHash).toBeUndefined();
      expect(u.password).toBeUndefined();
    }
  });

  it("should emit correlation ID in response headers for request traceability", async () => {
    const customCorrelationId = "test-corr-id-98765-xyz";
    const res = await request(app)
      .get("/api/v1/health")
      .set("X-Correlation-ID", customCorrelationId);

    expect(res.status).toBe(200);
    expect(res.headers["x-correlation-id"]).toBe(customCorrelationId);
  });

  it("should reject unauthenticated requests to protected mutation endpoints with 401", async () => {
    // 1. PATCH /complaints/:id without token
    const patchRes = await request(app)
      .patch("/api/v1/complaints/00000000-0000-0000-0000-000000000000")
      .send({ status: "IN_REVIEW" });
    expect(patchRes.status).toBe(401);
    expect(patchRes.body.error.code).toBe("UNAUTHENTICATED");

    // 2. POST /assignments without token
    const assignRes = await request(app)
      .post("/api/v1/assignments")
      .send({
        complaintId: "00000000-0000-0000-0000-000000000000",
        departmentId: "00000000-0000-0000-0000-000000000000",
      });
    expect(assignRes.status).toBe(401);
    expect(assignRes.body.error.code).toBe("UNAUTHENTICATED");

    // 3. POST /resolutions without token
    const resRes = await request(app)
      .post("/api/v1/resolutions")
      .send({
        title: "Unauthorized Playbook Attempt",
        category: "credit_card",
        departmentCode: "DEPT_CARDS",
        complaintText: "Test",
        resolutionText: "Test",
        resolutionOutcome: "PROVISIONAL_CREDIT_ISSUED",
        actionSteps: ["Step 1"],
      });
    expect(resRes.status).toBe(401);
    expect(resRes.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("should forbid AUDITOR role from creating assignments, playbooks, or feedback with 403", async () => {
    const auditorLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "auditor@complaint-intel.org", password: "Auditor#Intel2026!" });
    const auditorToken = auditorLogin.body.data.token;

    // 1. Attempt assignment creation
    const assignRes = await request(app)
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({
        complaintId: "00000000-0000-0000-0000-000000000000",
        departmentId: "00000000-0000-0000-0000-000000000000",
      });
    expect(assignRes.status).toBe(403);
    expect(assignRes.body.error.code).toBe("FORBIDDEN_ROLE");

    // 2. Attempt resolution playbook creation
    const playbookRes = await request(app)
      .post("/api/v1/resolutions")
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({
        title: "Auditor Playbook Attempt",
        category: "credit_card",
        departmentCode: "DEPT_CARDS",
        complaintText: "Test",
        resolutionText: "Test",
        resolutionOutcome: "PROVISIONAL_CREDIT_ISSUED",
        actionSteps: ["Step 1"],
      });
    expect(playbookRes.status).toBe(403);
    expect(playbookRes.body.error.code).toBe("FORBIDDEN_ROLE");

    // 3. Attempt recommendation feedback submission
    const feedbackRes = await request(app)
      .post("/api/v1/complaints/00000000-0000-0000-0000-000000000000/recommendation/feedback")
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({
        wasAccepted: true,
        agentRating: 5,
      });
    expect(feedbackRes.status).toBe(403);
    expect(feedbackRes.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("should reject malformed or expired JWT tokens with 401 UNAUTHENTICATED", async () => {
    // Malformed token
    const malformedRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid.jwt.string.token");
    expect(malformedRes.status).toBe(401);
    expect(malformedRes.body.error.code).toBe("INVALID_TOKEN");

    // Non-bearer authorization scheme
    const basicRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    expect(basicRes.status).toBe(401);
    expect(basicRes.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("should enforce real-time deactivation: reject requests immediately once user is deactivated", async () => {
    const { prisma } = await import("../src/lib/prisma.js");
    const { generateToken } = await import("../src/lib/jwt.js");

    // Create a temporary user
    const tempUser = await prisma.user.create({
      data: {
        email: "temp.deactivate.test@complaint-intel.org",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        fullName: "Temporary User",
        role: "AGENT",
        isActive: true,
      },
    });

    const token = generateToken({
      userId: tempUser.id,
      email: tempUser.email,
      role: tempUser.role,
      fullName: tempUser.fullName,
    });

    // 1. Verify token works while active
    const activeRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(activeRes.status).toBe(200);

    // 2. Deactivate the user in database
    await prisma.user.update({
      where: { id: tempUser.id },
      data: { isActive: false },
    });

    // 3. Verify token is immediately rejected with 403 ACCOUNT_DEACTIVATED
    const deactivatedRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(deactivatedRes.status).toBe(403);
    expect(deactivatedRes.body.error.code).toBe("ACCOUNT_DEACTIVATED");

    // Clean up temporary user
    await prisma.user.delete({ where: { id: tempUser.id } });
  });
});
