import { Request, Response } from "express";
import { analyticsService } from "./analytics.service.js";
import { sendSuccess } from "../../lib/response.js";

export class AnalyticsController {
  async getOverview(req: Request, res: Response) {
    const { startDate, endDate, departmentId } = req.query as {
      startDate?: string;
      endDate?: string;
      departmentId?: string;
    };

    const overview = await analyticsService.getOperationalOverview({
      startDate,
      endDate,
      departmentId,
    });

    return sendSuccess(res, overview, 200);
  }
}

export const analyticsController = new AnalyticsController();
