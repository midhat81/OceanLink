export type Intent = {
  user: string; // EVM address
  srcChainId: bigint;
  dstChainId: bigint;
  token: string; // USDC address (on srcChain)
  amount: bigint; // amount user wants to send
  minAmountOut: bigint;
  expiry: bigint; // unix timestamp
  nonce: bigint;
};

export type IntentSubmission = {
  intent: Intent;
  signature: string;
};

export type LocalTransfer = {
  chainId: number;
  from: string;
  to: string;
  amount: bigint;
};

export type ExecutionPlan = {
  id: string; // UUID
  transfers: LocalTransfer[];
  involvedIntents: number[]; // array of DB intent ids
  status: "PROPOSED" | "EXECUTED" | "FAILED";
};

