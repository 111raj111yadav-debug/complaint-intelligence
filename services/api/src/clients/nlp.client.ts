import axios, { AxiosInstance } from "axios";
import { env } from "../config/env.js";

export interface NlpServiceStatus {
  available: boolean;
  latencyMs?: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface NlpPingResult {
  success: boolean;
  echo?: string;
  notice?: string;
  error?: string;
}

export interface NlpCategoryData {
  label: string;
  confidence: number;
  probabilities?: Record<string, number>;
  model_version: string;
}

export interface NlpSentimentData {
  label: string;
  score: number;
  compound?: number;
  scores?: Record<string, number>;
  model_identifier: string;
}

export interface NlpEmotionData {
  primary: string;
  confidence: number;
  scores?: Record<string, number>;
  secondary?: string[];
  model_identifier: string;
}

export interface NlpUrgencyReason {
  rule_id: string;
  rule_name: string;
  weight: number;
  matched_term: string;
  description: string;
}

export interface NlpUrgencyData {
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number;
  contributing_reasons: NlpUrgencyReason[];
  human_review_required: boolean;
}

export interface NlpDepartmentData {
  code: string;
  name: string;
  rationale: string;
  is_fallback?: boolean;
}

export interface NlpAnalysisData {
  text_preview: string;
  char_count: number;
  word_count: number;
  category: NlpCategoryData;
  sentiment: NlpSentimentData;
  emotion: NlpEmotionData;
  urgency: NlpUrgencyData;
  recommended_department: NlpDepartmentData;
  model_versions: Record<string, string>;
  analysis_timestamp: string;
  status: string;
}

export interface NlpAnalysisResult {
  success: boolean;
  data?: NlpAnalysisData;
  error?: string;
  code?: string;
  statusCode?: number;
}

export interface NlpRetrievedResolution {
  id: string;
  reference_code: string;
  title: string;
  complaint_text: string;
  resolution_text: string;
  resolution_outcome: string;
  category: string;
  department_code: string;
  similarity_score: number;
  is_verified: boolean;
  verification_status: string;
  data_source: string;
  provenance: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface NlpSearchData {
  query: string;
  query_preview: string;
  similarity_threshold: number;
  top_k: number;
  category_filter?: string | null;
  department_filter?: string | null;
  matched_count: number;
  is_empty: boolean;
  empty_reason?: string | null;
  results: NlpRetrievedResolution[];
}

export interface NlpSearchResult {
  success: boolean;
  data?: NlpSearchData;
  error?: string;
  code?: string;
  statusCode?: number;
}

export interface NlpSupportingSource {
  source_id: string;
  reference_code: string;
  title: string;
  category: string;
  similarity_score: number;
  resolution_outcome: string;
}

export interface NlpRecommendationData {
  suggested_steps: string[];
  rationale: string;
  supporting_sources: NlpSupportingSource[];
  evidence_strength: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
  confidence_score: number;
  evidence_limitations: string[];
  human_review_required: boolean;
  review_reasons: string[];
  model_provider: string;
  model_identifier: string;
  prompt_version: string;
  retrieval_matched_count: number;
  total_latency_ms: number;
}

export interface NlpRecommendationResult {
  success: boolean;
  data?: NlpRecommendationData;
  error?: string;
  code?: string;
  statusCode?: number;
}

export class NlpClient {
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;

