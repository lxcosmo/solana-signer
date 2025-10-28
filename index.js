import express from "express";
import cors from "cors";
import bs58 from "bs58";
import { VersionedTransaction, Keypair } from "@solana/web3.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PRIV58 = process.env.PRIVATE_KEY_BASE58;

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/sign", async (req, res) => {
  try {
    let { transaction } = req.body || {};
    if (!transaction) return res.status(400).json({ error: "missing transaction" });
    if (!PRIV58) return res.status(500).json({ error: "signer not configured" });

    // --- sanitize base64 ---
    transaction = String(transaction).trim();
    // 
    transaction = transaction.replace(/\s+/g, "");
    // 
    transaction = transaction.replace(/-/g, "+").replace(/_/g, "/");
    // 
    const pad = transaction.length % 4;
    if (pad) transaction = transaction + "=".repeat(4 - pad);

    const kp = Keypair.fromSecretKey(bs58.decode(PRIV58));

    let signedBase64;
    try {
      // v0: VersionedTransaction
      const vtx = VersionedTransaction.deserialize(Buffer.from(transaction, "base64"));
      vtx.sign([kp]);
      signedBase64 = Buffer.from(vtx.serialize()).toString("base64");
    } catch (e1) {
      // fallback: legacy Transaction
      const { Transaction } = await import("@solana/web3.js");
      const tx = Transaction.from(Buffer.from(transaction, "base64"));
      tx.partialSign(kp);
      signedBase64 = tx.serialize().toString("base64");
    }

    return res.json({ signedTransaction: signedBase64 });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Signer on " + PORT));
