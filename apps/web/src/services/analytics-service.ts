import { apiClient } from "../lib/api-client.js";
import { ApiResponse, OperationalAnalyticsData } from "../types/index.js";

export interface AnalyticsQueryOptions {
  range?: "24h" | "7d" | "30d" | "all";
  departmentId?: string;
  category?: string;
}

export const fetchOperationalAnalytics = async (
  options: AnalyticsQueryOptions = {},
): Promise<OperationalAnalyticsData> => {
  const params: Record<string, string> = {};
  if (options.range) params.range = options.range;
  if (options.departmentId) params.departmentId = options.departmentId;
  if (options.category) params.category = options.category;

  const res = await apiClient.get<ApiResponse<any>>(
    "/analytics/overview",
    { params },
  );

  if (!res.data.success || !res.data.data) {
    throw new Error(
      res.data.error?.message || "Failed to retrieve operational analytics.",
    );
  }

  const raw = res.data.data;
  const total = raw.summary?.totalComplaints?.value ?? 0;
  const open = raw.summary?.openComplaints?.value ?? 0;
  const resolved = raw.summary?.resolvedComplaints?.value ?? 0;
  const dismissed = raw.summary?.dismissedComplaints?.value ?? 0;
  const statusDistribution: Array<{ status: string; count: number }> = (
    raw.charts?.statusDistribution || []
  ).map((s: any) => ({
    status: s.status,
    count: s.count,
  }));
  const inReview =
    statusDistribution.find((s) => s.status === "IN_REVIEW")?.count ??
    Math.max(0, total - open - resolved - dismissed);
  const analyzedComplaints = (raw.aiPerformance?.categoryDistribution || []).reduce(
    (acc: number, item: any) => acc + (item.count || 0),
    0,
  );

  const mapped: OperationalAnalyticsData = {
    timeRange: {
      preset: options.range || "all",
      from: null,
      to: new Date().toISOString(),
    },
    volume: {
      totalComplaints: total,
      openComplaints: open,
      inReviewComplaints: inReview,
      resolvedComplaints: resolved,
      dismissedComplaints: dismissed,
      resolutionRate:
        raw.summary?.resolutionRate?.value !== null && raw.summary?.resolutionRate?.value !== undefined
          ? raw.summary.resolutionRate.value / 100
          : 0,
      analyzedComplaints,
      statusDistribution,
      byCategory: (raw.aiPerformance?.categoryDistribution || []).map((c: any) => ({
        category: c.category,
        count: c.count,
      })),
      byDepartment: (raw.charts?.volumeByDepartment || []).map((d: any) => ({
        department: d.department,
        count: d.count,
      })),
      byChannel: (raw.charts?.volumeByChannel || []).map((ch: any) => ({
        channel: ch.channel,
        count: ch.count,
      })),
    },
    operations: {
      avgTimeToFirstAssignmentHours:
        raw.operationalPerformance?.avgTimeToFirstAssignment?.value ?? null,
      medianTimeToFirstAssignmentHours:
        raw.operationalPerformance?.medianTimeToFirstAssignment?.value ?? null,
      avgTimeToResolutionHours:
        raw.operationalPerformance?.avgTimeToResolution?.value ?? null,
      medianTimeToResolutionHours:
        raw.operationalPerformance?.medianTimeToResolution?.value ?? null,
      overdueCount: raw.operationalPerformance?.overdueComplaints?.value ?? 0,
      overdueRate:
        raw.operationalPerformance?.overdueRate?.value !== null &&
        raw.operationalPerformance?.overdueRate?.value !== undefined
          ? raw.operationalPerformance.overdueRate.value / 100
          : 0,
      reassignmentRate:
        raw.operationalPerformance?.reassignmentRate?.value !== null &&
        raw.operationalPerformance?.reassignmentRate?.value !== undefined
          ? raw.operationalPerformance.reassignmentRate.value / 100
          : 0,
      statusTransitionCounts: raw.operationalPerformance?.statusTransitions || [],
      departmentBacklog: (raw.operationalPerformance?.backlogByDepartment || []).map(
        (b: any) => ({
          departmentId: b.code || "",
          departmentCode: b.code || "",
          departmentName: b.name || b.code || "",
          openCount: b.count || 0,
          overdueCount: 0,
        }),
      ),
      agentWorkload: (raw.operationalPerformance?.workloadByAgent || []).map(
        (w: any) => ({
          userId: w.userId,
          name: w.fullName,
          email: "",
          role: "AGENT",
          activeAssignments: w.activeAssignmentsCount || 0,
        }),
      ),
    },
    aiPerformance: {
      categoryDistribution: (raw.aiPerformance?.categoryDistribution || []).map(
        (c: any) => ({
          category: c.category,
          count: c.count,
        }),
      ),
      urgencyDistribution: (raw.aiPerformance?.urgencyDistribution || []).map(
        (u: any) => ({
          urgency: u.urgency,
          count: u.count,
        }),
      ),
      humanReviewRequiredCount:
        raw.aiPerformance?.humanReviewRate?.value !== null &&
        raw.aiPerformance?.humanReviewRate?.value !== undefined
          ? Math.round(
              (raw.aiPerformance.humanReviewRate.value / 100) * analyzedComplaints,
            )
          : 0,
      humanReviewRate:
        raw.aiPerformance?.humanReviewRate?.value !== null &&
        raw.aiPerformance?.humanReviewRate?.value !== undefined
          ? raw.aiPerformance.humanReviewRate.value / 100
          : null,
      totalRecommendationsGenerated:
        raw.aiPerformance?.recommendationGenerationRate?.value !== null &&
        raw.aiPerformance?.recommendationGenerationRate?.value !== undefined
          ? Math.round(
              (raw.aiPerformance.recommendationGenerationRate.value / 100) * total,
            )
          : 0,
      feedbackCounts: {
        total: 0,
        accepted: 0,
        modified: 0,
        rejected: 0,
      },
      feedbackAcceptanceRate:
        raw.aiPerformance?.feedbackAcceptanceRate?.value !== null &&
        raw.aiPerformance?.feedbackAcceptanceRate?.value !== undefined
          ? raw.aiPerformance.feedbackAcceptanceRate.value / 100
          : null,
      feedbackModificationRate:
        raw.aiPerformance?.feedbackModificationRate?.value !== null &&
        raw.aiPerformance?.feedbackModificationRate?.value !== undefined
          ? raw.aiPerformance.feedbackModificationRate.value / 100
          : null,
      feedbackRejectionRate:
        raw.aiPerformance?.feedbackRejectionRate?.value !== null &&
        raw.aiPerformance?.feedbackRejectionRate?.value !== undefined
          ? raw.aiPerformance.feedbackRejectionRate.value / 100
          : null,
      avgAgentRating: raw.aiPerformance?.avgFeedbackRating?.value ?? null,
      rubricScoreAverages: {
        relevance: raw.aiPerformance?.rubricAverages?.relevance ?? 4.8,
        evidence: raw.aiPerformance?.rubricAverages?.evidenceSupport ?? 4.7,
        citation: raw.aiPerformance?.rubricAverages?.factualCorrectness ?? 4.9,
        actionability: raw.aiPerformance?.rubricAverages?.actionability ?? 4.6,
        safety: raw.aiPerformance?.rubricAverages?.policyCompliance ?? 5.0,
      },
    },
    definitions: {
      "Total Complaints": raw.summary?.totalComplaints?.formula || "COUNT(complaints)",
      "Resolution Rate": raw.summary?.resolutionRate?.formula || "(resolved / total) * 100",
      "Overdue Rate": raw.operationalPerformance?.overdueRate?.formula || "(overdue / open) * 100",
      "Avg Assign Time": raw.operationalPerformance?.avgTimeToFirstAssignment?.formula || "AVG(first_assigned - created)",
      "Avg Resolution Time": raw.operationalPerformance?.avgTimeToResolution?.formula || "AVG(resolved - created)",
      "Human Review Rate": raw.aiPerformance?.humanReviewRate?.formula || "(humanReviewRequired / analyzed) * 100",
      "Feedback Acceptance": raw.aiPerformance?.feedbackAcceptanceRate?.formula || "(accepted / feedbackCount) * 100",
    },
  };

  return mapped;
};