  constructor(
    baseUrl: string = env.NLP_SERVICE_URL,
    timeoutSeconds: number = env.NLP_TIMEOUT_SECONDS,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: timeoutSeconds * 1000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Complaint-Express-API/0.1.0",
      },
    });
  }

  /**
   * Invokes the NLP microservice to analyze a customer complaint narrative.
   */
  async analyzeText(text: string): Promise<NlpAnalysisResult> {
    try {
      const response = await this.client.post<{
        success: boolean;
        data: NlpAnalysisData;
      }>("/api/v1/analyze", { text });
      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorDetail = error.response?.data?.detail;
        const code =
          errorDetail?.code ||
          (error.code === "ECONNREFUSED"
            ? "NLP_SERVICE_UNAVAILABLE"
            : error.code === "ECONNABORTED"
              ? "NLP_TIMEOUT"
              : "NLP_COMMUNICATION_ERROR");
        const message =
          errorDetail?.message ||
          error.message ||
          "Failed to communicate with NLP microservice.";
        const statusCode = error.response?.status || 502;
        return {
          success: false,
          code,
          error: message,
          statusCode,
        };
      }
      return {
        success: false,
        code: "NLP_UNKNOWN_ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error during NLP analysis.",
        statusCode: 500,
      };
    }
  }

  /**
   * Checks the liveness endpoint of the Python NLP microservice.
   */
  async checkHealth(): Promise<NlpServiceStatus> {
    const start = Date.now();
    try {
      const response = await this.client.get("/health");
      return {
        available: response.status === 200,
        latencyMs: Date.now() - start,
        data: response.data,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      if (axios.isAxiosError(error)) {
        return {
          available: false,
          latencyMs,
          error:
            error.code === "ECONNREFUSED"
              ? "NLP microservice is currently unreachable."
              : error.code === "ECONNABORTED"
                ? "NLP microservice health check timed out."
                : error.message || "NLP microservice communication error.",
        };
      }
      return {
        available: false,
        latencyMs,
        error:
          error instanceof Error
            ? error.message
            : "Unknown communication error",
      };
    }
  }

  /**
   * Checks the readiness endpoint of the Python NLP microservice.
   */
  async checkReadiness(): Promise<NlpServiceStatus> {
    const start = Date.now();
    try {
      const response = await this.client.get("/ready");
      return {
        available: response.status === 200,
        latencyMs: Date.now() - start,
        data: response.data,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      if (axios.isAxiosError(error)) {
        return {
          available: false,
          latencyMs,
          error: error.message || "NLP service not ready",
        };
      }
      return {
        available: false,
        latencyMs,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Sends a ping to verify communication (Phase 0 Foundation verification).
   */
  async sendPing(message: string): Promise<NlpPingResult> {
    try {
      const response = await this.client.post("/api/v1/foundation/ping", {
        message,
        source: "express-api",
      });
      return {
        success: true,
        echo: response.data.echo,
        notice: response.data.notice,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.error?.message || error.message,
        };
      }
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to communicate with NLP service",
      };
    }
  }

  /**
   * Invokes the NLP microservice to perform semantic similarity search over historical resolutions.
   */
  async searchResolutions(params: {
    query: string;
    top_k?: number;
    similarity_threshold?: number;
    category_filter?: string | null;
    department_filter?: string | null;
    only_verified?: boolean;
  }): Promise<NlpSearchResult> {
    try {
      const response = await this.client.post<{
        success: boolean;
        data: NlpSearchData;
      }>("/api/v1/resolutions/search", params);
      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorDetail = error.response?.data?.detail;
        const code =
          errorDetail?.code ||
          (error.code === "ECONNREFUSED"
            ? "NLP_SERVICE_UNAVAILABLE"
            : error.code === "ECONNABORTED"
              ? "NLP_TIMEOUT"
              : "NLP_COMMUNICATION_ERROR");
        const message =
          errorDetail?.message ||
          error.message ||
          "Failed to execute semantic resolution search.";
        const statusCode = error.response?.status || 502;
        return {
          success: false,
          code,
          error: message,
          statusCode,
        };
      }
      return {
        success: false,
        code: "NLP_UNKNOWN_ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error during semantic search.",
        statusCode: 500,
      };
    }
  }

  /**
   * Invokes the NLP microservice to generate an evidence-grounded RAG recommendation.
   */
  async generateRecommendation(params: {
    complaint_text: string;
    predicted_category?: string | null;
    urgency_level?: string | null;
    department_code?: string | null;
    similarity_threshold?: number;
    top_k?: number;
    force_provider?: string | null;
  }): Promise<NlpRecommendationResult> {
    try {
      const response = await this.client.post<{
        success: boolean;
        data: NlpRecommendationData;
      }>("/api/v1/recommendations/generate", params);
      return {
        success: true,
        data: response.data.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorDetail = error.response?.data?.detail;
        const code =
          errorDetail?.code ||
          (error.code === "ECONNREFUSED"
            ? "NLP_SERVICE_UNAVAILABLE"
            : error.code === "ECONNABORTED"
              ? "NLP_TIMEOUT"
              : "NLP_COMMUNICATION_ERROR");
        const message =
          errorDetail?.message ||
          error.message ||
          "Failed to generate resolution recommendation.";
        const statusCode = error.response?.status || 502;
        return {
          success: false,
          code,
          error: message,
          statusCode,
        };
      }
      return {
        success: false,
        code: "NLP_UNKNOWN_ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error during recommendation generation.",
        statusCode: 500,
      };
    }
  }
}

export const nlpClient = new NlpClient();
