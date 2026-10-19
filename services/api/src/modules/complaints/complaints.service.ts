import { prisma } from "../../lib/prisma.js";
import { nlpClient } from "../../clients/nlp.client.js";
import { AppError } from "../../middleware/error.js";
import { ComplaintStatus, UrgencyLevel, Prisma, UserRole } from "@prisma/client";
import { AuthUserPayload } from "../../lib/jwt.js";

export interface ListComplaintsOptions {
  page?: number;
  limit?: number;
  status?: ComplaintStatus;
  category?: string;
  urgency?: UrgencyLevel;
  search?: string;
  departmentId?: string;
  assignedToUserId?: string;
  isOverdue?: boolean;
  humanReviewRequired?: boolean;
}

export interface UpdateComplaintOptions {
  status?: ComplaintStatus;
  reason?: string;
  notes?: string;
}

const VALID_STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  [ComplaintStatus.PENDING]: [
    ComplaintStatus.ANALYZED,
    ComplaintStatus.IN_REVIEW,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.DISMISSED,
  ],
  [ComplaintStatus.ANALYZED]: [
    ComplaintStatus.IN_REVIEW,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.DISMISSED,
  ],
  [ComplaintStatus.IN_REVIEW]: [
    ComplaintStatus.RESOLVED,
    ComplaintStatus.DISMISSED,
  ],
  [ComplaintStatus.RESOLVED]: [
    ComplaintStatus.IN_REVIEW, // Reopening for reinvestigation
  ],
  [ComplaintStatus.DISMISSED]: [
    ComplaintStatus.PENDING,
    ComplaintStatus.IN_REVIEW, // Reopening
  ],
};

const SLA_HOURS_BY_URGENCY: Record<UrgencyLevel, number> = {
  [UrgencyLevel.CRITICAL]: 24, // 1 day SLA
  [UrgencyLevel.HIGH]: 48, // 2 days SLA
  [UrgencyLevel.MEDIUM]: 120, // 5 days SLA
  [UrgencyLevel.LOW]: 240, // 10 days SLA
};

