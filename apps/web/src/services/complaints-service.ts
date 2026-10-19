import { apiClient } from "../lib/api-client.js";
import {
  ApiResponse,
  ComplaintItem,
  ComplaintAnalysisItem,
  AssignmentItem,
  PaginationMeta,
} from "../types/index.js";

export interface FetchComplaintsParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  urgency?: string;
  search?: string;
}

export interface FetchComplaintsResponse {
  complaints: ComplaintItem[];
  pagination: PaginationMeta;
}

/**
 * Fetches a paginated list of complaints with search and status/urgency filters.
 */
export async function fetchComplaints(
  params: FetchComplaintsParams = {},
): Promise<FetchComplaintsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append("page", params.page.toString());
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.status) searchParams.append("status", params.status);
  if (params.category) searchParams.append("category", params.category);
  if (params.urgency) searchParams.append("urgency", params.urgency);
  if (params.search) searchParams.append("search", params.search);

  const url = `/complaints${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const response = await apiClient.get<ApiResponse<ComplaintItem[]>>(url);

  if (!response.data.data) {
    throw new Error(
      response.data.error?.message || "Failed to load complaints from API.",
    );
  }

  return {
    complaints: response.data.data,
    pagination: response.data.meta?.pagination || {
      page: params.page || 1,
      limit: params.limit || 10,
      total: response.data.data.length,
      totalPages: 1,
    },
  };
}

/**
 * Submits and persists a new customer complaint.
 */
export async function createComplaint(data: {
  text: string;
  source?: string;
}): Promise<ComplaintItem> {
  const response = await apiClient.post<ApiResponse<ComplaintItem>>(
    "/complaints",
    data,
  );
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message || "Failed to submit customer complaint.",
    );
  }
  return response.data.data;
}

/**
 * Fetches single complaint by ID with all historical analyses, assignments, and audit logs.
 */
export async function fetchComplaintById(id: string): Promise<ComplaintItem> {
  const response = await apiClient.get<ApiResponse<ComplaintItem>>(
    `/complaints/${id}`,
  );
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message || "Failed to retrieve complaint detail.",
    );
  }
  return response.data.data;
}

/**
 * Triggers real NLP analysis on an existing complaint and returns the persisted analysis.
 */
export async function analyzeComplaint(
  id: string,
): Promise<ComplaintAnalysisItem> {
  const response = await apiClient.post<ApiResponse<ComplaintAnalysisItem>>(
    `/complaints/${id}/analyze`,
  );
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message ||
        "NLP analysis failed or service unreachable.",
    );
  }
  return response.data.data;
}

/**
 * Updates complaint status with optional reason (mandatory for reopening).
 */
export async function updateComplaintStatus(
  id: string,
  status: string,
  reason?: string,
): Promise<ComplaintItem> {
  const response = await apiClient.patch<ApiResponse<ComplaintItem>>(
    `/complaints/${id}`,
    { status, reason },
  );
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message || "Failed to update complaint status.",
    );
  }
  return response.data.data;
}

/**
 * Assigns or reassigns a complaint to a department and/or specific agent.
 */
export async function assignComplaint(payload: {
  complaintId: string;
  departmentId: string;
  assignedToUserId?: string;
  priority?: string;
  reassignReason?: string;
}): Promise<AssignmentItem> {
  const response = await apiClient.post<ApiResponse<AssignmentItem>>(
    "/assignments",
    payload,
  );
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message || "Failed to record complaint assignment.",
    );
  }
  return response.data.data;
}

/**
 * Fetches assignment history for a complaint.
 */
export async function fetchAssignments(
  complaintId?: string,
): Promise<AssignmentItem[]> {
  const url = complaintId
    ? `/assignments?complaintId=${complaintId}`
    : "/assignments";
  const response = await apiClient.get<ApiResponse<AssignmentItem[]>>(url);
  if (!response.data.data) {
    throw new Error(
      response.data.error?.message || "Failed to load assignment history.",
    );
  }
  return response.data.data;
}

/**
 * Convenience workflow: persists a complaint and immediately executes NLP analysis.
 */
export async function submitAndAnalyzeComplaint(
  text: string,
  source = "SANDBOX",
): Promise<{ complaint: ComplaintItem; analysis: ComplaintAnalysisItem }> {
  const complaint = await createComplaint({ text, source });
  const analysis = await analyzeComplaint(complaint.id);
  return { complaint, analysis };
}
