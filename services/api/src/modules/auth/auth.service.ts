import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { generateToken, AuthUserPayload } from "../../lib/jwt.js";
import { env } from "../../config/env.js";

export interface RegisterUserData {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
  departmentId?: string;
}

export interface ListUsersFilter {
  role?: UserRole;
  departmentId?: string;
  isActive?: boolean;
}

export class AuthService {
  /**
   * Authenticates user with email and password, returning JWT and profile.
   */
  async login(email: string, password: string): Promise<{ token: string; user: AuthUserPayload }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        department: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!user) {
      throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    if (!user.isActive) {
      throw new AppError("Account is deactivated. Please contact an administrator.", 403, "ACCOUNT_DEACTIVATED");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }

    const payload: AuthUserPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      departmentId: user.departmentId,
    };

    const token = generateToken(payload);
    return { token, user: payload };
  }

  /**
   * Development-only demonstration login for academic review and role-switching.
   * Strictly blocked in production environments.
   */
  async demoLogin(email: string): Promise<{ token: string; user: AuthUserPayload }> {
    if (env.NODE_ENV === "production") {
      throw new AppError(
        "Demonstration auto-login is disabled in production environments.",
        403,
        "DEMO_MODE_DISABLED",
      );
    }

    const ALLOWED_DEMO_EMAILS = new Set([
      "admin@complaint-intel.org",
      "supervisor@complaint-intel.org",
      "agent.cards@complaint-intel.org",
      "agent.disputes@complaint-intel.org",
      "auditor@complaint-intel.org",
    ]);

    const normalizedEmail = email.toLowerCase().trim();
    if (!ALLOWED_DEMO_EMAILS.has(normalizedEmail)) {
      throw new AppError(
        "Email address is not an authorized demonstration staff account.",
        403,
        "UNAUTHORIZED_DEMO_ACCOUNT",
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        department: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!user) {
      throw new AppError(
        "Demonstration account not found in database. Run 'npm run db:seed' to initialize.",
        404,
        "USER_NOT_FOUND",
      );
    }

    if (!user.isActive) {
      throw new AppError(
        "Account is deactivated. Please contact an administrator.",
        403,
        "ACCOUNT_DEACTIVATED",
      );
    }

    const payload: AuthUserPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      departmentId: user.departmentId,
    };

    const token = generateToken(payload);
    return { token, user: payload };
  }

  /**
   * Creates a new user in the system (requires ADMIN role or bootstrapping).
   */
  async register(data: RegisterUserData, requestingUser?: AuthUserPayload) {
    const totalUsers = await prisma.user.count();

    // If users already exist, only an ADMIN can register additional users
    if (totalUsers > 0 && (!requestingUser || requestingUser.role !== UserRole.ADMIN)) {
      throw new AppError(
        "Only system administrators are authorized to create new user accounts.",
        403,
        "FORBIDDEN_REGISTRATION",
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new AppError(`User with email '${data.email}' already exists.`, 409, "USER_EXISTS");
    }

    if (data.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: data.departmentId },
      });
      if (!dept) {
        throw new AppError(`Department with ID '${data.departmentId}' not found.`, 404, "DEPARTMENT_NOT_FOUND");
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const role = data.role || (totalUsers === 0 ? UserRole.ADMIN : UserRole.AGENT);

    const newUser = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash,
        fullName: data.fullName.trim(),
        role,
        departmentId: data.departmentId || null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        departmentId: true,
        createdAt: true,
      },
    });

    const payload: AuthUserPayload = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      fullName: newUser.fullName,
      departmentId: newUser.departmentId,
    };

    const token = generateToken(payload);
    return { token, user: payload };
  }

  /**
   * Retrieves full profile of currently authenticated user.
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError("User account not found.", 404, "USER_NOT_FOUND");
    }

    return user;
  }

  /**
   * Lists users matching role or department criteria.
   */
  async listUsers(filter: ListUsersFilter) {
    return prisma.user.findMany({
      where: {
        ...(filter.role ? { role: filter.role } : {}),
        ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
        ...(filter.isActive !== undefined ? { isActive: filter.isActive } : { isActive: true }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        departmentId: true,
        isActive: true,
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { fullName: "asc" },
    });
  }
}

export const authService = new AuthService();
