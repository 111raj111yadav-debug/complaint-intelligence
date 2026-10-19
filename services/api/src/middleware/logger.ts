import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  const correlationId =
    (req.headers["x-correlation-id"] as string) ||
    (req.headers["x-request-id"] as string) ||
    crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);
  res.setHeader("X-Request-ID", correlationId);

  const { method, originalUrl, ip } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const logLevel =
      statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";
    const timestamp = new Date().toISOString();
    const userRole = req.user ? `[${req.user.role}:${req.user.email}]` : "[anonymous]";

    // Structured metadata output without raw text or auth headers
    console.log(
      `[${timestamp}] [${logLevel}] [${correlationId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms [${ip}] ${userRole}`,
    );
  });

  next();
}
