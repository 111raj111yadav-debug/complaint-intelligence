import { Router } from "express";
import { analyticsController } from "./analytics.controller.js";
import { validateRequest } from "../../middleware/validate.js";
import { getAnalyticsQuerySchema } from "./analytics.schema.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";

export const analyticsRouter = Router();

// GET /api/v1/analytics/overview - Fetch real aggregated operational, volume, and AI performance metrics
analyticsRouter.get(
  "/overview",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.AUDITOR),
  validateRequest(getAnalyticsQuerySchema),
  (req, res, next) => {
    analyticsController.getOverview(req, res).catch(next);
  },
);

// GET /api/v1/analytics/operational - Operational metrics alias
analyticsRouter.get(
  "/operational",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.AUDITOR),
  validateRequest(getAnalyticsQuerySchema),
  (req, res, next) => {
    analyticsController.getOverview(req, res).catch(next);
  },
);

// GET /api/v1/analytics - Root alias to overview
analyticsRouter.get(
  "/",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.AUDITOR),
  validateRequest(getAnalyticsQuerySchema),
  (req, res, next) => {
    analyticsController.getOverview(req, res).catch(next);
  },
);
