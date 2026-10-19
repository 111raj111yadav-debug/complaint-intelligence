import { prisma } from "../../lib/prisma.js";
import { nlpClient } from "../../clients/nlp.client.js";
import { AppError } from "../../middleware/error.js";
import { Prisma } from "@prisma/client";

export interface ListResolutionsOptions {
  page?: number;
  limit?: number;
  category?: string;
  departmentCode?: string;
  contentType?: string;
  verificationStatus?: string;
  isVerified?: boolean;
  search?: string;
}

export interface CreateResolutionData {
  referenceCode?: string;
  title: string;
  category: string;
  departmentCode: string;
  complaintText: string;
  resolutionText: string;
  resolutionOutcome: string;
  actionSteps: string[];
  isVerified?: boolean;
  verificationStatus?: string;
  dataSource?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceOrg?: string;
  contentType?: string;
  version?: string;
  lastVerifiedAt?: Date;
  provenance?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class ResolutionsService {
  private selectResolutionFields = {
    id: true,
    referenceCode: true,
    title: true,
    category: true,
    departmentCode: true,
    complaintText: true,
    resolutionText: true,
    resolutionOutcome: true,
    isVerified: true,
    verificationStatus: true,
    dataSource: true,
    sourceTitle: true,
    sourceUrl: true,
    sourceOrg: true,
    contentType: true,
    version: true,
    lastVerifiedAt: true,
    provenance: true,
    metadata: true,
    embeddingModel: true,
    embeddingStatus: true,
    createdAt: true,
    updatedAt: true,
  };

  /**
   * Retrieves a paginated list of historical resolutions with filtering, provenance, and search.
   */
  async listResolutions(options: ListResolutionsOptions) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ResolutionWhereInput = {};

    if (options.category) {
      where.category = options.category;
    }

    if (options.departmentCode) {
      where.departmentCode = options.departmentCode;
    }

    if (options.contentType) {
      where.contentType = options.contentType;
    }

    if (options.verificationStatus) {
      where.verificationStatus = options.verificationStatus;
    }

    if (typeof options.isVerified === "boolean") {
      where.isVerified = options.isVerified;
    }

    if (options.search) {
      where.OR = [
        { referenceCode: { contains: options.search, mode: "insensitive" } },
        { title: { contains: options.search, mode: "insensitive" } },
        { complaintText: { contains: options.search, mode: "insensitive" } },
        { resolutionText: { contains: options.search, mode: "insensitive" } },
        { sourceTitle: { contains: options.search, mode: "insensitive" } },
        { sourceOrg: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const [total, resolutions] = await Promise.all([
      prisma.resolution.count({ where }),
      prisma.resolution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: this.selectResolutionFields,
      }),
    ]);

    return {
      resolutions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single resolution by ID.
   */
  async getResolutionById(id: string) {
    const resolution = await prisma.resolution.findUnique({
      where: { id },
      select: this.selectResolutionFields,
    });

    if (!resolution) {
      throw new AppError(
        `Resolution with ID ${id} was not found.`,
        404,
        "RESOLUTION_NOT_FOUND",
      );
    }

    return resolution;
  }

  /**
   * Proxies semantic similarity search to the Python NLP vector retrieval service.
   */
  async searchResolutions(params: {
    query: string;
    top_k?: number;
    similarity_threshold?: number;
    category_filter?: string | null;
    department_filter?: string | null;
    only_verified?: boolean;
  }) {
    const result = await nlpClient.searchResolutions(params);
    if (!result.success || !result.data) {
      throw new AppError(
        result.error || "Failed to execute semantic search across resolutions.",
        result.statusCode || 502,
        result.code || "SEARCH_SERVICE_ERROR",
      );
    }
    return result.data;
  }

  /**
   * Creates a new resolution playbook in the knowledge base.
   */
  async createResolution(data: CreateResolutionData) {
    const referenceCode =
      data.referenceCode ||
      `KB-RES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const resolution = await prisma.resolution.create({
      data: {
        referenceCode,
        title: data.title,
        category: data.category,
        departmentCode: data.departmentCode,
        complaintText: data.complaintText,
        resolutionText: data.resolutionText,
        resolutionOutcome: data.resolutionOutcome,
        isVerified: data.isVerified ?? true,
        verificationStatus: data.verificationStatus || "VERIFIED",
        dataSource: data.dataSource || "CFPB_HISTORICAL_DISPUTES",
        sourceTitle: data.sourceTitle || data.title,
        sourceUrl: data.sourceUrl || null,
        sourceOrg: data.sourceOrg || null,
        contentType: data.contentType || "REGULATORY_PLAYBOOK",
        version: data.version || "1.0.0",
        lastVerifiedAt: data.lastVerifiedAt || new Date(),
        provenance: data.provenance as Prisma.InputJsonValue | undefined,
        metadata: {
          ...(data.metadata || {}),
          actionSteps: data.actionSteps,
        } as Prisma.InputJsonValue,
        embeddingStatus: "PENDING",
      },
      select: this.selectResolutionFields,
    });

    return resolution;
  }
}

export const resolutionsService = new ResolutionsService();
