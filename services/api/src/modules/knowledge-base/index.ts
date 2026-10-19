import { Router } from "express";
import { sendSuccess } from "../../lib/response.js";

export const knowledgeBaseRouter = Router();

knowledgeBaseRouter.get("/", (_req, res) => {
  return sendSuccess(res, {
    message:
      "Knowledge base module boundary established. RAG indexing scheduled for Phase 2.",
  });
});
