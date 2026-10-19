import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Phase 3: Workflow State Machine, Assignment History & Audit Trail", () => {
  let complaintId: string;
  let supervisorToken: string;
  let agentToken: string;
  let auditorToken: string;
  let creditDeptId: string;
  let cardsDeptId: string;

  beforeAll(async () => {
    // 1. Authenticate users
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

    // 2. Fetch departments
    const deptRes = await request(app).get("/api/v1/departments");
    const depts = deptRes.body.data;
    const credit = depts.find((d: { code: string }) => d.code === "DEPT_CREDIT");
    const cards = depts.find((d: { code: string }) => d.code === "DEPT_CARDS");
    creditDeptId = credit.id;
    cardsDeptId = cards.id;

    // 3. Create test complaint
    const cmpRes = await request(app)
      .post("/api/v1/complaints")
      .send({
        text: "I was charged twice on my credit card statement for $89.00 by a local grocery store on 1st October.",
      });
    complaintId = cmpRes.body.data.id;
  });

  it("POST /api/v1/assignments should make initial assignment and record firstAssignedAt", async () => {
    const res = await request(app)
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        complaintId,
        departmentId: cardsDeptId,
        notes: "Assigned to Card Dispute Specialist for review.",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isCurrent).toBe(true);
    expect(res.body.data.department.code).toBe("DEPT_CARDS");

    // Verify firstAssignedAt on complaint
    const cmpRes = await request(app).get(`/api/v1/complaints/${complaintId}`);
    expect(cmpRes.body.data.firstAssignedAt).toBeDefined();
  });

  it("POST /api/v1/assignments should reassign complaint with documented reason and archive previous", async () => {
    const res = await request(app)
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        complaintId,
        departmentId: creditDeptId,
        reassignReason: "Customer reported transaction is impacting bureau credit report directly.",
        notes: "Transferred to Credit Reporting Support.",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.isCurrent).toBe(true);
    expect(res.body.data.department.code).toBe("DEPT_CREDIT");
    expect(res.body.data.reassignReason).toContain("bureau credit report");

    // Verify assignment history: exactly 1 current and 1 archived
    const listRes = await request(app)
      .get(`/api/v1/assignments?complaintId=${complaintId}`)
      .set("Authorization", `Bearer ${supervisorToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(2);
    const current = listRes.body.data.find((a: { isCurrent: boolean }) => a.isCurrent);
    const archived = listRes.body.data.find((a: { isCurrent: boolean }) => !a.isCurrent);
    expect(current).toBeDefined();
    expect(archived).toBeDefined();
    expect(archived.completedAt).toBeDefined();
  });

  it("PATCH /api/v1/complaints/:id should validate allowed workflow transitions", async () => {
    // 1. Move to IN_REVIEW
    const inReviewRes = await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "IN_REVIEW", notes: "Investigation initiated by agent." });

    expect(inReviewRes.status).toBe(200);
    expect(inReviewRes.body.data.status).toBe("IN_REVIEW");

    // 2. Resolve complaint
    const resolvedRes = await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "RESOLVED", notes: "Provisional credit issued and dispute finalized." });

    expect(resolvedRes.status).toBe(200);
    expect(resolvedRes.body.data.status).toBe("RESOLVED");

    // Verify resolvedAt timestamp is populated
    const checkCmp = await request(app).get(`/api/v1/complaints/${complaintId}`);
    expect(checkCmp.body.data.resolvedAt).toBeDefined();
  });

  it("PATCH /api/v1/complaints/:id should require a reason when reopening a resolved complaint", async () => {
    const failReopen = await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({ status: "IN_REVIEW" }); // Missing reason

    expect(failReopen.status).toBe(400);
    expect(failReopen.body.error.code).toBe("REOPEN_REASON_REQUIRED");

    // Succeed with reason
    const reopenRes = await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        status: "IN_REVIEW",
        reason: "Customer presented additional documentation disputing merchant rebuttal.",
      });

    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.data.status).toBe("IN_REVIEW");
  });

  it("PATCH /api/v1/complaints/:id should reject invalid state transitions with 400", async () => {
    // Move to RESOLVED first
    await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "RESOLVED" });

    // Attempt invalid jump from RESOLVED to ANALYZED
    const invalidRes = await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({ status: "ANALYZED", reason: "Attempting illegal rollback" });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(invalidRes.body.error.details.allowedTransitions).toBeDefined();
  });

  it("PATCH /api/v1/complaints/:id should forbid read-only AUDITOR accounts from modifying status", async () => {
    const auditorRes = await request(app)
      .patch(`/api/v1/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${auditorToken}`)
      .send({ status: "IN_REVIEW", reason: "Auditor testing access" });

    expect(auditorRes.status).toBe(403);
    expect(["FORBIDDEN_ROLE", "FORBIDDEN_AUDITOR_MUTATION"]).toContain(
      auditorRes.body.error.code,
    );
  });

  it("GET /api/v1/complaints/:id should return complete chronological audit log trail", async () => {
    const detailRes = await request(app).get(`/api/v1/complaints/${complaintId}`);

    expect(detailRes.status).toBe(200);
    const auditLogs = detailRes.body.data.auditLogs;
    expect(Array.isArray(auditLogs)).toBe(true);
    expect(auditLogs.length).toBeGreaterThanOrEqual(4);

    const actions = auditLogs.map((l: { action: string }) => l.action);
    expect(actions).toContain("COMPLAINT_SUBMITTED");
    expect(actions).toContain("INITIAL_ASSIGNMENT");
    expect(actions).toContain("REASSIGNMENT");
    expect(actions).toContain("STATUS_CHANGE");
  });
});
