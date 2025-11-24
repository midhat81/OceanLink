import { createWalletClient, http, Address, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, arbitrumSepolia, localhost } from "viem/chains";
import { prisma } from "./db.js";
import { LocalTransfer } from "./types.js";

// Define custom localhost chains with different chain IDs
const localhostBase = defineChain({
  ...localhost,
  id: 31337,
  name: "Localhost Base",
});

const localhostArbitrum = defineChain({
  ...localhost,
  id: 31338,
  name: "Localhost Arbitrum",
});

// Vault ABI - simplified version matching our contract
const VAULT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        name: "transfers",
        type: "tuple[]",
      },
    ],
    name: "executeTransfers",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Chain configuration
const CHAIN_CONFIGS: Record<number, { rpc: string; chain: any }> = {
  84532: {
    // Base Sepolia
    rpc: process.env.BASE_RPC_URL || "https://sepolia.base.org",
    chain: baseSepolia,
  },
  421614: {
    // Arbitrum Sepolia
    rpc: process.env.ARBITRUM_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    chain: arbitrumSepolia,
  },
  31337: {
    // Local anvil (Base)
    rpc: process.env.BASE_RPC_URL || "http://localhost:8545",
    chain: localhostBase,
  },
  31338: {
    // Local anvil (Arbitrum)
    rpc: process.env.ARBITRUM_RPC_URL || "http://localhost:8546",
    chain: localhostArbitrum,
  },
};

const VAULT_ADDRESSES: Record<number, Address> = {
  84532: (process.env.BASE_VAULT_ADDRESS as Address) || "0x0000000000000000000000000000000000000000",
  421614: (process.env.ARBITRUM_VAULT_ADDRESS as Address) || "0x0000000000000000000000000000000000000000",
  31337: (process.env.BASE_VAULT_ADDRESS as Address) || "0x0000000000000000000000000000000000000000",
  31338: (process.env.ARBITRUM_VAULT_ADDRESS as Address) || "0x0000000000000000000000000000000000000000",
};

async function validateExecutionPlan(planId: string): Promise<{ valid: boolean; error?: string }> {
  const plan = await prisma.executionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    return { valid: false, error: "Execution plan not found" };
  }

  if (plan.status !== "PROPOSED") {
    return { valid: false, error: `Execution plan is not PROPOSED (current: ${plan.status})` };
  }

  // Validate involved intents
  const intents = await prisma.intent.findMany({
    where: { id: { in: plan.involvedIntents } },
  });

  const now = BigInt(Math.floor(Date.now() / 1000));
  for (const intent of intents) {
    if (intent.status === "EXECUTED" || intent.status === "CANCELLED") {
      return { valid: false, error: `Intent ${intent.id} is already ${intent.status}` };
    }
    if (BigInt(intent.expiry.toString()) <= now) {
      return { valid: false, error: `Intent ${intent.id} has expired` };
    }
  }

  return { valid: true };
}

async function executePlan(planId: string): Promise<void> {
  console.log(`[Executor] Processing execution plan ${planId}...`);

  const validation = await validateExecutionPlan(planId);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.error}`);
  }

  const plan = await prisma.executionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error("Execution plan not found");
  }

  const transfers = plan.transfersJson as Array<{
    chainId: number;
    from: string;
    to: string;
    amount: string;
  }>;

  // Group transfers by chainId
  const transfersByChain = new Map<number, LocalTransfer[]>();
  for (const t of transfers) {
    if (!transfersByChain.has(t.chainId)) {
      transfersByChain.set(t.chainId, []);
    }
    transfersByChain.get(t.chainId)!.push({
      chainId: t.chainId,
      from: t.from,
      to: t.to,
      amount: BigInt(t.amount),
    });
  }

  // Execute on each chain
  const executorPrivateKey = process.env.EXECUTOR_PRIVATE_KEY;
  if (!executorPrivateKey) {
    throw new Error("EXECUTOR_PRIVATE_KEY not set");
  }

  const account = privateKeyToAccount(executorPrivateKey as Address);

  for (const [chainId, chainTransfers] of transfersByChain.entries()) {
    const config = CHAIN_CONFIGS[chainId];
    if (!config) {
      throw new Error(`Unknown chain ID: ${chainId}`);
    }

    const vaultAddress = VAULT_ADDRESSES[chainId];
    if (!vaultAddress || vaultAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error(`Vault address not configured for chain ${chainId}`);
    }

    const walletClient = createWalletClient({
      account,
      chain: config.chain,
      transport: http(config.rpc),
    });

    // Format transfers for contract call
    const contractTransfers = chainTransfers.map((t) => ({
      from: t.from as Address,
      to: t.to as Address,
      amount: t.amount,
    }));

    try {
      console.log(
        `[Executor] Executing ${chainTransfers.length} transfers on chain ${chainId} (${config.chain.name})...`
      );

      const hash = await walletClient.writeContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "executeTransfers",
        args: [contractTransfers],
      });

      console.log(`[Executor] Transaction sent: ${hash} on chain ${chainId}`);

      // Wait for transaction receipt
      const publicClient = walletClient.extend({ transport: http(config.rpc) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        console.log(`[Executor] Transaction confirmed on chain ${chainId}`);
      } else {
        throw new Error(`Transaction failed on chain ${chainId}`);
      }
    } catch (error) {
      console.error(`[Executor] Error executing on chain ${chainId}:`, error);
      throw error;
    }
  }

  // Mark plan as EXECUTED and update intents
  await prisma.$transaction([
    prisma.executionPlan.update({
      where: { id: planId },
      data: { status: "EXECUTED" },
    }),
    prisma.intent.updateMany({
      where: { id: { in: plan.involvedIntents } },
      data: { status: "EXECUTED" },
    }),
  ]);

  console.log(`[Executor] Successfully executed plan ${planId}`);
}

export async function executePendingPlans(): Promise<void> {
  console.log("[Executor] Checking for pending execution plans...");

  const pendingPlans = await prisma.executionPlan.findMany({
    where: { status: "PROPOSED" },
    orderBy: { createdAt: "asc" },
    take: 10, // Process up to 10 plans at a time
  });

  if (pendingPlans.length === 0) {
    console.log("[Executor] No pending execution plans");
    return;
  }

  console.log(`[Executor] Found ${pendingPlans.length} pending plan(s)`);

  for (const plan of pendingPlans) {
    try {
      await executePlan(plan.id);
    } catch (error) {
      console.error(`[Executor] Failed to execute plan ${plan.id}:`, error);
      // Mark plan as FAILED
      await prisma.executionPlan.update({
        where: { id: plan.id },
        data: { status: "FAILED" },
      });
    }
  }
}

