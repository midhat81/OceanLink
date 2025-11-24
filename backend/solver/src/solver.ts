import { prisma } from "./db.js";
import { LocalTransfer } from "./types.js";
import { randomUUID } from "crypto";

type IntentGroup = {
  id: number;
  user: string;
  srcChainId: bigint;
  dstChainId: bigint;
  amount: bigint;
};

/**
 * Simple greedy netting algorithm
 * Groups intents by (srcChainId, dstChainId) and matches opposite flows
 */
export async function solveNetting(): Promise<void> {
  console.log("[Solver] Starting netting cycle...");

  // Fetch all PENDING intents
  const pendingIntents = await prisma.intent.findMany({
    where: { status: "PENDING" },
  });

  if (pendingIntents.length < 2) {
    console.log("[Solver] Not enough intents to net (need at least 2)");
    return;
  }

  // Group intents by (srcChainId, dstChainId) pair
  const groups = new Map<string, IntentGroup[]>();

  for (const intent of pendingIntents) {
    const key = `${intent.srcChainId.toString()}-${intent.dstChainId.toString()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push({
      id: intent.id,
      user: intent.userAddress,
      srcChainId: intent.srcChainId,
      dstChainId: intent.dstChainId,
      amount: BigInt(intent.amount),
    });
  }

  // Find opposite flows and create execution plans
  const executionPlans: Array<{
    transfers: LocalTransfer[];
    involvedIntents: number[];
  }> = [];

  // Process each pair of opposite directions
  for (const [key1, group1] of groups.entries()) {
    const [src1, dst1] = key1.split("-");
    const oppositeKey = `${dst1}-${src1}`;
    const group2 = groups.get(oppositeKey);

    if (!group2 || group2.length === 0) {
      continue; // No opposite flow found
    }

    // Calculate totals
    const sum1 = group1.reduce((sum, intent) => sum + intent.amount, 0n);
    const sum2 = group2.reduce((sum, intent) => sum + intent.amount, 0n);
    const net = sum1 < sum2 ? sum1 : sum2; // min(sum1, sum2)

    if (net === 0n) {
      continue;
    }

    // Build transfers for both chains
    const transfers: LocalTransfer[] = [];
    const involvedIntents: number[] = [];

    let remainingNet = net;
    let group1Index = 0;
    let group2Index = 0;

    // Match intents greedily
    while (remainingNet > 0n && group1Index < group1.length && group2Index < group2.length) {
      const intent1 = group1[group1Index];
      const intent2 = group2[group2Index];

      const matchAmount = intent1.amount < intent2.amount ? intent1.amount : intent2.amount;
      const actualMatch = matchAmount < remainingNet ? matchAmount : remainingNet;

      // Add to involved intents if not already added
      if (!involvedIntents.includes(intent1.id)) {
        involvedIntents.push(intent1.id);
      }
      if (!involvedIntents.includes(intent2.id)) {
        involvedIntents.push(intent2.id);
      }

      // Transfer on source chain (group1's srcChainId)
      transfers.push({
        chainId: Number(intent1.srcChainId),
        from: intent1.user,
        to: intent2.user,
        amount: actualMatch,
      });

      // Transfer on destination chain (group2's srcChainId, which is group1's dstChainId)
      transfers.push({
        chainId: Number(intent2.srcChainId),
        from: intent2.user,
        to: intent1.user,
        amount: actualMatch,
      });

      remainingNet -= actualMatch;

      // Update amounts and advance indices
      if (intent1.amount === actualMatch) {
        group1Index++;
      } else {
        group1[group1Index].amount -= actualMatch;
      }

      if (intent2.amount === actualMatch) {
        group2Index++;
      } else {
        group2[group2Index].amount -= actualMatch;
      }
    }

    if (transfers.length > 0) {
      executionPlans.push({ transfers, involvedIntents });
    }
  }

  // Save execution plans to database
  for (const plan of executionPlans) {
    const planId = randomUUID();
    await prisma.executionPlan.create({
      data: {
        id: planId,
        status: "PROPOSED",
        transfersJson: plan.transfers.map((t) => ({
          chainId: t.chainId,
          from: t.from,
          to: t.to,
          amount: t.amount.toString(),
        })),
        involvedIntents: plan.involvedIntents,
      },
    });

    // Mark intents as MATCHED
    await prisma.intent.updateMany({
      where: {
        id: { in: plan.involvedIntents },
      },
      data: {
        status: "MATCHED",
      },
    });

    console.log(
      `[Solver] Created execution plan ${planId} with ${plan.transfers.length} transfers involving ${plan.involvedIntents.length} intents`
    );
  }

  if (executionPlans.length === 0) {
    console.log("[Solver] No netting opportunities found");
  } else {
    console.log(`[Solver] Created ${executionPlans.length} execution plan(s)`);
  }
}

