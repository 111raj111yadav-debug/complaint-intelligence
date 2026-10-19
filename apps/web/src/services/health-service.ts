import { apiClient } from "../lib/api-client.js";
import { ApiResponse, SystemHealthData } from "../types/index.js";

export async function fetchSystemHealth(): Promise<SystemHealthData> {
  const response =
    await apiClient.get<ApiResponse<SystemHealthData>>("/health");
  if (!response.data.data) {
    throw new Error("Malformed health response received from server.");
  }
  return response.data.data;
}

export async function fetchSystemReadiness(): Promise<SystemHealthData> {
  const response =
    await apiClient.get<ApiResponse<SystemHealthData>>("/health/ready");
  if (!response.data.data) {
    throw new Error("Malformed readiness response received from server.");
  }
  return response.data.data;
}

export async function sendNlpPing(
  message: string,
): Promise<Record<string, unknown>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    "/health/nlp-ping",
    {
      message,
    },
  );
  return response.data.data || {};
}
