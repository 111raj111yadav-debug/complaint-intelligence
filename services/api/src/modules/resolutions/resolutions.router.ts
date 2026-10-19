import { Router } from "express";
import { resolutionsController } from "./resolutions.controller.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  getResolutionsQuerySchema,
  resolutionParamsSchema,
  searchResolutionsSchema,
  createResolutionSchema,
} from "./resolutions.schema.js";

import { authenticate, requireRoles } from "../../middleware/auth.js";
import { UserRole } from "@prisma/client";

export const resolutionsRouter = Router();

// GET /api/v1/resolutions - Paginated list of historical resolutions
resolutionsRouter.get(
  "/",
  validateRequest(getResolutionsQuerySchema),
  (req, res, next) => {
    resolutionsController.listResolutions(req, res).catch(next);
  },
);

// POST /api/v1/resolutions/search - Proxy semantic vector retrieval
resolutionsRouter.post(
  "/search",
  validateRequest(searchResolutionsSchema),
  (req, res, next) => {
    resolutionsController.searchResolutions(req, res).catch(next);
  },
);

// POST /api/v1/resolutions - Add new resolution playbook (Restricted to ADMIN and MANAGER)
resolutionsRouter.post(
  "/",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER),
  validateRequest(createResolutionSchema),
  (req, res, next) => {
    resolutionsController.createResolution(req, res).catch(next);
  },
);

// GET /api/v1/resolutions/:id - Get resolution by ID
resolutionsRouter.get(
  "/:id",
  validateRequest(resolutionParamsSchema),
  (req, res, next) => {
    resolutionsController.getResolutionById(req, res).catch(next);
  },
);
