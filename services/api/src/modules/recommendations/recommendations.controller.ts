import { Request, Response } from "express";
import { recommendationsService } from "./recommendations.service.js";
import { sendSuccess } from "../../lib/response.js";

export class RecommendationsController {
  async generateRecommendation(req: Request, res: Response) {
    const complaintId = req.params.id as string;
    const { force_provider, top_k, similarity_threshold } = req.body || {};

    const recommendation = await recommendationsService.generateRecommendation(
      complaintId,
      {
        force_provider,
        top_k,
        similarity_threshold,
      },
      req.user,
    );

    return sendSuccess(res, recommendation, 201);
  }

  async getLatestRecommendation(req: Request, res: Response) {
    const complaintId = req.params.id as string;
    const recommendation =
      await recommendationsService.getLatestRecommendation(complaintId);
    return sendSuccess(res, recommendation, 200);
  }

  async recordFeedback(req: Request, res: Response) {
    const complaintId = req.params.id as string;
    const {
      wasAccepted,
      feedbackDecision,
      rejectionReason,
      agentModifications,
      agentRating,
      feedbackNotes,
      submittedBy,
      rubricScores,
    } = req.body;

    const feedback = await recommendationsService.recordFeedback(
      complaintId,
      {
        wasAccepted,
        feedbackDecision,
        rejectionReason,
        agentModifications,
        agentRating,
        feedbackNotes,
        submittedBy,
        rubricScores,
      },
      req.user,
    );

    return sendSuccess(res, feedback, 200);
  }
}

export const recommendationsController = new RecommendationsController();
