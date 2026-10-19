import { z } from "zod";
import { ComplaintStatus, UrgencyLevel } from "@prisma/client";

export const createComplaintSchema = {
  body: z.object({
    text: z
      .string({ required_error: "Complaint text is required." })
      .min(10, "Complaint narrative must be at least 10 characters long.")
      .max(10000, "Complaint narrative cannot exceed 10,000 characters."),
    source: z.string().optional().default("WEB"),
  }),
};

export const getComplaintsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z.nativeEnum(ComplaintStatus).optional(),
    category: z.string().optional(),
    urgency: z.nativeEnum(UrgencyLevel).optional(),
    search: z.string().optional(),
    departmentId: z.string().uuid().optional(),
    assignedToUserId: z.string().uuid().optional(),
    isOverdue: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
    humanReviewRequired: z
      .enum(["true", "false"])
      .transform((val) => val === "true")
      .optional(),
  }),
};

export const complaintParamsSchema = {
  params: z.object({
    id: z.string().uuid("Invalid complaint ID format. Must be a valid UUID."),
  }),
};

export const updateComplaintSchema = {
  params: z.object({
    id: z.string().uuid("Invalid complaint ID format. Must be a valid UUID."),
  }),
  body: z
    .object({
      status: z.nativeEnum(ComplaintStatus).optional(),
      reason: z.string().max(1000).optional(),
      notes: z.string().max(2000).optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      "At least one valid field must be provided to update.",
    ),
};
