import { prisma } from "../../lib/prisma.js";
import { nlpClient } from "../../clients/nlp.client.js";
import { AppError } from "../../middleware/error.js";
import { AuthUserPayload } from "../../lib/jwt.js";
import { Prisma } from "@prisma/client";

export interface GenerateRecommendationOptions {
  force_provider?: string | null;
  top_k?: number;
  similarity_threshold?: number;
}

export interface RecommendationFeedbackData {
  wasAccepted: boolean;
  feedbackDecision?: "ACCEPTED_AS_IS" | "MODIFIED" | "REJECTED";
  rejectionReason?: string;
  agentModifications?: string;
  agentRating?: number;
  feedbackNotes?: string;
  submittedBy?: string;
  rubricScores?: {
    relevanceScore?: number;
    evidenceSupportScore?: number;
    factualCorrectnessScore?: number;
    actionabilityScore?: number;
    policyComplianceScore?: number;
    escalationAppropriate?: boolean;
  };
}

export class RecommendationsService {
  /**
   * Generates a grounded RAG recommendation for a complaint, persists it and its sources, and returns it.
   */
  async generateRecommendation(
    complaintId: string,
    options?: GenerateRecommendationOptions,
    actorUser?: AuthUserPayload,
  ) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!complaint) {
      throw new AppError(
        `Complaint with ID ${complaintId} was not found.`,
        404,
        "COMPLAINT_NOT_FOUND",
      );
    }

    const latestAnalysis = complaint.analyses[0] || null;

    const nlpResponse = await nlpClient.generateRecommendation({
      complaint_text: complaint.sanitizedText || complaint.originalText,
      predicted_category: latestAnalysis?.predictedCategory || null,
      urgency_level: latestAnalysis?.urgencyLevel || null,
      department_code: latestAnalysis?.departmentCode || null,
      force_provider: options?.force_provider || null,
      top_k: options?.top_k,
      similarity_threshold: options?.similarity_threshold,
    });

    if (!nlpResponse.success || !nlpResponse.data) {
      throw new AppError(
        nlpResponse.error || "Failed to generate resolution recommendation.",
        nlpResponse.statusCode || 502,
        nlpResponse.code || "RECOMMENDATION_GENERATION_FAILED",
      );
    }

    const data = nlpResponse.data;

    // Verify existing resolution IDs to guarantee foreign key integrity
    const sourceIds = (data.supporting_sources || []).map((s) => s.source_id);
    const existingResolutions = await prisma.resolution.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true },
    });
    const validIdSet = new Set(existingResolutions.map((r) => r.id));

    const sourcesToCreate = (data.supporting_sources || [])
      .filter((s) => validIdSet.has(s.source_id))
      .map((s, idx) => ({
        resolutionId: s.source_id,
        similarityScore: s.similarity_score,
        rank: idx + 1,
        citationReason: `Matched historical dispute playbook [${s.reference_code}] ${s.title} (similarity: ${(s.similarity_score * 100).toFixed(1)}%)`,
      }));

    const created = await prisma.resolutionRecommendation.create({
      data: {
        complaintId,
        suggestedSteps: data.suggested_steps,
        rationale: data.rationale,
        evidenceStrength: data.evidence_strength,
        confidenceScore: data.confidence_score,
        evidenceLimitations: data.evidence_limitations,
        humanReviewRequired: data.human_review_required,
        reviewReasons: data.review_reasons,
        modelProvider: data.model_provider,
        modelIdentifier: data.model_identifier,
        promptVersion: data.prompt_version,
        status: "GENERATED",
        sources: {
          create: sourcesToCreate,
        },
      },
      include: {
        sources: {
          orderBy: { rank: "asc" },
          include: {
            resolution: {
              select: {
                id: true,
                referenceCode: true,
                title: true,
                category: true,
                resolutionOutcome: true,
                departmentCode: true,
                isVerified: true,
                dataSource: true,
                sourceTitle: true,
                sourceUrl: true,
                sourceOrg: true,
                contentType: true,
                version: true,
                lastVerifiedAt: true,
              },
            },
          },
        },
        feedback: true,
      },
    });

    // Audit log recommendation generation event
    await prisma.complaintAuditLog.create({
      data: {
        complaint: { connect: { id: complaintId } },
        fromStatus: complaint.status,
        toStatus: complaint.status,
        ...(actorUser?.userId ? { actor: { connect: { id: actorUser.userId } } } : {}),
        actorName: actorUser ? `${actorUser.fullName} (${actorUser.role})` : "RAG_RECOMMENDATION_ENGINE",
        action: "RECOMMENDATION_GENERATED",
        reason: `Generated RAG resolution recommendation with ${data.evidence_strength} evidence strength (${sourcesToCreate.length} sources cited).`,
        metadata: {
          recommendationId: created.id,
          provider: data.model_provider,
          evidenceStrength: data.evidence_strength,
          confidenceScore: data.confidence_score,
        },
      },
    });

    return created;
  }

  /**
   * Fetches the latest generated recommendation for a complaint.
   */
  async getLatestRecommendation(complaintId: string) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true },
    });

    if (!complaint) {
      throw new AppError(
        `Complaint with ID ${complaintId} was not found.`,
        404,
        "COMPLAINT_NOT_FOUND",
      );
    }

    const recommendation = await prisma.resolutionRecommendation.findFirst({
      where: { complaintId },
      orderBy: { createdAt: "desc" },
      include: {
        sources: {
          orderBy: { rank: "asc" },
          include: {
            resolution: {
              select: {
                id: true,
                referenceCode: true,
                title: true,
                category: true,
                resolutionOutcome: true,
                departmentCode: true,
                isVerified: true,
                dataSource: true,
                sourceTitle: true,
                sourceUrl: true,
                sourceOrg: true,
                contentType: true,
                version: true,
                lastVerifiedAt: true,
              },
            },
          },
        },
        feedback: {
          include: {
            user: {
              select: { id: true, fullName: true, role: true },
            },
          },
        },
      },
    });

    return recommendation;
  }

  /**
   * Records agent feedback (acceptance/modifications/rejection/rating/rubric) for a recommendation.
   */
  async recordFeedback(
    complaintId: string,
    feedbackData: RecommendationFeedbackData,
    actorUser?: AuthUserPayload,
  ) {
    const recommendation = await prisma.resolutionRecommendation.findFirst({
      where: { complaintId },
      orderBy: { createdAt: "desc" },
    });

    if (!recommendation) {
      throw new AppError(
        `No resolution recommendation found for complaint ${complaintId}.`,
        404,
        "RECOMMENDATION_NOT_FOUND",
      );
    }

    // Infer decision if not explicitly supplied
    let decision = feedbackData.feedbackDecision;
    if (!decision) {
      if (!feedbackData.wasAccepted) {
        decision = "REJECTED";
      } else if (feedbackData.agentModifications && feedbackData.agentModifications.trim().length > 0) {
        decision = "MODIFIED";
      } else {
        decision = "ACCEPTED_AS_IS";
      }
    }

    const submittedBy = actorUser
      ? `${actorUser.fullName} (${actorUser.role})`
      : feedbackData.submittedBy || "SUPPORT_AGENT";

    const feedback = await prisma.recommendationFeedback.upsert({
      where: { recommendationId: recommendation.id },
      create: {
        recommendationId: recommendation.id,
        wasAccepted: feedbackData.wasAccepted,
        feedbackDecision: decision,
        rejectionReason: feedbackData.rejectionReason || null,
        agentModifications: feedbackData.agentModifications || null,
        agentRating: feedbackData.agentRating || null,
        feedbackNotes: feedbackData.feedbackNotes || null,
        submittedBy,
        userId: actorUser?.userId || null,
        rubricScores: feedbackData.rubricScores as unknown as Prisma.InputJsonValue,
      },
      update: {
        wasAccepted: feedbackData.wasAccepted,
        feedbackDecision: decision,
        rejectionReason: feedbackData.rejectionReason || null,
        agentModifications: feedbackData.agentModifications || null,
        agentRating: feedbackData.agentRating || null,
        feedbackNotes: feedbackData.feedbackNotes || null,
        submittedBy,
        userId: actorUser?.userId || null,
        rubricScores: feedbackData.rubricScores as unknown as Prisma.InputJsonValue,
      },
      include: {
        user: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    // Update recommendation status
    const statusMap = {
      ACCEPTED_AS_IS: "ACCEPTED",
      MODIFIED: "MODIFIED",
      REJECTED: "REJECTED",
    };
    await prisma.resolutionRecommendation.update({
      where: { id: recommendation.id },
      data: {
        status: statusMap[decision],
      },
    });

    // Record in complaint audit log
    await prisma.complaintAuditLog.create({
      data: {
        complaint: { connect: { id: complaintId } },
        fromStatus: null,
        toStatus: null,
        action: "RECOMMENDATION_FEEDBACK_RECORDED",
        ...(actorUser?.userId ? { actor: { connect: { id: actorUser.userId } } } : {}),
        actorName: submittedBy,
        reason: `Feedback registered as ${decision} with ${feedbackData.agentRating ? feedbackData.agentRating + "/5 stars" : "no star rating"}. Notes: ${feedbackData.feedbackNotes || "None"}`,
        metadata: {
          feedbackId: feedback.id,
          decision,
          wasAccepted: feedbackData.wasAccepted,
          agentRating: feedbackData.agentRating,
          rubricScores: feedbackData.rubricScores,
        },
      },
    });

    return feedback;
  }
}

export const recommendationsService = new RecommendationsService();
