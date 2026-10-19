import express, { Express } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { standardRateLimiter } from "./middleware/rate-limiter.js";
import { healthRouter } from "./modules/health/health.router.js";
import { authRouter } from "./modules/auth/index.js";
import { complaintsRouter } from "./modules/complaints/index.js";
import { resolutionsRouter } from "./modules/resolutions/index.js";
import { assignmentsRouter } from "./modules/assignments/index.js";
import { departmentsRouter } from "./modules/departments/index.js";
import { analyticsRouter } from "./modules/analytics/index.js";

export function createApp(): Express {
  const app = express();

  // CORS security configuration using explicit allowed origins
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((o) =>
    o.trim(),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.indexOf(origin) !== -1 ||
          allowedOrigins.includes("*")
        ) {
          return callback(null, true);
        }
        return callback(
          new Error(`Origin ${origin} not permitted by CORS policy.`),
        );
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Correlation-ID",
        "X-Request-ID",
      ],
      exposedHeaders: ["X-Correlation-ID", "X-Request-ID"],
    }),
  );

  // Standard middleware
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(requestLogger);

  // Rate limiting across API routes
  app.use("/api/", standardRateLimiter);

  // Health and verification endpoints
  app.use("/api/v1/health", healthRouter);

  // Phase 3 Auth and User endpoints
  app.use("/api/v1/auth", authRouter);

  // Phase 3 Analytics dashboard aggregation endpoints
  app.use("/api/v1/analytics", analyticsRouter);

  // Module endpoints
  app.use("/api/v1/complaints", complaintsRouter);
  app.use("/api/v1/resolutions", resolutionsRouter);
  app.use("/api/v1/assignments", assignmentsRouter);
  app.use("/api/v1/departments", departmentsRouter);

  // 404 & Centralized Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
