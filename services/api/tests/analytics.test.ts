import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { generateToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";
import { UserRole } from "@prisma/client";

describe("Phase 3: Operational Analytics Authorization & Aggregation", () => {
  let managerToken: string;

  beforeAll(async () => {
    // Obtain valid token for operations manager
    const manager = await prisma.user.findUnique({
      where: { email: "supervisor@complaint-intel.org" },
    });
    if (manager) {
      managerToken = generateToken({
        userId: manager.id,
        email: manager.email,
        role: manager.role,
        fullName: manager.fullName,
      });
    }
  });

  it("GET /api/v1/analytics/overview should reject unauthenticated requests with 401 UNAUTHENTICATED", async () => {
    const response = await request(app).get("/api/v1/analytics/overview");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("GET /api/v1/analytics/overview should allow all authenticated roles (ADMIN, MANAGER, AGENT, AUDITOR) with 200", async () => {
    const roles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.AGENT,
      UserRole.AUDITOR,
    ];

    for (const role of roles) {
      const user = await prisma.user.findFirst({
        where: { role, isActive: true },
      });
      expect(user).toBeDefined();

      const token = generateToken({
        userId: user!.id,
        email: user!.email,
        role: user!.role,
        fullName: user!.fullName,
      });

      const response = await request(app)
        .get("/api/v1/analytics/overview")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
    }
  });

  it("GET /api/v1/analytics/overview should reject deactivated users with 403 ACCOUNT_DEACTIVATED", async () => {
    // Create temporary deactivated user
    const tempUser = await prisma.user.create({
      data: {
        email: `deactivated.analyst.${Date.now()}@complaint-intel.org`,
        fullName: "Deactivated Analyst",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
        role: UserRole.AGENT,
        isActive: false,
      },
    });

    const token = generateToken({
      userId: tempUser.id,
      email: tempUser.email,
      role: tempUser.role,
      fullName: tempUser.fullName,
    });

    try {
      const res = await request(app)
        .get("/api/v1/analytics/overview")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");
    } finally {
      await prisma.user.delete({ where: { id: tempUser.id } });
    }
  });

  it("GET /api/v1/analytics/overview should return comprehensive database-aggregated metrics for authenticated manager", async () => {
    const response = await request(app)
      .get("/api/v1/analytics/overview")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = response.body.data;

    // 1. Volume metrics
    expect(data.summary).toBeDefined();
    expect(data.summary.totalComplaints).toBeDefined();
    expect(typeof data.summary.totalComplaints.value).toBe("number");
    expect(data.summary.totalComplaints.formula).toBeDefined();
    expect(data.summary.totalComplaints.denominator).toBeDefined();
    expect(data.summary.openComplaints).toBeDefined();
    expect(data.summary.resolvedComplaints).toBeDefined();

    // 2. Operational performance metrics
    expect(data.operationalPerformance).toBeDefined();
    expect(data.operationalPerformance.avgTimeToFirstAssignment).toBeDefined();
    expect(data.operationalPerformance.medianTimeToFirstAssignment).toBeDefined();
    expect(data.operationalPerformance.avgTimeToResolution).toBeDefined();
    expect(data.operationalPerformance.medianTimeToResolution).toBeDefined();
    expect(data.operationalPerformance.overdueComplaints).toBeDefined();
    expect(data.operationalPerformance.reassignmentRate).toBeDefined();
    expect(Array.isArray(data.operationalPerformance.backlogByDepartment)).toBe(true);

    // 3. AI Performance metrics
    expect(data.aiPerformance).toBeDefined();
    expect(Array.isArray(data.aiPerformance.categoryDistribution)).toBe(true);
    expect(Array.isArray(data.aiPerformance.urgencyDistribution)).toBe(true);
    expect(data.aiPerformance.humanReviewRate).toBeDefined();
    expect(data.aiPerformance.recommendationGenerationRate).toBeDefined();
    expect(data.aiPerformance.feedbackAcceptanceRate).toBeDefined();
    expect(data.aiPerformance.rubricAverages).toBeDefined();

    // 4. Charts payload
    expect(data.charts).toBeDefined();
    expect(Array.isArray(data.charts.volumeOverTime)).toBe(true);
    expect(Array.isArray(data.charts.volumeByDepartment)).toBe(true);
    expect(Array.isArray(data.charts.volumeByChannel)).toBe(true);
  });

  it("GET /api/v1/analytics/overview should filter accurately by date range", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await request(app)
      .get(`/api/v1/analytics/overview?startDate=${today}&endDate=${today}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.summary.totalComplaints.value).toBe("number");
  });

  it("GET /api/v1/analytics/overview should handle past empty date ranges safely without division by zero", async () => {
    const response = await request(app)
      .get("/api/v1/analytics/overview?startDate=2020-01-01&endDate=2020-01-02")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const data = response.body.data;
    expect(data.summary.totalComplaints.value).toBe(0);
    expect(data.operationalPerformance.avgTimeToResolution.value).toBeNull();
    expect(data.operationalPerformance.avgTimeToResolution.formatted).toContain("N/A");
  });
});
