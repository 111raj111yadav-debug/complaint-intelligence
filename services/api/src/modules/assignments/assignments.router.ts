import { Router } from "express";
import { assignmentsController } from "./assignments.controller.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  getAssignmentsQuerySchema,
  createAssignmentSchema,
} from "./assignments.schema.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";

export const assignmentsRouter = Router();

// GET /api/v1/assignments - List assignments (Authenticated internal staff)
assignmentsRouter.get(
  "/",
  authenticate,
  validateRequest(getAssignmentsQuerySchema),
  (req, res, next) => {
    assignmentsController.listAssignments(req, res).catch(next);
  },
);

// POST /api/v1/assignments - Create or reassign assignment (Restricted to ADMIN and MANAGER)
assignmentsRouter.post(
  "/",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER),
  validateRequest(createAssignmentSchema),
  (req, res, next) => {
    assignmentsController.createAssignment(req, res).catch(next);
  },
);
