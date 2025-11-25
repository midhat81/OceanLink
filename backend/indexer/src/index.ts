import dotenv from "dotenv";
import { prisma } from "./db.js";
import { startIndexer } from "./indexer.js";

dotenv.config();

const INDEXER_INTERVAL_MS = parseInt(process.env.INDEXER_INTERVAL_MS || "5000", 10);

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log("[Indexer] Database connected");
    console.log(`[Indexer] Starting indexer...`);

    // Start indexing
    await startIndexer();
  } catch (error) {
    console.error("[Indexer] Failed to start indexer:", error);
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
  console.log("[Indexer] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Indexer] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

