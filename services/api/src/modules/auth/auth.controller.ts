import { Request, Response } from "express";
import { authService } from "./auth.service.js";
import { sendSuccess } from "../../lib/response.js";
import { UserRole } from "@prisma/client";

export class AuthController {
  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return sendSuccess(res, result, 200);
  }

  async demoLogin(req: Request, res: Response) {
    const { email } = req.body;
    const result = await authService.demoLogin(email);
    return sendSuccess(res, result, 200);
  }

  async register(req: Request, res: Response) {
    const result = await authService.register(req.body, req.user);
    return sendSuccess(res, result, 201);
  }

  async getCurrentUser(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHENTICATED", message: "Not authenticated." },
      });
    }
    const profile = await authService.getProfile(req.user.userId);
    return sendSuccess(res, profile, 200);
  }

  async listUsers(req: Request, res: Response) {
    const { role, departmentId, isActive } = req.query;
    const users = await authService.listUsers({
      role: role as UserRole | undefined,
      departmentId: departmentId as string | undefined,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });
    return sendSuccess(res, users, 200);
  }
}

export const authController = new AuthController();
