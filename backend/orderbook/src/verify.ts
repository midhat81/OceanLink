import { verifyTypedData, Address } from "viem";
import { INTENT_EIP712_DOMAIN, INTENT_EIP712_TYPES } from "./eip712.js";
import { Intent } from "./types.js";

export function verifyIntentSignature(
  intent: Intent,
  signature: string
): boolean {
  try {
    const domain = INTENT_EIP712_DOMAIN(intent.srcChainId);
    const recoveredAddress = verifyTypedData({
      domain,
      types: INTENT_EIP712_TYPES,
      primaryType: "Intent",
      message: intent,
      signature: signature as Address,
    });

    return recoveredAddress.toLowerCase() === intent.user.toLowerCase();
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

export function validateIntent(intent: Intent): { valid: boolean; error?: string } {
  if (intent.srcChainId === intent.dstChainId) {
    return { valid: false, error: "Source and destination chains must be different" };
  }

  if (intent.amount <= 0n) {
    return { valid: false, error: "Amount must be greater than zero" };
  }

  if (intent.minAmountOut < 0n) {
    return { valid: false, error: "minAmountOut must be non-negative" };
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (intent.expiry <= now) {
    return { valid: false, error: "Intent has expired" };
  }

  return { valid: true };
}

