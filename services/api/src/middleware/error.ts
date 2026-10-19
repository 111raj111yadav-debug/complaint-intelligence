import { Request, Response, NextFunction } from "express";
import { sendError } from "../lib/response.js";
import { env } from "../config/env.js";
import { ZodError } from "zod";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 404 Not Found Handler for undefined routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    "RESOURCE_NOT_FOUND",
    `Cannot ${req.method} ${req.originalUrl} - Route not defined.`,
    404,
  );
}

/**
 * Centralized Error Handler.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Handle payload too large (Express bodyParser limit exceeded)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((err as any).type === "entity.too.large" || (err as any).status === 413) {
    sendError(
      res,
      "PAYLOAD_TOO_LARGE",
      "Request entity exceeds allowed maximum size limit (1MB).",
      413,
      { limit: "1mb", correlationId: req.correlationId },
    );
    return;
  }

  // Handle malformed JSON body
  if (err instanceof SyntaxError && "body" in err) {
    sendError(
      res,
      "MALFORMED_JSON",
      "Malformed JSON payload in request body.",
      400,
      { correlationId: req.correlationId },
    );
    return;
  }

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    sendError(
      res,
      "VALIDATION_ERROR",
      "The request input failed validation schema.",
      422,
      err.errors,
    );
    return;
  }

  // Handle custom AppErrors
  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // Handle unexpected internal server errors
  console.error(`[UNHANDLED_EXCEPTION] [${req.correlationId || "no-correlation-id"}]`, err);

  const isProduction = env.NODE_ENV === "production";
  const message = isProduction
    ? "An unexpected error occurred. Please contact support."
    : err.message || "Internal Server Error";

  sendError(
    res,
    "INTERNAL_SERVER_ERROR",
    message,
    500,
    isProduction ? undefined : { stack: err.stack, correlationId: req.correlationId },
  );
}
