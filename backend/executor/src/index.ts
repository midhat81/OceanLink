import dotenv from "dotenv";
import { prisma } from "./db.js";
import { executePendingPlans } from "./executor.js";

dotenv.config();

const EXECUTOR_INTERVAL_MS = parseInt(process.env.EXECUTOR_INTERVAL_MS || "10000", 10);

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log("[Executor] Database connected");
    console.log(`[Executor] Starting executor with interval ${EXECUTOR_INTERVAL_MS}ms`);

    // Validate required environment variables
    if (!process.env.EXECUTOR_PRIVATE_KEY) {
      throw new Error("EXECUTOR_PRIVATE_KEY environment variable is required");
    }

    // Run executor immediately, then on interval
    await executePendingPlans();

    setInterval(async () => {
      try {
        await executePendingPlans();
      } catch (error) {
        console.error("[Executor] Error in executor cycle:", error);
      }
    }, EXECUTOR_INTERVAL_MS);
  } catch (error) {
    console.error("[Executor] Failed to start executor:", error);
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("[Executor] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Executor] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

