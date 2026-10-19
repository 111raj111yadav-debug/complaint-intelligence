import { Router, Request, Response } from "express";
import { sendSuccess, sendError } from "../../lib/response.js";
import { checkDatabaseHealth } from "../../lib/prisma.js";
import { nlpClient } from "../../clients/nlp.client.js";
import { validateRequest } from "../../middleware/validate.js";
import { z } from "zod";

const router = Router();

/**
 * GET /api/v1/health
 * Liveness Probe: Confirms the Node.js API process is alive and accepting connections.
 */
router.get("/", (_req: Request, res: Response) => {
  return sendSuccess(res, {
    status: "ok",
    service: "complaint-intelligence-api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
  });
});

/**
 * GET /api/v1/health/ready
 * Readiness Probe: Confirms critical dependencies (PostgreSQL database) are operational.
 * Returns HTTP 200 when ready, or HTTP 503 Service Unavailable when required dependencies fail.
 */
router.get("/ready", async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const nlpHealth = await nlpClient.checkHealth();

  const isReady = dbHealth.healthy;
  const statusCode = isReady ? 200 : 503;

  const responseData = {
    status: isReady ? "ready" : "unhealthy",
    service: "complaint-intelligence-api",
    timestamp: new Date().toISOString(),
    dependencies: {
      database: {
        healthy: dbHealth.healthy,
        latencyMs: dbHealth.latencyMs,
        ...(dbHealth.error ? { error: dbHealth.error } : {}),
      },
      nlpMicroservice: {
        available: nlpHealth.available,
        latencyMs: nlpHealth.latencyMs,
        ...(nlpHealth.error ? { error: nlpHealth.error } : {}),
      },
    },
  };

  if (!isReady) {
    return sendError(
      res,
      "SERVICE_UNAVAILABLE",
      "One or more required infrastructure dependencies are unavailable.",
      statusCode,
      responseData,
    );
  }

  return sendSuccess(res, responseData, statusCode);
});

/**
 * POST /api/v1/health/nlp-ping
 * Inter-service communication test endpoint: Node API invokes Python NLP service.
 */
const nlpPingSchema = {
  body: z.object({
    message: z.string().min(1, "Message cannot be empty").max(200),
  }),
};

router.post(
  "/nlp-ping",
  validateRequest(nlpPingSchema),
  async (req: Request, res: Response) => {
    const { message } = req.body as { message: string };
    const pingResult = await nlpClient.sendPing(message);

    if (!pingResult.success) {
      return sendError(
        res,
        "NLP_COMMUNICATION_FAILED",
        "Failed to reach Python NLP microservice.",
        502,
        { error: pingResult.error },
      );
    }

    return sendSuccess(res, {
      source: "express-api",
      target: "fastapi-nlp",
      result: pingResult,
    });
  },
);

export const healthRouter = router;
