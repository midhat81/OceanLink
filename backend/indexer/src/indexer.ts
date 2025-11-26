import { createPublicClient, http, Address, parseAbiItem, formatUnits, defineChain } from "viem";
import { baseSepolia, sepolia, arbitrumSepolia } from "viem/chains";
import { prisma } from "./db.js";
import { ChainConfig } from "./types.js";

// Define custom localhost chains
const localhostBase = defineChain({
  ...baseSepolia,
  id: 31337,
  name: "Localhost Base",
});

const localhostSepolia = defineChain({
  ...sepolia,
  id: 31338,
  name: "Localhost Sepolia",
});

const localhostArbitrum = defineChain({
  ...arbitrumSepolia,
  id: 31339,
  name: "Localhost Arbitrum",
});

// Vault ABI for events
const VAULT_ABI = [
  parseAbiItem("event Deposit(address indexed user, uint256 amount)"),
  parseAbiItem("event Withdraw(address indexed user, uint256 amount)"),
] as const;

// Parse chain configurations from environment variables
function parseChainConfigs(): ChainConfig[] {
  const configs: ChainConfig[] = [];

  // Base Sepolia (84532)
  const baseRpcUrl = process.env.BASE_RPC_URL;
  const baseVaultAddress = process.env.BASE_VAULT_ADDRESS;
  if (baseRpcUrl && baseVaultAddress) {
    const isLocalhost = baseRpcUrl.startsWith("http://localhost:") || baseRpcUrl.startsWith("http://127.0.0.1:");
    if (!isLocalhost) {
      configs.push({
        chainId: 84532,
        rpcUrl: baseRpcUrl,
        vaultAddress: baseVaultAddress,
        name: "Base Sepolia",
      });
    } else {
      configs.push({
        chainId: 31337,
        rpcUrl: baseRpcUrl,
        vaultAddress: baseVaultAddress,
        name: "Localhost Base",
      });
    }
  }

  // Sepolia (11155111)
  const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
  const sepoliaVaultAddress = process.env.SEPOLIA_VAULT_ADDRESS;
  if (sepoliaRpcUrl && sepoliaVaultAddress) {
    const isLocalhost = sepoliaRpcUrl.startsWith("http://localhost:") || sepoliaRpcUrl.startsWith("http://127.0.0.1:");
    if (!isLocalhost) {
      configs.push({
        chainId: 11155111,
        rpcUrl: sepoliaRpcUrl,
        vaultAddress: sepoliaVaultAddress,
        name: "Sepolia",
      });
    } else {
      configs.push({
        chainId: 31338,
        rpcUrl: sepoliaRpcUrl,
        vaultAddress: sepoliaVaultAddress,
        name: "Localhost Sepolia",
      });
    }
  }

  // Arbitrum Sepolia (421614)
  const arbitrumRpcUrl = process.env.ARBITRUM_RPC_URL;
  const arbitrumVaultAddress = process.env.ARBITRUM_VAULT_ADDRESS;
  if (arbitrumRpcUrl && arbitrumVaultAddress) {
    const isLocalhost = arbitrumRpcUrl.startsWith("http://localhost:") || arbitrumRpcUrl.startsWith("http://127.0.0.1:");
    if (!isLocalhost) {
      configs.push({
        chainId: 421614,
        rpcUrl: arbitrumRpcUrl,
        vaultAddress: arbitrumVaultAddress,
        name: "Arbitrum Sepolia",
      });
    } else {
      configs.push({
        chainId: 31339,
        rpcUrl: arbitrumRpcUrl,
        vaultAddress: arbitrumVaultAddress,
        name: "Localhost Arbitrum",
      });
    }
  }

  return configs;
}

function getChainFromId(chainId: number) {
  switch (chainId) {
    case 84532:
      return baseSepolia;
    case 11155111:
      return sepolia;
    case 421614:
      return arbitrumSepolia;
    case 31337:
      return localhostBase;
    case 31338:
      return localhostSepolia;
    case 31339:
      return localhostArbitrum;
    default:
      throw new Error(`Unknown chain ID: ${chainId}`);
  }
}

