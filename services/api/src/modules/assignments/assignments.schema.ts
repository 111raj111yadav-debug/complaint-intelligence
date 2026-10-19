import { z } from "zod";

export const getAssignmentsQuerySchema = {
  query: z.object({
    complaintId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    assignedToUserId: z.string().uuid().optional(),
    isCurrent: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
    status: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
};

export const createAssignmentSchema = {
  body: z.object({
    complaintId: z.string().uuid("Invalid complaint ID format"),
    departmentId: z.string().uuid("Invalid department ID format"),
    assignedToUserId: z.string().uuid("Invalid user ID format").optional(),
    assignedBy: z.string().optional().default("SUPPORT_SUPERVISOR"),
    assignedTo: z.string().optional(),
    notes: z.string().optional(),
    reassignReason: z.string().optional(),
    status: z.string().optional().default("ASSIGNED"),
  }),
};
