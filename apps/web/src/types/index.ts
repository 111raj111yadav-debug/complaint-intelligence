export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: {
    pagination?: PaginationMeta;
    [key: string]: unknown;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type UserRole = "ADMIN" | "MANAGER" | "AGENT" | "AUDITOR";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  departmentId?: string | null;
  department?: Department | null;
}

export interface SystemHealthData {
  status: string;
  service: string;
  timestamp: string;
  uptimeSeconds?: number;
  environment?: string;
  dependencies?: {
    database: {
      healthy: boolean;
      latencyMs: number;
      error?: string;
    };
    nlpMicroservice: {
      available: boolean;
      latencyMs?: number;
      error?: string;
    };
  };
}

export interface NavItem {
  name: string;
  href: string;
  icon: string;
  description: string;
  badge?: string;
}

export type ComplaintStatus =
  | "PENDING"
  | "ANALYZED"
  | "IN_REVIEW"
  | "RESOLVED"
  | "DISMISSED";

export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UrgencyReason {
  rule_id: string;
  rule_name: string;
  weight: number;
  matched_term: string;
  description: string;
}

export interface ComplaintAnalysisItem {
  id: string;
  complaintId?: string;
  predictedCategory: string;
  categoryConfidence: number;
  categoryProbabilities?: Record<string, number>;

  sentimentLabel: string;
  sentimentScore?: number;
  sentimentCompound?: number;
  sentimentScores?: {
    positive?: number;
    neutral?: number;
    negative?: number;
    compound?: number;
  };

  emotionPrimary: string;
  emotionConfidence?: number;
  emotionScores?: Record<string, number>;
  emotionSecondary?: string[];

  urgencyLevel: UrgencyLevel;
  urgencyScore: number;
  urgencyReasons?: UrgencyReason[];
  humanReviewRequired: boolean;

  departmentCode: string;
  departmentName?: string;
  recommendedDepartment?: Department | null;
  recommendedDepartmentId?: string | null;

  modelVersions?: Record<string, string>;
  analysisTimestamp?: string;
  analyzedAt?: string;
  status?: string;
  errorMessage?: string | null;
}

export interface ComplaintAuditLogItem {
  id: string;
  complaintId: string;
  actorId?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
}

export interface AssignmentItem {
  id: string;
  complaintId: string;
  departmentId: string;
  assignedToUserId?: string | null;
  assignedByUserId?: string | null;
  priority: string;
  isCurrent: boolean;
  reassignReason?: string | null;
  completedAt?: string | null;
  createdAt: string;
  department?: Department;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  assignedBy?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
}

export interface ComplaintItem {
  id: string;
  referenceNumber: string;
  originalText: string;
  sanitizedText?: string | null;
  source: string;
  status: ComplaintStatus;
  firstAssignedAt?: string | null;
  resolvedAt?: string | null;
  slaDeadline?: string | null;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
  analyses?: ComplaintAnalysisItem[];
  latestAnalysis?: ComplaintAnalysisItem | null;
  recommendations?: ResolutionRecommendationItem[];
  assignments?: AssignmentItem[];
  auditLogs?: ComplaintAuditLogItem[];
}

export type EvidenceStrength = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface ResolutionItem {
  id: string;
  referenceCode: string;
  title: string;
  complaintText: string;
  resolutionText: string;
  resolutionOutcome: string;
  category: string;
  departmentCode: string;
  isVerified: boolean;
  verificationStatus: string;
  dataSource: string;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  sourceOrg?: string | null;
  contentType?: string | null;
  version?: string | null;
  lastVerifiedAt?: string | null;
  provenance?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  embeddingStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationSourceItem {
  id: string;
  recommendationId: string;
  resolutionId: string;
  similarityScore: number;
  rank: number;
  citationReason?: string | null;
  resolution?: ResolutionItem;
}

export interface RecommendationFeedbackItem {
  id: string;
  recommendationId: string;
  wasAccepted: boolean;
  feedbackDecision?: "ACCEPTED" | "MODIFIED" | "REJECTED";
  rejectionReason?: string | null;
  agentModifications?: string | null;
  agentRating?: number | null;
  rubricScores?: Record<string, number> | null;
  feedbackNotes?: string | null;
  submittedBy?: string | null;
  userId?: string | null;
  user?: {
    id: string;
    name: string;
    role: UserRole;
  } | null;
  createdAt: string;
}

export interface ResolutionRecommendationItem {
  id: string;
  complaintId: string;
  suggestedSteps: string[];
  rationale: string;
  evidenceStrength: EvidenceStrength;
  confidenceScore: number;
  evidenceLimitations: string[];
  humanReviewRequired: boolean;
  reviewReasons: string[];
  modelProvider: string;
  modelIdentifier: string;
  promptVersion: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  sources?: RecommendationSourceItem[];
  feedback?: RecommendationFeedbackItem | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OperationalAnalyticsData {
  timeRange: {
    preset: string;
    from: string | null;
    to: string;
  };
  volume: {
    totalComplaints: number;
    openComplaints: number;
    inReviewComplaints: number;
    resolvedComplaints: number;
    dismissedComplaints: number;
    resolutionRate: number;
    analyzedComplaints: number;
    statusDistribution: Array<{ status: string; count: number }>;
    byCategory: Array<{ category: string; count: number }>;
    byDepartment: Array<{ department: string; count: number }>;
    byChannel: Array<{ channel: string; count: number }>;
  };
  operations: {
    avgTimeToFirstAssignmentHours: number | null;
    medianTimeToFirstAssignmentHours: number | null;
    avgTimeToResolutionHours: number | null;
    medianTimeToResolutionHours: number | null;
    overdueCount: number;
    overdueRate: number;
    reassignmentRate: number;
    statusTransitionCounts: Array<{ action: string; count: number }>;
    departmentBacklog: Array<{
      departmentId: string;
      departmentCode: string;
      departmentName: string;
      openCount: number;
      overdueCount: number;
    }>;
    agentWorkload: Array<{
      userId: string;
      name: string;
      email: string;
      role: string;
      activeAssignments: number;
    }>;
  };
  aiPerformance: {
    categoryDistribution: Array<{ category: string; count: number }>;
    urgencyDistribution: Array<{ urgency: string; count: number }>;
    humanReviewRequiredCount: number;
    humanReviewRate: number | null;
    totalRecommendationsGenerated: number;
    feedbackCounts: {
      total: number;
      accepted: number;
      modified: number;
      rejected: number;
    };
    feedbackAcceptanceRate: number | null;
    feedbackModificationRate: number | null;
    feedbackRejectionRate: number | null;
    avgAgentRating: number | null;
    rubricScoreAverages: {
      relevance: number;
      evidence: number;
      citation: number;
      actionability: number;
      safety: number;
    };
  };
  definitions: Record<string, string>;
}
