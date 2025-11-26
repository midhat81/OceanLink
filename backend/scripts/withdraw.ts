import dotenv from "dotenv";
import { createWalletClient, createPublicClient, http, Address, parseUnits, formatUnits, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, sepolia, arbitrumSepolia } from "viem/chains";

dotenv.config();

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

// Vault ABI
const VAULT_ABI = [
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balances",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function getChainConfig(chainId: number) {
  switch (chainId) {
    case 84532: // Base Sepolia
      return {
        chain: baseSepolia,
        rpcUrl: process.env.BASE_RPC_URL || "",
        vaultAddress: process.env.BASE_VAULT_ADDRESS || "",
        name: "Base Sepolia",
      };
    case 11155111: // Sepolia
      return {
        chain: sepolia,
        rpcUrl: process.env.SEPOLIA_RPC_URL || "",
        vaultAddress: process.env.SEPOLIA_VAULT_ADDRESS || "",
        name: "Sepolia",
      };
    case 421614: // Arbitrum Sepolia
      return {
        chain: arbitrumSepolia,
        rpcUrl: process.env.ARBITRUM_RPC_URL || "",
        vaultAddress: process.env.ARBITRUM_VAULT_ADDRESS || "",
        name: "Arbitrum Sepolia",
      };
    case 31337: // Localhost Base
      return {
        chain: localhostBase,
        rpcUrl: process.env.BASE_RPC_URL || "http://localhost:8545",
        vaultAddress: process.env.BASE_VAULT_ADDRESS || "",
        name: "Localhost Base",
      };
    case 31338: // Localhost Sepolia
      return {
        chain: localhostSepolia,
        rpcUrl: process.env.SEPOLIA_RPC_URL || "http://localhost:8546",
        vaultAddress: process.env.SEPOLIA_VAULT_ADDRESS || "",
        name: "Localhost Sepolia",
      };
    case 31339: // Localhost Arbitrum
      return {
        chain: localhostArbitrum,
        rpcUrl: process.env.ARBITRUM_RPC_URL || "http://localhost:8547",
        vaultAddress: process.env.ARBITRUM_VAULT_ADDRESS || "",
        name: "Localhost Arbitrum",
      };
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

async function withdraw(chainId: number, amount: string, privateKey: string) {
  const config = getChainConfig(chainId);

  if (!config.rpcUrl || !config.vaultAddress) {
    let prefix = "BASE";
    if (chainId === 11155111 || chainId === 31338) prefix = "SEPOLIA";
    else if (chainId === 421614 || chainId === 31339) prefix = "ARBITRUM";
    
    throw new Error(
      `Missing configuration for ${config.name}. Please set ${prefix}_RPC_URL and ${prefix}_VAULT_ADDRESS`
    );
  }

  const account = privateKeyToAccount(privateKey as Address);
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  // Parse amount (USDT has 6 decimals)
  const amountWei = parseUnits(amount, 6);
  const vaultAddress = config.vaultAddress as Address;

  console.log(`[Withdraw] ${config.name}`);
  console.log(`[Withdraw] Vault: ${vaultAddress}`);
  console.log(`[Withdraw] Amount: ${amount} USDT (${amountWei.toString()} wei)`);
  console.log(`[Withdraw] Account: ${account.address}`);

  try {
    // Check vault balance
    const vaultBalance = await publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "balances",
      args: [account.address],
    });

    console.log(`[Withdraw] Current vault balance: ${formatUnits(vaultBalance, 6)} USDT`);

    if (vaultBalance < amountWei) {
      throw new Error(
        `Insufficient vault balance. Have ${formatUnits(vaultBalance, 6)} USDT, need ${amount} USDT`
      );
    }

    // Withdraw from vault
    console.log(`[Withdraw] Withdrawing from vault...`);
    const withdrawHash = await walletClient.writeContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [amountWei],
    });

    console.log(`[Withdraw] Withdraw transaction: ${withdrawHash}`);
    const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

    if (withdrawReceipt.status === "success") {
      console.log(`[Withdraw] ✅ Successfully withdrew ${amount} USDT from vault`);
      console.log(`[Withdraw] Transaction confirmed in block ${withdrawReceipt.blockNumber}`);
      console.log(`[Withdraw] View on explorer: ${config.chain.blockExplorers?.default?.url}/tx/${withdrawHash}`);
    } else {
      throw new Error("Withdraw transaction failed");
    }
  } catch (error: any) {
    console.error(`[Withdraw] ❌ Error:`, error.message || error);
    process.exit(1);
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error("Usage: tsx withdraw.ts <chainId> <amount> <privateKey>");
  console.error("Example: tsx withdraw.ts 84532 100.0 0x...");
  console.error("\nSupported chains:");
  console.error("  84532 - Base Sepolia");
  console.error("  11155111 - Sepolia");
  console.error("  421614 - Arbitrum Sepolia");
  console.error("  31337 - Localhost Base");
  console.error("  31338 - Localhost Sepolia");
  console.error("  31339 - Localhost Arbitrum");
  process.exit(1);
}

const chainId = parseInt(args[0], 10);
const amount = args[1];
const privateKey = args[2];

withdraw(chainId, amount, privateKey)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

