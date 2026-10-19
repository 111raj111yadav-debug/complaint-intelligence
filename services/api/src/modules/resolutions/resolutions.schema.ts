import { z } from "zod";

export const getResolutionsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    category: z.string().optional(),
    departmentCode: z.string().optional(),
    contentType: z.string().optional(),
    verificationStatus: z.string().optional(),
    isVerified: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === "true")),
    search: z.string().optional(),
  }),
};

export const resolutionParamsSchema = {
  params: z.object({
    id: z.string().uuid("Invalid resolution ID format"),
  }),
};

export const searchResolutionsSchema = {
  body: z.object({
    query: z
      .string()
      .min(3, "Query narrative must be at least 3 characters long"),
    top_k: z.number().int().min(1).max(20).optional().default(3),
    similarity_threshold: z.number().min(0.0).max(1.0).optional().default(0.4),
    category_filter: z.string().nullable().optional(),
    department_filter: z.string().nullable().optional(),
    only_verified: z.boolean().optional().default(true),
  }),
};

export const createResolutionSchema = {
  body: z.object({
    referenceCode: z.string().optional(),
    title: z.string().min(5, "Title must be at least 5 characters"),
    category: z.string().min(1, "Category is required"),
    departmentCode: z.string().min(1, "Department code is required"),
    complaintText: z
      .string()
      .min(10, "Complaint text must be at least 10 characters"),
    resolutionText: z
      .string()
      .min(10, "Resolution text must be at least 10 characters"),
    resolutionOutcome: z.string().min(1, "Resolution outcome is required"),
    actionSteps: z
      .array(z.string())
      .min(1, "At least one action step is required"),
    isVerified: z.boolean().optional().default(true),
    verificationStatus: z.string().optional().default("VERIFIED"),
    dataSource: z.string().optional().default("CFPB_HISTORICAL_DISPUTES"),
    sourceTitle: z.string().optional(),
    sourceUrl: z.string().url().optional().nullable(),
    sourceOrg: z.string().optional(),
    contentType: z.string().optional().default("REGULATORY_PLAYBOOK"),
    version: z.string().optional().default("1.0.0"),
    provenance: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
};
