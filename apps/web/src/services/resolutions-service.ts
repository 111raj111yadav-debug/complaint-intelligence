import { apiClient } from "../lib/api-client.js";
import {
  ApiResponse,
  ResolutionItem,
  ResolutionRecommendationItem,
  RecommendationFeedbackItem,
  PaginationMeta,
} from "../types/index.js";

export interface FetchResolutionsParams {
  page?: number;
  limit?: number;
  category?: string;
  departmentCode?: string;
  isVerified?: boolean;
  search?: string;
}

export interface FetchResolutionsResponse {
  resolutions: ResolutionItem[];
  pagination: PaginationMeta;
}

export interface SearchResolutionsParams {
  query: string;
  top_k?: number;
  similarity_threshold?: number;
  category_filter?: string | null;
  department_filter?: string | null;
  only_verified?: boolean;
}

export interface SearchResolutionsData {
  query: string;
  query_preview: string;
  similarity_threshold: number;
  top_k: number;
  category_filter?: string | null;
  matched_count: number;
  is_empty: boolean;
  empty_reason?: string | null;
  results: Array<
    ResolutionItem & {
      similarity_score: number;
      complaint_text: string;
      resolution_text: string;
      resolution_outcome: string;
      department_code: string;
      reference_code: string;
      is_verified: boolean;
    }
  >;
}

export interface GenerateRecommendationParams {
  force_provider?: string | null;
  top_k?: number;
  similarity_threshold?: number;
}

export interface RecommendationFeedbackPayload {
  wasAccepted?: boolean;
  feedbackDecision?: "ACCEPTED" | "MODIFIED" | "REJECTED";
  rejectionReason?: string;
  agentModifications?: string;
  agentRating?: number;
  rubricScores?: {
    relevance?: number;
    evidence?: number;
    citation?: number;
    actionability?: number;
    safety?: number;
  };
  feedbackNotes?: string;
  submittedBy?: string;
}

/**
 * Fetches historical resolution playbooks with pagination and filters.
 */
export async function fetchResolutions(
  params: FetchResolutionsParams = {},
): Promise<FetchResolutionsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page.toString());
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.category) searchParams.append("category", params.category);
  if (params.departmentCode)
    searchParams.append("departmentCode", params.departmentCode);
  if (typeof params.isVerified === "boolean")
    searchParams.append("isVerified", params.isVerified.toString());
  if (params.search) searchParams.append("search", params.search);

  const url = `/resolutions${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const response = await apiClient.get<ApiResponse<ResolutionItem[]>>(url);

  if (!response.data.data) {
    throw new Error(
      response.data.error?.message || "Failed to load resolutions from API.",
    );
  }

  return {
    resolutions: response.data.data,
    pagination: response.data.meta?.pagination || {
      page: params.page || 1,
      limit: params.limit || 10,
      total: response.data.data.length,
      totalPages: 1,
    },
  };
}

/**
 * Fetches a single resolution playbook by ID.
 */
export async function fetchResolutionById(id: string): Promise<ResolutionItem> {
  const response = await apiClient.get<ApiResponse<ResolutionItem>>(
    `/resolutions/${id}`,
  );
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message || "Failed to load resolution detail.",
    );
  }
  return response.data.data;
}

/**
 * Executes vector semantic similarity search across historical resolutions.
 */
export async function searchResolutions(
  params: SearchResolutionsParams,
): Promise<SearchResolutionsData> {
  const response = await apiClient.post<ApiResponse<SearchResolutionsData>>(
    "/resolutions/search",
    params,
  );
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message || "Semantic resolution search failed.",
    );
  }
  return response.data.data;
}

/**
 * Generates an evidence-grounded RAG recommendation for a complaint.
 */
export async function generateRecommendation(
  complaintId: string,
  params?: GenerateRecommendationParams,
): Promise<ResolutionRecommendationItem> {
  const response = await apiClient.post<
    ApiResponse<ResolutionRecommendationItem>
  >(`/complaints/${complaintId}/recommendation`, params || {});
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message ||
        "Failed to generate resolution recommendation.",
    );
  }
  return response.data.data;
}

/**
 * Fetches the latest generated recommendation for a complaint.
 */
export async function fetchComplaintRecommendation(
  complaintId: string,
): Promise<ResolutionRecommendationItem | null> {
  const response = await apiClient.get<
    ApiResponse<ResolutionRecommendationItem | null>
  >(`/complaints/${complaintId}/recommendation`);
  return response.data.data || null;
}

/**
 * Records human dispute officer feedback on a recommendation.
 */
export async function submitRecommendationFeedback(
  complaintId: string,
  feedback: RecommendationFeedbackPayload,
): Promise<RecommendationFeedbackItem> {
  const response = await apiClient.post<
    ApiResponse<RecommendationFeedbackItem>
  >(`/complaints/${complaintId}/recommendation/feedback`, feedback);
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message ||
        "Failed to submit recommendation feedback.",
    );
  }
  return response.data.data;
}
