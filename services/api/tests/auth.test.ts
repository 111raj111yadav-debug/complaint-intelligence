import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Phase 3: Authentication and Role-Based Access Control (RBAC)", () => {
  it("POST /api/v1/auth/login should authenticate with seeded admin credentials and return JWT", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@complaint-intel.org",
        password: "Admin#Intel2026!",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.user.email).toBe("admin@complaint-intel.org");
    expect(response.body.data.user.role).toBe("ADMIN");
  });

  it("POST /api/v1/auth/login should authenticate supervisor and agent accounts", async () => {
    const supervisorRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "supervisor@complaint-intel.org",
        password: "Supervisor#Intel2026!",
      });
    expect(supervisorRes.status).toBe(200);
    expect(supervisorRes.body.data.user.role).toBe("MANAGER");

    const agentRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "agent.cards@complaint-intel.org",
        password: "Agent#Intel2026!",
      });
    expect(agentRes.status).toBe(200);
    expect(agentRes.body.data.user.role).toBe("AGENT");
  });

  it("POST /api/v1/auth/login should reject invalid passwords with 401", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@complaint-intel.org",
        password: "WrongPassword123!",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("POST /api/v1/auth/login should reject non-existent user with 401", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "nonexistent@complaint-intel.org",
        password: "SomePassword123!",
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("GET /api/v1/auth/me should return 401 without Bearer token", async () => {
    const response = await request(app).get("/api/v1/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("GET /api/v1/auth/me should return authenticated user profile with valid token", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "supervisor@complaint-intel.org",
        password: "Supervisor#Intel2026!",
      });
    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe("supervisor@complaint-intel.org");
    expect(meRes.body.data.role).toBe("MANAGER");
    expect(meRes.body.data.fullName).toBe("Support Operations Supervisor");
  });

  it("GET /api/v1/auth/users should list active staff for assignment", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@complaint-intel.org",
        password: "Admin#Intel2026!",
      });
    const token = loginRes.body.data.token;

    const usersRes = await request(app)
      .get("/api/v1/auth/users")
      .set("Authorization", `Bearer ${token}`);

    expect(usersRes.status).toBe(200);
    expect(Array.isArray(usersRes.body.data)).toBe(true);
    expect(usersRes.body.data.length).toBeGreaterThanOrEqual(4);
  });

  it("POST /api/v1/auth/register should forbid non-admin users from creating new staff accounts", async () => {
    const agentLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "agent.cards@complaint-intel.org",
        password: "Agent#Intel2026!",
      });
    const agentToken = agentLogin.body.data.token;

    const regRes = await request(app)
      .post("/api/v1/auth/register")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        email: `new.agent.${Date.now()}@complaint-intel.org`,
        password: "Password#123",
        fullName: "Unauthorized New Agent",
        role: "AGENT",
      });

    expect(regRes.status).toBe(403);
    expect(regRes.body.error.code).toBe("FORBIDDEN_REGISTRATION");
  });

  it("POST /api/v1/auth/register should allow ADMIN to create staff accounts", async () => {
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@complaint-intel.org",
        password: "Admin#Intel2026!",
      });
    const adminToken = adminLogin.body.data.token;

    const uniqueEmail = `test.staff.${Date.now()}@complaint-intel.org`;
    const regRes = await request(app)
      .post("/api/v1/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: uniqueEmail,
        password: "Secure#StaffPass2026",
        fullName: "Test Operations Agent",
        role: "AGENT",
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.user.email).toBe(uniqueEmail);
  });

  it("POST /api/v1/auth/demo-login should authenticate authorized demonstration accounts without embedded passwords", async () => {
    const res = await request(app)
      .post("/api/v1/auth/demo-login")
      .send({ email: "supervisor@complaint-intel.org" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("supervisor@complaint-intel.org");
    expect(res.body.data.user.role).toBe("MANAGER");
  });

  it("POST /api/v1/auth/demo-login should reject unauthorized email addresses with 403", async () => {
    const res = await request(app)
      .post("/api/v1/auth/demo-login")
      .send({ email: "external.attacker@evilcorp.com" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED_DEMO_ACCOUNT");
  });
});
