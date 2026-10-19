import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Complaint Intelligence API Server running`);
  console.log(`   Port:         ${PORT}`);
  console.log(`   Environment:  ${env.NODE_ENV}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/v1/health`);
  console.log(`   Readiness:    http://localhost:${PORT}/api/v1/health/ready`);
  console.log(`=======================================================`);
});

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);
  server.close(async () => {
    console.log("HTTP server closed.");
    await prisma.$disconnect();
    console.log("Database client disconnected.");
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    console.error("Graceful shutdown timed out. Forcing process exit.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Promise Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception thrown:", error);
  process.exit(1);
});
