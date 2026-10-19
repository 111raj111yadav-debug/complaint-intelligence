import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/**
 * Standard API rate limiter applied across all incoming traffic.
 */
export const standardRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this client IP. Please wait before retrying.",
    },
  },
});

/**
 * Stricter rate limiter for sensitive authentication endpoints (e.g. login).
 */
export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts. Account access temporarily throttled.",
    },
  },
});
