import { prisma } from "../../lib/prisma.js";
import { ComplaintStatus, Prisma, UrgencyLevel } from "@prisma/client";

export interface AnalyticsFilter {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
}

export interface MetricDefinition<T = number | null> {
  value: T;
  formatted: string;
  formula: string;
  denominator: string;
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midVal = sorted[mid];
  if (midVal === undefined) return null;
  if (sorted.length % 2 !== 0) return midVal;
  const prevVal = sorted[mid - 1] ?? midVal;
  return (prevVal + midVal) / 2;
}

function calculateAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, curr) => acc + curr, 0);
  return sum / values.length;
}

export class AnalyticsService {
  async getOperationalOverview(filter: AnalyticsFilter) {
    const whereComplaint: Prisma.ComplaintWhereInput = {};
    const now = new Date();

    if (filter.startDate || filter.endDate) {
      whereComplaint.createdAt = {
        ...(filter.startDate ? { gte: new Date(filter.startDate) } : {}),
        ...(filter.endDate
          ? { lte: new Date(filter.endDate.length === 10 ? `${filter.endDate}T23:59:59.999Z` : filter.endDate) }
          : {}),
      };
    }

    if (filter.departmentId) {
      whereComplaint.assignments = {
        some: {
          departmentId: filter.departmentId,
          isCurrent: true,
        },
      };
    }

    // 1. Fetch complaints within date range
    const complaints = await prisma.complaint.findMany({
      where: whereComplaint,
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            recommendedDepartment: true,
          },
        },
        assignments: {
          orderBy: { createdAt: "desc" },
          include: {
            department: true,
            assignedToUser: true,
          },
        },
        recommendations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            feedback: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const totalComplaints = complaints.length;

    // --- Volume Breakdown ---
    let openCount = 0;
    let resolvedCount = 0;
    let dismissedCount = 0;
    let overdueCount = 0;

    const volumeByStatus: Record<string, number> = {
      PENDING: 0,
      ANALYZED: 0,
      IN_REVIEW: 0,
      RESOLVED: 0,
      DISMISSED: 0,
    };

    const volumeByChannel: Record<string, number> = {};
    const volumeByCategory: Record<string, number> = {};
    const volumeByDepartment: Record<string, number> = {};
    const volumeByDate: Record<string, number> = {};

    // Operational timing arrays (in hours)
    const assignmentTimesHours: number[] = [];
    const resolutionTimesHours: number[] = [];

    // Assignment & workload
    let assignedComplaintsCount = 0;
    let reassignedComplaintsCount = 0;
    const agentWorkloadMap: Record<string, { count: number; name: string }> = {};
    const deptBacklogMap: Record<string, { code: string; name: string; count: number }> = {};

    // AI & NLP Metrics
    let analyzedComplaintsCount = 0;
    let humanReviewRequiredCount = 0;
    const urgencyCounts: Record<UrgencyLevel, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    // Recommendation & Feedback
    let recommendationsGeneratedCount = 0;
    let feedbackCount = 0;
    let acceptedAsIsCount = 0;
    let modifiedCount = 0;
    let rejectedCount = 0;
    const feedbackRatings: number[] = [];
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const rubricRelevanceScores: number[] = [];
    const rubricEvidenceScores: number[] = [];
    const rubricCorrectnessScores: number[] = [];
    const rubricActionabilityScores: number[] = [];
    const rubricComplianceScores: number[] = [];

    for (const c of complaints) {
      // Status
      volumeByStatus[c.status] = (volumeByStatus[c.status] || 0) + 1;
      if (c.status === ComplaintStatus.RESOLVED) {
        resolvedCount++;
      } else if (c.status === ComplaintStatus.DISMISSED) {
        dismissedCount++;
      } else {
        openCount++;
        // Overdue check on open complaints
        if (c.slaDeadline && c.slaDeadline < now) {
          overdueCount++;
        }
      }

      // Channel
      const source = c.source || "WEB";
      volumeByChannel[source] = (volumeByChannel[source] || 0) + 1;

      // Volume over time (by YYYY-MM-DD)
      const dateKey = c.createdAt.toISOString().slice(0, 10);
      volumeByDate[dateKey] = (volumeByDate[dateKey] || 0) + 1;

      // Time to first assignment
      if (c.firstAssignedAt) {
        const diffHours = (c.firstAssignedAt.getTime() - c.createdAt.getTime()) / (1000 * 3600);
        if (diffHours >= 0) assignmentTimesHours.push(diffHours);
      }

      // Time to resolution
      if (c.resolvedAt && c.status === ComplaintStatus.RESOLVED) {
        const diffHours = (c.resolvedAt.getTime() - c.createdAt.getTime()) / (1000 * 3600);
        if (diffHours >= 0) resolutionTimesHours.push(diffHours);
      }

      // Assignments & Reassignments
      if (c.assignments.length > 0) {
        assignedComplaintsCount++;
        if (c.assignments.length > 1) {
          reassignedComplaintsCount++;
        }
        const currentAss = c.assignments.find((a) => a.isCurrent) || c.assignments[0];
        if (currentAss) {
          // Department volume & backlog
          const deptCode = currentAss.department.code;
          const deptName = currentAss.department.name;
          volumeByDepartment[deptName] = (volumeByDepartment[deptName] || 0) + 1;

          if (c.status !== ComplaintStatus.RESOLVED && c.status !== ComplaintStatus.DISMISSED) {
            if (!deptBacklogMap[deptCode]) {
              deptBacklogMap[deptCode] = { code: deptCode, name: deptName, count: 0 };
            }
            deptBacklogMap[deptCode].count++;
          }

          // Agent workload
          if (currentAss.assignedToUser) {
            const uid = currentAss.assignedToUser.id;
            const uname = currentAss.assignedToUser.fullName;
            if (!agentWorkloadMap[uid]) {
              agentWorkloadMap[uid] = { name: uname, count: 0 };
            }
            agentWorkloadMap[uid].count++;
          }
        }
      }

      // Analysis Metrics
      const latestAnalysis = c.analyses[0];
      if (latestAnalysis) {
        analyzedComplaintsCount++;
        const cat = latestAnalysis.predictedCategory;
        volumeByCategory[cat] = (volumeByCategory[cat] || 0) + 1;

        if (latestAnalysis.urgencyLevel in urgencyCounts) {
          urgencyCounts[latestAnalysis.urgencyLevel]++;
        }

        if (latestAnalysis.humanReviewRequired) {
          humanReviewRequiredCount++;
        }
      }

      // Recommendation & Feedback Metrics
      const latestRec = c.recommendations[0];
      if (latestRec) {
        recommendationsGeneratedCount++;
        if (latestRec.feedback) {
          feedbackCount++;
          const fb = latestRec.feedback;
          const decision = fb.feedbackDecision || (fb.wasAccepted ? "ACCEPTED_AS_IS" : "REJECTED");

          if (decision === "ACCEPTED_AS_IS") acceptedAsIsCount++;
          else if (decision === "MODIFIED") modifiedCount++;
          else if (decision === "REJECTED") rejectedCount++;

          if (typeof fb.agentRating === "number" && fb.agentRating >= 1 && fb.agentRating <= 5) {
            feedbackRatings.push(fb.agentRating);
            ratingDistribution[fb.agentRating] = (ratingDistribution[fb.agentRating] ?? 0) + 1;
          }

          if (fb.rubricScores && typeof fb.rubricScores === "object") {
            const r = fb.rubricScores as Record<string, unknown>;
            if (typeof r.relevanceScore === "number") rubricRelevanceScores.push(r.relevanceScore);
            if (typeof r.evidenceSupportScore === "number") rubricEvidenceScores.push(r.evidenceSupportScore);
            if (typeof r.factualCorrectnessScore === "number") rubricCorrectnessScores.push(r.factualCorrectnessScore);
            if (typeof r.actionabilityScore === "number") rubricActionabilityScores.push(r.actionabilityScore);
            if (typeof r.policyComplianceScore === "number") rubricComplianceScores.push(r.policyComplianceScore);
          }
        }
      }
    }

    // Status transition audit count
    const transitionLogs = await prisma.complaintAuditLog.groupBy({
      by: ["action"],
      _count: { id: true },
    });
    const statusTransitionCounts: Record<string, number> = {};
    for (const log of transitionLogs) {
      statusTransitionCounts[log.action] = log._count.id;
    }

    // Calculations
    const avgAssignmentHours = calculateAverage(assignmentTimesHours);
    const medianAssignmentHours = calculateMedian(assignmentTimesHours);
    const avgResolutionHours = calculateAverage(resolutionTimesHours);
    const medianResolutionHours = calculateMedian(resolutionTimesHours);

    const reassignmentRateVal =
      assignedComplaintsCount > 0 ? (reassignedComplaintsCount / assignedComplaintsCount) * 100 : null;

    const overdueRateVal = openCount > 0 ? (overdueCount / openCount) * 100 : null;

    const humanReviewRateVal =
      analyzedComplaintsCount > 0 ? (humanReviewRequiredCount / analyzedComplaintsCount) * 100 : null;

    const recGenerationRateVal =
      analyzedComplaintsCount > 0 ? (recommendationsGeneratedCount / analyzedComplaintsCount) * 100 : null;

    const feedbackAcceptanceRateVal =
      feedbackCount > 0 ? (acceptedAsIsCount / feedbackCount) * 100 : null;

    const feedbackModificationRateVal =
      feedbackCount > 0 ? (modifiedCount / feedbackCount) * 100 : null;

    const feedbackRejectionRateVal =
      feedbackCount > 0 ? (rejectedCount / feedbackCount) * 100 : null;

    const avgRatingVal = calculateAverage(feedbackRatings);

    return {
      summary: {
        totalComplaints: {
          value: totalComplaints,
          formatted: `${totalComplaints} complaints`,
          formula: "COUNT(complaints in selected date range)",
          denominator: "All ingested customer complaints",
        },
        openComplaints: {
          value: openCount,
          formatted: `${openCount} open`,
          formula: "COUNT(complaints WHERE status IN ('PENDING', 'ANALYZED', 'IN_REVIEW'))",
          denominator: "Total complaints",
        },
        resolvedComplaints: {
          value: resolvedCount,
          formatted: `${resolvedCount} resolved`,
          formula: "COUNT(complaints WHERE status = 'RESOLVED')",
          denominator: "Total complaints",
        },
        dismissedComplaints: {
          value: dismissedCount,
          formatted: `${dismissedCount} dismissed`,
          formula: "COUNT(complaints WHERE status = 'DISMISSED')",
          denominator: "Total complaints",
        },
        resolutionRate: {
          value: totalComplaints > 0 ? Number(((resolvedCount / totalComplaints) * 100).toFixed(1)) : null,
          formatted: totalComplaints > 0 ? `${((resolvedCount / totalComplaints) * 100).toFixed(1)}%` : "N/A",
          formula: "(resolvedComplaints / totalComplaints) * 100",
          denominator: "Total complaints submitted",
        },
      },
      operationalPerformance: {
        avgTimeToFirstAssignment: {
          value: avgAssignmentHours !== null ? Number(avgAssignmentHours.toFixed(1)) : null,
          formatted: avgAssignmentHours !== null ? `${avgAssignmentHours.toFixed(1)} hrs` : "N/A (pending assignments)",
          formula: "AVG(first_assigned_at - created_at)",
          denominator: `${assignmentTimesHours.length} assigned complaints with recorded timestamp`,
        },
        medianTimeToFirstAssignment: {
          value: medianAssignmentHours !== null ? Number(medianAssignmentHours.toFixed(1)) : null,
          formatted: medianAssignmentHours !== null ? `${medianAssignmentHours.toFixed(1)} hrs` : "N/A",
          formula: "MEDIAN(first_assigned_at - created_at)",
          denominator: `${assignmentTimesHours.length} assigned complaints`,
        },
        avgTimeToResolution: {
          value: avgResolutionHours !== null ? Number(avgResolutionHours.toFixed(1)) : null,
          formatted: avgResolutionHours !== null ? `${avgResolutionHours.toFixed(1)} hrs` : "N/A (no resolved cases yet)",
          formula: "AVG(resolved_at - created_at)",
          denominator: `${resolutionTimesHours.length} resolved complaints`,
        },
        medianTimeToResolution: {
          value: medianResolutionHours !== null ? Number(medianResolutionHours.toFixed(1)) : null,
          formatted: medianResolutionHours !== null ? `${medianResolutionHours.toFixed(1)} hrs` : "N/A",
          formula: "MEDIAN(resolved_at - created_at)",
          denominator: `${resolutionTimesHours.length} resolved complaints`,
        },
        overdueComplaints: {
          value: overdueCount,
          formatted: `${overdueCount} overdue`,
          formula: "COUNT(open complaints WHERE sla_deadline < NOW())",
          denominator: `${openCount} currently open complaints`,
        },
        overdueRate: {
          value: overdueRateVal !== null ? Number(overdueRateVal.toFixed(1)) : null,
          formatted: overdueRateVal !== null ? `${overdueRateVal.toFixed(1)}%` : "0.0%",
          formula: "(overdueComplaints / openComplaints) * 100",
          denominator: "All active open complaints",
        },
        reassignmentRate: {
          value: reassignmentRateVal !== null ? Number(reassignmentRateVal.toFixed(1)) : null,
          formatted: reassignmentRateVal !== null ? `${reassignmentRateVal.toFixed(1)}%` : "0.0%",
          formula: "(reassignedComplaints / assignedComplaints) * 100",
          denominator: `${assignedComplaintsCount} assigned complaints`,
        },
        backlogByDepartment: Object.values(deptBacklogMap),
        workloadByAgent: Object.entries(agentWorkloadMap).map(([id, info]) => ({
          userId: id,
          fullName: info.name,
          activeAssignmentsCount: info.count,
        })),
        statusTransitions: statusTransitionCounts,
      },
      aiPerformance: {
        categoryDistribution: Object.entries(volumeByCategory).map(([category, count]) => ({
          category,
          count,
          percentage: totalComplaints > 0 ? Number(((count / totalComplaints) * 100).toFixed(1)) : 0,
        })),
        urgencyDistribution: Object.entries(urgencyCounts).map(([urgency, count]) => ({
          urgency,
          count,
          percentage: totalComplaints > 0 ? Number(((count / totalComplaints) * 100).toFixed(1)) : 0,
        })),
        humanReviewRate: {
          value: humanReviewRateVal !== null ? Number(humanReviewRateVal.toFixed(1)) : null,
          formatted: humanReviewRateVal !== null ? `${humanReviewRateVal.toFixed(1)}%` : "0.0%",
          formula: "(humanReviewRequired / analyzedComplaints) * 100",
          denominator: `${analyzedComplaintsCount} analyzed complaints`,
        },
        recommendationGenerationRate: {
          value: recGenerationRateVal !== null ? Number(recGenerationRateVal.toFixed(1)) : null,
          formatted: recGenerationRateVal !== null ? `${recGenerationRateVal.toFixed(1)}%` : "0.0%",
          formula: "(recommendationsGenerated / analyzedComplaints) * 100",
          denominator: `${analyzedComplaintsCount} analyzed complaints`,
        },
        feedbackAcceptanceRate: {
          value: feedbackAcceptanceRateVal !== null ? Number(feedbackAcceptanceRateVal.toFixed(1)) : null,
          formatted: feedbackAcceptanceRateVal !== null ? `${feedbackAcceptanceRateVal.toFixed(1)}%` : "N/A (pending feedback)",
          formula: "(acceptedAsIs / totalFeedback) * 100",
          denominator: `${feedbackCount} feedback submissions`,
        },
        feedbackModificationRate: {
          value: feedbackModificationRateVal !== null ? Number(feedbackModificationRateVal.toFixed(1)) : null,
          formatted: feedbackModificationRateVal !== null ? `${feedbackModificationRateVal.toFixed(1)}%` : "N/A",
          formula: "(modifiedByAgent / totalFeedback) * 100",
          denominator: `${feedbackCount} feedback submissions`,
        },
        feedbackRejectionRate: {
          value: feedbackRejectionRateVal !== null ? Number(feedbackRejectionRateVal.toFixed(1)) : null,
          formatted: feedbackRejectionRateVal !== null ? `${feedbackRejectionRateVal.toFixed(1)}%` : "N/A",
          formula: "(rejectedByAgent / totalFeedback) * 100",
          denominator: `${feedbackCount} feedback submissions`,
        },
        avgFeedbackRating: {
          value: avgRatingVal !== null ? Number(avgRatingVal.toFixed(2)) : null,
          formatted: avgRatingVal !== null ? `${avgRatingVal.toFixed(1)} / 5.0` : "N/A",
          formula: "AVG(agent_rating)",
          denominator: `${feedbackRatings.length} rated recommendations`,
        },
        ratingDistribution,
        rubricAverages: {
          relevance: calculateAverage(rubricRelevanceScores),
          evidenceSupport: calculateAverage(rubricEvidenceScores),
          factualCorrectness: calculateAverage(rubricCorrectnessScores),
          actionability: calculateAverage(rubricActionabilityScores),
          policyCompliance: calculateAverage(rubricComplianceScores),
        },
      },
      charts: {
        volumeOverTime: Object.entries(volumeByDate).map(([date, count]) => ({ date, count })),
        volumeByDepartment: Object.entries(volumeByDepartment).map(([department, count]) => ({
          department,
          count,
        })),
        volumeByChannel: Object.entries(volumeByChannel).map(([channel, count]) => ({
          channel,
          count,
        })),
        statusDistribution: Object.entries(volumeByStatus).map(([status, count]) => ({
          status,
          count,
        })),
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
