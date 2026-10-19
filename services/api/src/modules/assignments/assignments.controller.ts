import { Request, Response } from "express";
import { assignmentsService } from "./assignments.service.js";
import { sendSuccess } from "../../lib/response.js";

export class AssignmentsController {
  async listAssignments(req: Request, res: Response) {
    const { complaintId, departmentId, assignedToUserId, isCurrent, status, limit } = req.query as {
      complaintId?: string;
      departmentId?: string;
      assignedToUserId?: string;
      isCurrent?: boolean;
      status?: string;
      limit?: number;
    };

    const assignments = await assignmentsService.listAssignments({
      complaintId,
      departmentId,
      assignedToUserId,
      isCurrent,
      status,
      limit,
    });

    return sendSuccess(res, assignments, 200);
  }

  async createAssignment(req: Request, res: Response) {
    const assignment = await assignmentsService.createAssignment(req.body, req.user);
    return sendSuccess(res, assignment, 201);
  }
}

export const assignmentsController = new AssignmentsController();
