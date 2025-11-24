import dotenv from "dotenv";
import { prisma } from "./db.js";
import { solveNetting } from "./solver.js";

dotenv.config();

const SOLVER_INTERVAL_MS = parseInt(process.env.SOLVER_INTERVAL_MS || "5000", 10);

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log("[Solver] Database connected");
    console.log(`[Solver] Starting solver with interval ${SOLVER_INTERVAL_MS}ms`);

    // Run solver immediately, then on interval
    await solveNetting();

    setInterval(async () => {
      try {
        await solveNetting();
      } catch (error) {
        console.error("[Solver] Error in solver cycle:", error);
      }
    }, SOLVER_INTERVAL_MS);
  } catch (error) {
    console.error("[Solver] Failed to start solver:", error);
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
  console.log("[Solver] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Solver] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

