import { z } from "zod";

export const generateRecommendationSchema = {
  params: z.object({
    id: z.string().uuid("Invalid complaint ID format"),
  }),
  body: z
    .object({
      force_provider: z.string().nullable().optional(),
      top_k: z.number().int().min(1).max(10).optional(),
      similarity_threshold: z.number().min(0.0).max(1.0).optional(),
    })
    .optional(),
};

export const getRecommendationParamsSchema = {
  params: z.object({
    id: z.string().uuid("Invalid complaint ID format"),
  }),
};

export const recommendationFeedbackSchema = {
  params: z.object({
    id: z.string().uuid("Invalid complaint ID format"),
  }),
  body: z.object({
    wasAccepted: z.boolean(),
    feedbackDecision: z.enum(["ACCEPTED_AS_IS", "MODIFIED", "REJECTED"]).optional(),
    rejectionReason: z.string().max(1000).optional(),
    agentModifications: z.string().optional(),
    agentRating: z.number().int().min(1).max(5).optional(),
    feedbackNotes: z.string().optional(),
    submittedBy: z.string().optional(),
    rubricScores: z
      .object({
        relevanceScore: z.number().min(1).max(5).optional(),
        evidenceSupportScore: z.number().min(1).max(5).optional(),
        factualCorrectnessScore: z.number().min(1).max(5).optional(),
        actionabilityScore: z.number().min(1).max(5).optional(),
        policyComplianceScore: z.number().min(1).max(5).optional(),
        escalationAppropriate: z.boolean().optional(),
      })
      .optional(),
  }),
};