export class ComplaintsService {
  /**
   * Generates a unique, standardized complaint reference number (e.g. CMP-20261016-A1B2).
   */
  private generateReferenceNumber(): string {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CMP-${datePrefix}-${randomHex}`;
  }

  /**
   * Retrieves a paginated list of complaints with search, category, status, urgency, and SLA filters.
   */
  async listComplaints(options: ListComplaintsOptions) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ComplaintWhereInput = {};

    if (options.status) {
      where.status = options.status;
    }

    if (options.search) {
      where.OR = [
        { referenceNumber: { contains: options.search, mode: "insensitive" } },
        { originalText: { contains: options.search, mode: "insensitive" } },
      ];
    }

    if (options.category || options.urgency || options.humanReviewRequired !== undefined) {
      where.analyses = {
        some: {
          ...(options.category ? { predictedCategory: options.category } : {}),
          ...(options.urgency ? { urgencyLevel: options.urgency } : {}),
          ...(options.humanReviewRequired !== undefined
            ? { humanReviewRequired: options.humanReviewRequired }
            : {}),
        },
      };
    }

    if (options.departmentId || options.assignedToUserId) {
      where.assignments = {
        some: {
          isCurrent: true,
          ...(options.departmentId ? { departmentId: options.departmentId } : {}),
          ...(options.assignedToUserId ? { assignedToUserId: options.assignedToUserId } : {}),
        },
      };
    }

    if (options.isOverdue !== undefined) {
      if (options.isOverdue) {
        where.AND = [
          { slaDeadline: { lt: new Date() } },
          { status: { notIn: [ComplaintStatus.RESOLVED, ComplaintStatus.DISMISSED] } },
        ];
      } else {
        where.OR = [
          { slaDeadline: { gte: new Date() } },
          { status: { in: [ComplaintStatus.RESOLVED, ComplaintStatus.DISMISSED] } },
          { slaDeadline: null },
        ];
      }
    }

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              recommendedDepartment: {
                select: { id: true, code: true, name: true },
              },
            },
          },
          assignments: {
            where: { isCurrent: true },
            take: 1,
            include: {
              department: { select: { id: true, code: true, name: true } },
              assignedToUser: { select: { id: true, fullName: true, role: true } },
            },
          },
        },
      }),
    ]);

    const now = new Date();

    // Format list items with their latest analysis summary & SLA indicators
    const formatted = complaints.map((c) => {
      const latestAnalysis = c.analyses[0] || null;
      const currentAssignment = c.assignments[0] || null;
      const isOverdue =
        !!c.slaDeadline &&
        c.slaDeadline < now &&
        c.status !== ComplaintStatus.RESOLVED &&
        c.status !== ComplaintStatus.DISMISSED;

      return {
        id: c.id,
        referenceNumber: c.referenceNumber,
        originalText: c.originalText,
        sanitizedText: c.sanitizedText,
        source: c.source,
        status: c.status,
        firstAssignedAt: c.firstAssignedAt,
        resolvedAt: c.resolvedAt,
        slaDeadline: c.slaDeadline,
        isOverdue,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        currentAssignment: currentAssignment
          ? {
              id: currentAssignment.id,
              departmentId: currentAssignment.department.id,
              departmentCode: currentAssignment.department.code,
              departmentName: currentAssignment.department.name,
              assignedTo: currentAssignment.assignedToUser?.fullName || currentAssignment.assignedTo,
              assignedToUserId: currentAssignment.assignedToUserId,
            }
          : null,
        latestAnalysis: latestAnalysis
          ? {
              id: latestAnalysis.id,
              predictedCategory: latestAnalysis.predictedCategory,
              categoryConfidence: latestAnalysis.categoryConfidence,
              urgencyLevel: latestAnalysis.urgencyLevel,
              urgencyScore: latestAnalysis.urgencyScore,
              sentimentLabel: latestAnalysis.sentimentLabel,
              emotionPrimary: latestAnalysis.emotionPrimary,
              departmentCode: latestAnalysis.departmentCode,
              departmentName: latestAnalysis.recommendedDepartment?.name,
              humanReviewRequired: latestAnalysis.humanReviewRequired,
              analyzedAt: latestAnalysis.analysisTimestamp,
            }
          : null,
      };
    });

    return {
      complaints: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Persists a new customer complaint in PostgreSQL without claiming premature NLP analysis.
   */
  async createComplaint(data: { text: string; source?: string }) {
    let reference = this.generateReferenceNumber();

    // Ensure reference uniqueness in rare collision
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.complaint.findUnique({
        where: { referenceNumber: reference },
      });
      if (!existing) break;
      reference = this.generateReferenceNumber();
      attempts++;
    }

    const complaint = await prisma.complaint.create({
      data: {
        referenceNumber: reference,
        originalText: data.text.trim(),
        source: data.source || "WEB",
        status: ComplaintStatus.PENDING,
      },
    });

    // Record initial submission in audit log
    await prisma.complaintAuditLog.create({
      data: {
        complaint: { connect: { id: complaint.id } },
        fromStatus: null,
        toStatus: ComplaintStatus.PENDING,
        action: "COMPLAINT_SUBMITTED",
        actorName: "CONSUMER_SUBMISSION",
        reason: "Initial customer dispute submission",
      },
    });

    return complaint;
  }

  /**
   * Retrieves a complaint by ID along with its full analysis history, assignments, and audit trail.
   */
  async getComplaintById(id: string) {
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          include: {
            recommendedDepartment: true,
          },
        },
        recommendations: {
          orderBy: { createdAt: "desc" },
          take: 5,
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
        },
        assignments: {
          orderBy: { createdAt: "desc" },
          include: {
            department: true,
            assignedToUser: {
              select: { id: true, fullName: true, email: true, role: true },
            },
            assignedByUser: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          include: {
            actor: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (!complaint) {
      throw new AppError(
        `Complaint with ID ${id} was not found.`,
        404,
        "COMPLAINT_NOT_FOUND",
      );
    }

    const now = new Date();
    const isOverdue =
      !!complaint.slaDeadline &&
      complaint.slaDeadline < now &&
      complaint.status !== ComplaintStatus.RESOLVED &&
      complaint.status !== ComplaintStatus.DISMISSED;

    return {
      ...complaint,
      isOverdue,
    };
  }

  /**
   * Updates complaint status with state-machine transition validation and audit trail.
   */
  async updateComplaint(
    id: string,
    updates: UpdateComplaintOptions,
    actorUser?: AuthUserPayload,
  ) {
    const existing = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true, status: true, referenceNumber: true },
    });

    if (!existing) {
      throw new AppError(`Complaint with ID ${id} was not found.`, 404, "COMPLAINT_NOT_FOUND");
    }

    // Role check: Auditor is strictly read-only
    if (actorUser && actorUser.role === UserRole.AUDITOR) {
      throw new AppError(
        "Auditor accounts have read-only privileges and cannot modify complaint workflows.",
        403,
        "FORBIDDEN_AUDITOR_MUTATION",
      );
    }

    if (updates.status && updates.status !== existing.status) {
      const allowedNext = VALID_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowedNext.includes(updates.status)) {
        throw new AppError(
          `Invalid workflow transition: cannot change status from '${existing.status}' to '${updates.status}'. Allowed transitions: ${allowedNext.join(", ")}.`,
          400,
          "INVALID_STATUS_TRANSITION",
          { currentStatus: existing.status, requestedStatus: updates.status, allowedTransitions: allowedNext },
        );
      }

      // Reopening verification: reopening from RESOLVED or DISMISSED requires explicit reason
      const isReopening =
        (existing.status === ComplaintStatus.RESOLVED || existing.status === ComplaintStatus.DISMISSED) &&
        (updates.status === ComplaintStatus.IN_REVIEW || updates.status === ComplaintStatus.PENDING);

      if (isReopening && !updates.reason) {
        throw new AppError(
          "A documented justification reason is required when reopening a resolved or dismissed complaint.",
          400,
          "REOPEN_REASON_REQUIRED",
        );
      }

      // Concurrency and transition execution in transaction
      return prisma.$transaction(async (tx) => {
        const resolvedAt = updates.status === ComplaintStatus.RESOLVED ? new Date() : (isReopening ? null : undefined);

        const updated = await tx.complaint.update({
          where: { id },
          data: {
            status: updates.status,
            ...(resolvedAt !== undefined ? { resolvedAt } : {}),
          },
          include: {
            analyses: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        const actorName = actorUser ? `${actorUser.fullName} (${actorUser.role})` : "SUPPORT_AGENT";
        const actorId = actorUser?.userId || null;

        await tx.complaintAuditLog.create({
          data: {
            complaint: { connect: { id } },
            fromStatus: existing.status,
            toStatus: updates.status,
            ...(actorId ? { actor: { connect: { id: actorId } } } : {}),
            actorName,
            action: isReopening ? "WORKFLOW_REOPENED" : "STATUS_CHANGE",
            reason: updates.reason || updates.notes || `Complaint status updated to ${updates.status}`,
            metadata: { notes: updates.notes || null },
          },
        });

        return updated;
      });
    }

    return existing;
  }

  /**
   * Triggers NLP analysis on the Python microservice, validates response, persists result,
   * and computes urgency-based SLA deadline.
   */
  async analyzeComplaint(id: string, actorUser?: AuthUserPayload) {
    const complaint = await prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new AppError(
        `Complaint with ID ${id} was not found.`,
        404,
        "COMPLAINT_NOT_FOUND",
      );
    }

    // Role check: Auditor is strictly read-only
    if (actorUser && actorUser.role === UserRole.AUDITOR) {
      throw new AppError(
        "Auditor accounts have read-only privileges and cannot trigger NLP re-analyses.",
        403,
        "FORBIDDEN_AUDITOR_MUTATION",
      );
    }

    // Call Python NLP microservice
    const nlpResult = await nlpClient.analyzeText(complaint.originalText);

    if (!nlpResult.success || !nlpResult.data) {
      throw new AppError(
        nlpResult.error || "NLP microservice analysis request failed.",
        nlpResult.statusCode || 502,
        nlpResult.code || "NLP_ANALYSIS_FAILED",
      );
    }

    const nlpData = nlpResult.data;

    // Resolve recommended department from database
    const department = await prisma.department.findUnique({
      where: { code: nlpData.recommended_department.code },
    });

    const urgencyLevel = nlpData.urgency.level as UrgencyLevel;
    const slaHours = SLA_HOURS_BY_URGENCY[urgencyLevel] || 120;
    const slaDeadline = new Date(Date.now() + slaHours * 3600 * 1000);

    const nextStatus = nlpData.urgency.human_review_required
      ? ComplaintStatus.IN_REVIEW
      : ComplaintStatus.ANALYZED;

    // Create analysis record in transaction with complaint status and SLA update
    const [analysis] = await prisma.$transaction([
      prisma.complaintAnalysis.create({
        data: {
          complaintId: complaint.id,
          predictedCategory: nlpData.category.label,
          categoryConfidence: nlpData.category.confidence,
          categoryProbabilities: nlpData.category.probabilities || {},

          sentimentLabel: nlpData.sentiment.label,
          sentimentScore: nlpData.sentiment.score,
          sentimentCompound: nlpData.sentiment.compound ?? null,
          sentimentScores: nlpData.sentiment.scores || {},

          emotionPrimary: nlpData.emotion.primary,
          emotionConfidence: nlpData.emotion.confidence,
          emotionScores: nlpData.emotion.scores || {},
          emotionSecondary: nlpData.emotion.secondary || [],

          urgencyLevel,
          urgencyScore: nlpData.urgency.score,
          urgencyReasons: nlpData.urgency
            .contributing_reasons as unknown as Prisma.InputJsonValue,
          humanReviewRequired: nlpData.urgency.human_review_required,

          recommendedDepartmentId: department?.id || null,
          departmentCode: nlpData.recommended_department.code,

          modelVersions: nlpData.model_versions,
          status: "SUCCESS",
        },
        include: {
          recommendedDepartment: true,
        },
      }),
      prisma.complaint.update({
        where: { id: complaint.id },
        data: {
          status: nextStatus,
          slaDeadline,
        },
      }),
      prisma.complaintAuditLog.create({
        data: {
          complaint: { connect: { id: complaint.id } },
          fromStatus: complaint.status,
          toStatus: nextStatus,
          ...(actorUser?.userId ? { actor: { connect: { id: actorUser.userId } } } : {}),
          actorName: actorUser ? `${actorUser.fullName} (${actorUser.role})` : "SYSTEM_NLP_PIPELINE",
          action: "NLP_ANALYSIS_COMPLETED",
          reason: `Automated NLP categorization as ${nlpData.category.label} with ${urgencyLevel} urgency. Human review required: ${nlpData.urgency.human_review_required}`,
          metadata: {
            category: nlpData.category.label,
            urgency: urgencyLevel,
            confidence: nlpData.category.confidence,
          },
        },
      }),
    ]);

    return analysis;
  }

  /**
   * Retrieves the most recent analysis for a complaint.
   */
  async getLatestAnalysis(complaintId: string) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            recommendedDepartment: true,
          },
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

    const latest = complaint.analyses[0];
    if (!latest) {
      throw new AppError(
        `Complaint ${complaint.referenceNumber} has not been analyzed yet.`,
        404,
        "ANALYSIS_NOT_FOUND",
        {
          referenceNumber: complaint.referenceNumber,
          status: complaint.status,
        },
      );
    }

    return latest;
  }
}

export const complaintsService = new ComplaintsService();
