import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validateRequest } from "../../middleware/validate.js";
import { loginSchema, registerUserSchema, listUsersQuerySchema, demoLoginSchema } from "./auth.schema.js";
import { authenticate, optionalAuth, requireRoles } from "../../middleware/auth.js";
import { authRateLimiter } from "../../middleware/rate-limiter.js";
import { UserRole } from "@prisma/client";

export const authRouter = Router();

// POST /api/v1/auth/login - User authentication with rate limiting
authRouter.post(
  "/login",
  authRateLimiter,
  validateRequest(loginSchema),
  (req, res, next) => {
    authController.login(req, res).catch(next);
  },
);

// POST /api/v1/auth/demo-login - Development/Viva demonstration login without embedded passwords (disabled in production)
authRouter.post(
  "/demo-login",
  authRateLimiter,
  validateRequest(demoLoginSchema),
  (req, res, next) => {
    authController.demoLogin(req, res).catch(next);
  },
);

// POST /api/v1/auth/register - Register new user (Admin only, or bootstrap first user)
authRouter.post(
  "/register",
  optionalAuth,
  validateRequest(registerUserSchema),
  (req, res, next) => {
    authController.register(req, res).catch(next);
  },
);

// GET /api/v1/auth/me - Retrieve current authenticated profile
authRouter.get(
  "/me",
  authenticate,
  (req, res, next) => {
    authController.getCurrentUser(req, res).catch(next);
  },
);

// GET /api/v1/auth/users - List internal operational users for assignment workflows
authRouter.get(
  "/users",
  authenticate,
  requireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT),
  validateRequest(listUsersQuerySchema),
  (req, res, next) => {
    authController.listUsers(req, res).catch(next);
  },
);
