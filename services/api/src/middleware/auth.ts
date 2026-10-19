import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { verifyToken, AuthUserPayload } from "../lib/jwt.js";
import { AppError } from "./error.js";
import { prisma } from "../lib/prisma.js";

// Extend Express Request declaration to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      correlationId?: string;
    }
  }
}

/**
 * Middleware that requires a valid JWT Bearer token in the Authorization header
 * and verifies against PostgreSQL that the user exists and remains active in real time.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new AppError(
        "Authentication required. Please provide a valid Bearer token in Authorization header.",
        401,
        "UNAUTHENTICATED",
      ),
    );
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = verifyToken(token);

    // Real-time account verification: prevents deactivated or revoked accounts from retaining access
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, fullName: true, departmentId: true, isActive: true },
    });

    if (!user) {
      return next(
        new AppError(
          "Authenticated user account no longer exists.",
          401,
          "UNAUTHENTICATED",
        ),
      );
    }

    if (!user.isActive) {
      return next(
        new AppError(
          "Account is deactivated. Access revoked.",
          403,
          "ACCOUNT_DEACTIVATED",
        ),
      );
    }

    // Synchronize role and profile from database in case role changed since token issuance
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      departmentId: user.departmentId,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Middleware that extracts user info if present, but does not block unauthenticated requests.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, fullName: true, departmentId: true, isActive: true },
    });
    if (user && user.isActive) {
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        departmentId: user.departmentId,
      };
    }
  } catch {
    // Silently ignore invalid token in optional auth
  }
  return next();
}

/**
 * Middleware that enforces role-based access control (RBAC).
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new AppError(
          "Authentication required for role verification.",
          401,
          "UNAUTHENTICATED",
        ),
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access forbidden. Role '${req.user.role}' is not authorized for this resource.`,
          403,
          "FORBIDDEN_ROLE",
          {
            userRole: req.user.role,
            requiredRoles: allowedRoles,
          },
        ),
      );
    }

    return next();
  };
}
