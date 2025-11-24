import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifyIntentSignature, validateIntent } from "../verify.js";
import { IntentSubmission } from "../types.js";

const router = Router();

const IntentSchema = z.object({
  user: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"),
  srcChainId: z.string().transform((val) => BigInt(val)),
  dstChainId: z.string().transform((val) => BigInt(val)),
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"),
  amount: z.string().transform((val) => BigInt(val)),
  minAmountOut: z.string().transform((val) => BigInt(val)),
  expiry: z.string().transform((val) => BigInt(val)),
  nonce: z.string().transform((val) => BigInt(val)),
});

const IntentSubmissionSchema = z.object({
  intent: IntentSchema,
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/, "Invalid signature"),
});

// POST /intents
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = IntentSubmissionSchema.parse(req.body);
    const { intent, signature } = body;

    // Validate intent
    const validation = validateIntent(intent);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Verify signature
    if (!verifyIntentSignature(intent, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Store in database
    const created = await prisma.intent.create({
      data: {
        userAddress: intent.user,
        srcChainId: intent.srcChainId,
        dstChainId: intent.dstChainId,
        tokenAddress: intent.token,
        amount: intent.amount.toString(),
        minAmountOut: intent.minAmountOut.toString(),
        expiry: intent.expiry,
        nonce: intent.nonce,
        signature: signature,
        status: "PENDING",
      },
    });

    res.status(201).json({
      id: created.id,
      user: created.userAddress,
      srcChainId: created.srcChainId.toString(),
      dstChainId: created.dstChainId.toString(),
      token: created.tokenAddress,
      amount: created.amount,
      minAmountOut: created.minAmountOut,
      expiry: created.expiry.toString(),
      nonce: created.nonce.toString(),
      status: created.status,
      createdAt: created.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("Error creating intent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /intents
router.get("/", async (req: Request, res: Response) => {
  try {
    const userAddress = req.query.user_address as string | undefined;
    const srcChainId = req.query.src_chain_id as string | undefined;
    const dstChainId = req.query.dst_chain_id as string | undefined;
    const status = req.query.status as string | undefined;

    const where: any = {};
    if (userAddress) {
      where.userAddress = userAddress;
    }
    if (srcChainId) {
      where.srcChainId = BigInt(srcChainId);
    }
    if (dstChainId) {
      where.dstChainId = BigInt(dstChainId);
    }
    if (status) {
      where.status = status;
    }

    const intents = await prisma.intent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to 100 results
    });

    res.json(
      intents.map((intent) => ({
        id: intent.id,
        user: intent.userAddress,
        srcChainId: intent.srcChainId.toString(),
        dstChainId: intent.dstChainId.toString(),
        token: intent.tokenAddress,
        amount: intent.amount,
        minAmountOut: intent.minAmountOut,
        expiry: intent.expiry.toString(),
        nonce: intent.nonce.toString(),
        status: intent.status,
        createdAt: intent.createdAt,
        updatedAt: intent.updatedAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching intents:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /intents/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid intent ID" });
    }

    const intent = await prisma.intent.findUnique({
      where: { id },
    });

    if (!intent) {
      return res.status(404).json({ error: "Intent not found" });
    }

    res.json({
      id: intent.id,
      user: intent.userAddress,
      srcChainId: intent.srcChainId.toString(),
      dstChainId: intent.dstChainId.toString(),
      token: intent.tokenAddress,
      amount: intent.amount,
      minAmountOut: intent.minAmountOut,
      expiry: intent.expiry.toString(),
      nonce: intent.nonce.toString(),
      status: intent.status,
      createdAt: intent.createdAt,
      updatedAt: intent.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching intent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

