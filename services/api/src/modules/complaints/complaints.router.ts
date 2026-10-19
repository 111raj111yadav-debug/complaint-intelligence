import { Router } from "express";
import { complaintsController } from "./complaints.controller.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createComplaintSchema,
  getComplaintsQuerySchema,
  complaintParamsSchema,
  updateComplaintSchema,
} from "./complaints.schema.js";
import { recommendationsController } from "../recommendations/recommendations.controller.js";
import {
  generateRecommendationSchema,
  getRecommendationParamsSchema,
  recommendationFeedbackSchema,
} from "../recommendations/recommendations.schema.js";
import { authenticate, optionalAuth, requireRoles } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";

export const complaintsRouter = Router();

// GET /api/v1/complaints - Paginated list with filtering and search
complaintsRouter.get(
  "/",
  optionalAuth,
  validateRequest(getComplaintsQuerySchema),
  (req, res, next) => {
    complaintsController.listComplaints(req, res).catch(next);
  },
);

// POST /api/v1/complaints - Submit and persist customer complaint (public or authenticated)
complaintsRouter.post(
  "/",
  optionalAuth,
  validateRequest(createComplaintSchema),
  (req, res, next) => {
    complaintsController.createComplaint(req, res).catch(next);
  },
);

// GET /api/v1/complaints/:id - Detail view with full analysis, assignment, and audit history
complaintsRouter.get(
  "/:id",
  optionalAuth,
  validateRequest(complaintParamsSchema),
  (req, res, next) => {
    complaintsController.getComplaintById(req, res).catch(next);
  },
);

// PATCH /api/v1/complaints/:id - Update permitted mutable fields (Restricted to ADMIN, MANAGER, AGENT)
complaintsRouter.patch(
  "/:id",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT),
  validateRequest(updateComplaintSchema),
  (req, res, next) => {
    complaintsController.updateComplaint(req, res).catch(next);
  },
);

// POST /api/v1/complaints/:id/analyze - Trigger real NLP analysis pipeline and compute SLA (Restricted to ADMIN, MANAGER, AGENT)
complaintsRouter.post(
  "/:id/analyze",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT),
  validateRequest(complaintParamsSchema),
  (req, res, next) => {
    complaintsController.analyzeComplaint(req, res).catch(next);
  },
);

// GET /api/v1/complaints/:id/analysis - Fetch latest analysis result
complaintsRouter.get(
  "/:id/analysis",
  optionalAuth,
  validateRequest(complaintParamsSchema),
  (req, res, next) => {
    complaintsController.getLatestAnalysis(req, res).catch(next);
  },
);

// POST /api/v1/complaints/:id/recommendation - Generate grounded RAG resolution recommendation (Restricted to ADMIN, MANAGER, AGENT)
complaintsRouter.post(
  "/:id/recommendation",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT),
  validateRequest(generateRecommendationSchema),
  (req, res, next) => {
    recommendationsController.generateRecommendation(req, res).catch(next);
  },
);

// GET /api/v1/complaints/:id/recommendation - Fetch latest resolution recommendation
complaintsRouter.get(
  "/:id/recommendation",
  optionalAuth,
  validateRequest(getRecommendationParamsSchema),
  (req, res, next) => {
    recommendationsController.getLatestRecommendation(req, res).catch(next);
  },
);

// POST /api/v1/complaints/:id/recommendation/feedback - Record agent feedback on recommendation (Restricted to ADMIN, MANAGER, AGENT)
complaintsRouter.post(
  "/:id/recommendation/feedback",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT),
  validateRequest(recommendationFeedbackSchema),
  (req, res, next) => {
    recommendationsController.recordFeedback(req, res).catch(next);
  },
);
