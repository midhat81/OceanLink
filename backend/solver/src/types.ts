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

