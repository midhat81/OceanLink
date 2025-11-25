import dotenv from "dotenv";
import { createWalletClient, http, Address, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, sepolia, defineChain } from "viem/chains";

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

// Vault ABI
const VAULT_ABI = [
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ERC20 ABI for approve
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
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
        tokenAddress: process.env.BASE_TOKEN_ADDRESS || "",
        name: "Base Sepolia",
      };
    case 11155111: // Sepolia
      return {
        chain: sepolia,
        rpcUrl: process.env.SEPOLIA_RPC_URL || "",
        vaultAddress: process.env.SEPOLIA_VAULT_ADDRESS || "",
        tokenAddress: process.env.SEPOLIA_TOKEN_ADDRESS || "",
        name: "Sepolia",
      };
    case 31337: // Localhost Base
      return {
        chain: localhostBase,
        rpcUrl: process.env.BASE_RPC_URL || "http://localhost:8545",
        vaultAddress: process.env.BASE_VAULT_ADDRESS || "",
        tokenAddress: process.env.BASE_TOKEN_ADDRESS || "",
        name: "Localhost Base",
      };
    case 31338: // Localhost Sepolia
      return {
        chain: localhostSepolia,
        rpcUrl: process.env.SEPOLIA_RPC_URL || "http://localhost:8546",
        vaultAddress: process.env.SEPOLIA_VAULT_ADDRESS || "",
        tokenAddress: process.env.SEPOLIA_TOKEN_ADDRESS || "",
        name: "Localhost Sepolia",
      };
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

async function deposit(chainId: number, amount: string, privateKey: string) {
  const config = getChainConfig(chainId);

  if (!config.rpcUrl || !config.vaultAddress || !config.tokenAddress) {
    throw new Error(
      `Missing configuration for ${config.name}. Please set ${chainId === 84532 || chainId === 31337 ? "BASE" : "SEPOLIA"}_RPC_URL, ${chainId === 84532 || chainId === 31337 ? "BASE" : "SEPOLIA"}_VAULT_ADDRESS, and ${chainId === 84532 || chainId === 31337 ? "BASE" : "SEPOLIA"}_TOKEN_ADDRESS`
    );
  }

  const account = privateKeyToAccount(privateKey as Address);
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const publicClient = walletClient.extend({ transport: http(config.rpcUrl) });

  // Parse amount (USDT has 6 decimals)
  const amountWei = parseUnits(amount, 6);
  const vaultAddress = config.vaultAddress as Address;
  const tokenAddress = config.tokenAddress as Address;

  console.log(`[Deposit] ${config.name}`);
  console.log(`[Deposit] Vault: ${vaultAddress}`);
  console.log(`[Deposit] Token: ${tokenAddress}`);
  console.log(`[Deposit] Amount: ${amount} USDT (${amountWei.toString()} wei)`);
  console.log(`[Deposit] Account: ${account.address}`);

  try {
    // Check token balance
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });

    console.log(`[Deposit] Current token balance: ${formatUnits(balance, 6)} USDT`);

    if (balance < amountWei) {
      throw new Error(
        `Insufficient balance. Have ${formatUnits(balance, 6)} USDT, need ${amount} USDT`
      );
    }

    // Approve token spending
    console.log(`[Deposit] Approving token spending...`);
    const approveHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vaultAddress, amountWei],
    });

    console.log(`[Deposit] Approval transaction: ${approveHash}`);
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`[Deposit] Approval confirmed in block ${approveReceipt.blockNumber}`);

    // Deposit to vault
    console.log(`[Deposit] Depositing to vault...`);
    const depositHash = await walletClient.writeContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [amountWei],
    });

    console.log(`[Deposit] Deposit transaction: ${depositHash}`);
    const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });

    if (depositReceipt.status === "success") {
      console.log(`[Deposit] ✅ Successfully deposited ${amount} USDT to vault`);
      console.log(`[Deposit] Transaction confirmed in block ${depositReceipt.blockNumber}`);
      console.log(`[Deposit] View on explorer: ${config.chain.blockExplorers?.default?.url}/tx/${depositHash}`);
    } else {
      throw new Error("Deposit transaction failed");
    }
  } catch (error: any) {
    console.error(`[Deposit] ❌ Error:`, error.message || error);
    process.exit(1);
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error("Usage: tsx deposit.ts <chainId> <amount> <privateKey>");
  console.error("Example: tsx deposit.ts 84532 100.0 0x...");
  console.error("\nSupported chains:");
  console.error("  84532 - Base Sepolia");
  console.error("  11155111 - Sepolia");
  console.error("  31337 - Localhost Base");
  console.error("  31338 - Localhost Sepolia");
  process.exit(1);
}

const chainId = parseInt(args[0], 10);
const amount = args[1];
const privateKey = args[2];

deposit(chainId, amount, privateKey)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