async function indexChain(config: ChainConfig): Promise<void> {
  console.log(`[Indexer] Starting indexer for ${config.name} (chain ${config.chainId})...`);

  const chain = getChainFromId(config.chainId);
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const vaultAddress = config.vaultAddress as Address;

  // Get the latest processed block number from database
  const latestTx = await prisma.vaultTransaction.findFirst({
    where: {
      chainId: BigInt(config.chainId),
      vaultAddress: config.vaultAddress,
    },
    orderBy: {
      blockNumber: "desc",
    },
  });

  const fromBlock = latestTx
    ? BigInt(latestTx.blockNumber.toString()) + BigInt(1)
    : BigInt(0); // Start from block 0 if no previous transactions

  console.log(
    `[Indexer] ${config.name}: Starting from block ${fromBlock.toString()}`
  );

  // Catch up on historical blocks first
  try {
    const currentBlock = await publicClient.getBlockNumber();
    if (currentBlock >= fromBlock) {
      if (fromBlock < currentBlock) {
        console.log(
          `[Indexer] ${config.name}: Catching up from block ${fromBlock.toString()} to ${currentBlock.toString()}`
        );
        await catchUpBlocks(publicClient, config.chainId, vaultAddress, fromBlock, currentBlock);
      }
    }
  } catch (error) {
    console.error(`[Indexer] ${config.name}: Error catching up blocks:`, error);
  }

  // Start polling for new blocks
  const pollInterval = parseInt(process.env.INDEXER_POLL_INTERVAL_MS || "5000", 10);
  let lastProcessedBlock = await publicClient.getBlockNumber();

  const poll = async () => {
    try {
      const currentBlock = await publicClient.getBlockNumber();
      if (currentBlock > lastProcessedBlock) {
        const from = lastProcessedBlock + BigInt(1);
        const to = currentBlock;
        console.log(
          `[Indexer] ${config.name}: Processing blocks ${from.toString()} to ${to.toString()}`
        );
        await catchUpBlocks(publicClient, config.chainId, vaultAddress, from, to);
        lastProcessedBlock = currentBlock;
      }
    } catch (error) {
      console.error(`[Indexer] ${config.name}: Error polling blocks:`, error);
    }
  };

  // Poll immediately, then on interval
  await poll();
  setInterval(poll, pollInterval);

  console.log(`[Indexer] ${config.name}: Indexer started and polling every ${pollInterval}ms`);
}

async function catchUpBlocks(
  publicClient: any,
  chainId: number,
  vaultAddress: Address,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  const batchSize = BigInt(1000); // Process 1000 blocks at a time
  let currentBlock = fromBlock;

  while (currentBlock <= toBlock) {
    const endBlock = currentBlock + batchSize > toBlock ? toBlock : currentBlock + batchSize;

    try {
      const logs = await publicClient.getLogs({
        address: vaultAddress,
        event: VAULT_ABI,
        fromBlock: currentBlock,
        toBlock: endBlock,
      });

      for (const log of logs) {
        await processEvent(publicClient, chainId, vaultAddress, log);
      }

      currentBlock = endBlock + BigInt(1);
    } catch (error) {
      console.error(
        `[Indexer] Error processing blocks ${currentBlock}-${endBlock}:`,
        error
      );
      // Move forward even on error to avoid getting stuck
      currentBlock = endBlock + BigInt(1);
    }
  }
}

async function processBlock(
  publicClient: any,
  chainId: number,
  vaultAddress: Address,
  blockNumber: bigint,
  blockTimestamp: bigint
): Promise<void> {
  try {
    const logs = await publicClient.getLogs({
      address: vaultAddress,
      event: VAULT_ABI,
      fromBlock: blockNumber,
      toBlock: blockNumber,
    });

    for (const log of logs) {
      await processEvent(publicClient, chainId, vaultAddress, log, blockTimestamp);
    }
  } catch (error) {
    console.error(`[Indexer] Error processing block ${blockNumber}:`, error);
  }
}

async function processEvent(
  publicClient: any,
  chainId: number,
  vaultAddress: Address,
  log: any,
  blockTimestamp?: bigint
): Promise<void> {
  try {
    // Get block timestamp if not provided
    let timestamp = blockTimestamp;
    if (!timestamp) {
      const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
      timestamp = block.timestamp;
    }

    const eventName = log.eventName;
    const userAddress = log.args.user as Address;
    const amount = log.args.amount as bigint;

    // Check if transaction already exists
    const existing = await prisma.vaultTransaction.findFirst({
      where: {
        txHash: log.transactionHash,
        chainId: BigInt(chainId),
      },
    });

    if (existing) {
      return; // Already indexed
    }

    // Store in database
    await prisma.vaultTransaction.create({
      data: {
        chainId: BigInt(chainId),
        vaultAddress: vaultAddress.toLowerCase(),
        userAddress: userAddress.toLowerCase(),
        type: eventName.toUpperCase(),
        amount: amount.toString(),
        txHash: log.transactionHash,
        blockNumber: BigInt(log.blockNumber.toString()),
        blockTimestamp: BigInt(timestamp!.toString()),
      },
    });

    console.log(
      `[Indexer] Indexed ${eventName} on chain ${chainId}: user=${userAddress}, amount=${formatUnits(amount, 6)} USDT, tx=${log.transactionHash}`
    );
  } catch (error) {
    console.error(`[Indexer] Error processing event:`, error);
  }
}

export async function startIndexer(): Promise<void> {
  const configs = parseChainConfigs();

  if (configs.length === 0) {
    throw new Error(
      "No chain configurations found. Please set BASE_RPC_URL/BASE_VAULT_ADDRESS, SEPOLIA_RPC_URL/SEPOLIA_VAULT_ADDRESS, and/or ARBITRUM_RPC_URL/ARBITRUM_VAULT_ADDRESS"
    );
  }

  console.log(`[Indexer] Starting indexer for ${configs.length} chain(s)...`);

  // Start indexing for each configured chain
  for (const config of configs) {
    indexChain(config).catch((error) => {
      console.error(`[Indexer] Failed to start indexer for ${config.name}:`, error);
    });
  }
}

