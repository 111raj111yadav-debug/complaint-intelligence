import { z } from "zod";
import { UserRole } from "@prisma/client";

export const loginSchema = {
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Must be a valid email address")
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: "Password is required" })
      .min(6, "Password must be at least 6 characters long"),
  }),
};

export const registerUserSchema = {
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Must be a valid email address")
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    fullName: z
      .string({ required_error: "Full name is required" })
      .min(2, "Full name must be at least 2 characters")
      .max(100),
    role: z.nativeEnum(UserRole).default(UserRole.AGENT),
    departmentId: z.string().uuid("Invalid department UUID").optional(),
  }),
};

export const listUsersQuerySchema = {
  query: z.object({
    role: z.nativeEnum(UserRole).optional(),
    departmentId: z.string().uuid().optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
  }),
};

export const demoLoginSchema = {
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Must be a valid email address")
      .toLowerCase()
      .trim(),
  }),
};
