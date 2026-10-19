import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { Prisma } from "@prisma/client";
import { AuthUserPayload } from "../../lib/jwt.js";

export interface ListAssignmentsOptions {
  complaintId?: string;
  departmentId?: string;
  assignedToUserId?: string;
  isCurrent?: boolean;
  status?: string;
  limit?: number;
}

export interface CreateAssignmentData {
  complaintId: string;
  departmentId: string;
  assignedToUserId?: string;
  assignedBy?: string;
  assignedTo?: string;
  notes?: string;
  reassignReason?: string;
  status?: string;
}

export class AssignmentsService {
  async listAssignments(options: ListAssignmentsOptions) {
    const where: Prisma.AssignmentWhereInput = {};

    if (options.complaintId) {
      where.complaintId = options.complaintId;
    }

    if (options.departmentId) {
      where.departmentId = options.departmentId;
    }

    if (options.assignedToUserId) {
      where.assignedToUserId = options.assignedToUserId;
    }

    if (options.isCurrent !== undefined) {
      where.isCurrent = options.isCurrent;
    }

    if (options.status) {
      where.status = options.status;
    }

    return prisma.assignment.findMany({
      where,
      take: options.limit || 50,
      orderBy: { createdAt: "desc" },
      include: {
        complaint: {
          select: {
            id: true,
            referenceNumber: true,
            status: true,
            createdAt: true,
            firstAssignedAt: true,
            slaDeadline: true,
            isOverdue: true,
          },
        },
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        assignedToUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        assignedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async createAssignment(data: CreateAssignmentData, actorUser?: AuthUserPayload) {
    // 1. Validate complaint existence
    const complaint = await prisma.complaint.findUnique({
      where: { id: data.complaintId },
      select: { id: true, status: true, firstAssignedAt: true },
    });
    if (!complaint) {
      throw new AppError(
        `Complaint with ID ${data.complaintId} was not found.`,
        404,
        "COMPLAINT_NOT_FOUND",
      );
    }

    // 2. Validate department existence
    const department = await prisma.department.findUnique({
      where: { id: data.departmentId },
      select: { id: true, name: true, code: true },
    });
    if (!department) {
      throw new AppError(
        `Department with ID ${data.departmentId} was not found.`,
        404,
        "DEPARTMENT_NOT_FOUND",
      );
    }

    // 3. Validate assigned user if specified
    let assignedUserName = data.assignedTo || null;
    if (data.assignedToUserId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: data.assignedToUserId },
        select: { id: true, fullName: true, isActive: true },
      });
      if (!targetUser) {
        throw new AppError(`User with ID ${data.assignedToUserId} was not found.`, 404, "USER_NOT_FOUND");
      }
      if (!targetUser.isActive) {
        throw new AppError("Cannot assign complaint to an inactive user account.", 400, "USER_INACTIVE");
      }
      assignedUserName = targetUser.fullName;
    }

    const assignedByName = actorUser ? `${actorUser.fullName} (${actorUser.role})` : data.assignedBy || "SYSTEM_NLP_ROUTER";
    const assignedByUserId = actorUser?.userId || null;

    // 4. Check for active existing assignment
    const existingActive = await prisma.assignment.findFirst({
      where: { complaintId: data.complaintId, isCurrent: true },
      include: { department: true },
    });

    const isReassignment = !!existingActive;

    return prisma.$transaction(async (tx) => {
      // Archive previous active assignment
      if (existingActive) {
        await tx.assignment.update({
          where: { id: existingActive.id },
          data: {
            isCurrent: false,
            completedAt: new Date(),
          },
        });
      }

      // Create new assignment record
      const assignment = await tx.assignment.create({
        data: {
          complaintId: data.complaintId,
          departmentId: data.departmentId,
          assignedToUserId: data.assignedToUserId || null,
          assignedByUserId,
          assignedBy: assignedByName,
          assignedTo: assignedUserName,
          notes: data.notes || null,
          reassignReason: data.reassignReason || (isReassignment ? "Department reassignment" : null),
          status: data.status || "ASSIGNED",
          isCurrent: true,
        },
        include: {
          department: true,
          assignedToUser: {
            select: { id: true, fullName: true, email: true, role: true },
          },
          assignedByUser: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      });

      // Update complaint firstAssignedAt if not yet assigned
      if (!complaint.firstAssignedAt) {
        await tx.complaint.update({
          where: { id: complaint.id },
          data: { firstAssignedAt: new Date() },
        });
      }

      // Record audit log entry
      await tx.complaintAuditLog.create({
        data: {
          complaint: { connect: { id: data.complaintId } },
          fromStatus: complaint.status,
          toStatus: complaint.status,
          ...(assignedByUserId ? { actor: { connect: { id: assignedByUserId } } } : {}),
          actorName: assignedByName,
          action: isReassignment ? "REASSIGNMENT" : "INITIAL_ASSIGNMENT",
          reason: data.reassignReason || data.notes || `Assigned to ${department.name}`,
          metadata: {
            departmentCode: department.code,
            assignedTo: assignedUserName,
            previousDepartment: existingActive ? existingActive.department.code : null,
          },
        },
      });

      return assignment;
    });
  }
}

export const assignmentsService = new AssignmentsService();
