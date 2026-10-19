import { Request, Response } from "express";
import { complaintsService } from "./complaints.service.js";
import { sendSuccess } from "../../lib/response.js";
import { ComplaintStatus, UrgencyLevel } from "@prisma/client";

export class ComplaintsController {
  async listComplaints(req: Request, res: Response) {
    const {
      page,
      limit,
      status,
      category,
      urgency,
      search,
      departmentId,
      assignedToUserId,
      isOverdue,
      humanReviewRequired,
    } = req.query as {
      page?: number;
      limit?: number;
      status?: ComplaintStatus;
      category?: string;
      urgency?: UrgencyLevel;
      search?: string;
      departmentId?: string;
      assignedToUserId?: string;
      isOverdue?: boolean;
      humanReviewRequired?: boolean;
    };

    const result = await complaintsService.listComplaints({
      page,
      limit,
      status,
      category,
      urgency,
      search,
      departmentId,
      assignedToUserId,
      isOverdue,
      humanReviewRequired,
    });

    return sendSuccess(res, result.complaints, 200, {
      pagination: result.pagination,
    });
  }

  async createComplaint(req: Request, res: Response) {
    const { text, source } = req.body as { text: string; source?: string };
    const complaint = await complaintsService.createComplaint({ text, source });
    return sendSuccess(res, complaint, 201);
  }

  async getComplaintById(req: Request, res: Response) {
    const id = req.params.id as string;
    const complaint = await complaintsService.getComplaintById(id);
    return sendSuccess(res, complaint, 200);
  }

  async updateComplaint(req: Request, res: Response) {
    const id = req.params.id as string;
    const { status, reason, notes } = req.body as {
      status?: ComplaintStatus;
      reason?: string;
      notes?: string;
    };
    const updated = await complaintsService.updateComplaint(
      id,
      { status, reason, notes },
      req.user,
    );
    return sendSuccess(res, updated, 200);
  }

  async analyzeComplaint(req: Request, res: Response) {
    const id = req.params.id as string;
    const analysis = await complaintsService.analyzeComplaint(id, req.user);
    return sendSuccess(res, analysis, 200);
  }

  async getLatestAnalysis(req: Request, res: Response) {
    const id = req.params.id as string;
    const analysis = await complaintsService.getLatestAnalysis(id);
    return sendSuccess(res, analysis, 200);
  }
}

export const complaintsController = new ComplaintsController();
