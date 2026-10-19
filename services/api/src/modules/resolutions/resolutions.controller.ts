import { Request, Response } from "express";
import { resolutionsService } from "./resolutions.service.js";
import { sendSuccess } from "../../lib/response.js";

export class ResolutionsController {
  async listResolutions(req: Request, res: Response) {
    const { page, limit, category, departmentCode, contentType, verificationStatus, isVerified, search } =
      req.query as {
        page?: number;
        limit?: number;
        category?: string;
        departmentCode?: string;
        contentType?: string;
        verificationStatus?: string;
        isVerified?: boolean;
        search?: string;
      };

    const result = await resolutionsService.listResolutions({
      page,
      limit,
      category,
      departmentCode,
      contentType,
      verificationStatus,
      isVerified,
      search,
    });

    return sendSuccess(res, result.resolutions, 200, {
      pagination: result.pagination,
    });
  }

  async getResolutionById(req: Request, res: Response) {
    const id = req.params.id as string;
    const resolution = await resolutionsService.getResolutionById(id);
    return sendSuccess(res, resolution, 200);
  }

  async searchResolutions(req: Request, res: Response) {
    const {
      query,
      top_k,
      similarity_threshold,
      category_filter,
      department_filter,
      only_verified,
    } = req.body;

    const result = await resolutionsService.searchResolutions({
      query,
      top_k,
      similarity_threshold,
      category_filter,
      department_filter,
      only_verified,
    });

    return sendSuccess(res, result, 200);
  }

  async createResolution(req: Request, res: Response) {
    const resolution = await resolutionsService.createResolution(req.body);
    return sendSuccess(res, resolution, 201);
  }
}

export const resolutionsController = new ResolutionsController();
