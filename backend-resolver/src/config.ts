import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { readFileSync } from "fs";
import { resolve } from "path";

export const PROGRAM_ID = new PublicKey(
  "DnYdx4D9ugWqL4YUYsiKk2AsaVXV9vmEqXKVWKpCm6yu"
);

export const RPC_URL =
  process.env.RPC_URL || "https://api.devnet.solana.com";

export const connection = new Connection(RPC_URL, "confirmed");

export function loadAuthorityKeypair(): Keypair {
  const secretEnv = process.env.ESCROW_AUTHORITY_SECRET;
  if (secretEnv) {
    const secretKey = bs58.decode(secretEnv);
    return Keypair.fromSecretKey(secretKey);
  }

  // Fall back to local keypair file
  const keypairPath = resolve(
    import.meta.dir,
    "..",
    "authority-keypair.json"
  );
  const keypairData = JSON.parse(readFileSync(keypairPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SUPABASE_KEY = process.env.SUPABASE_KEY!;

export const HOUSE_WALLET = new PublicKey(
  process.env.HOUSE_WALLET || "11111111111111111111111111111111"
);

export const SKR_MINT = new PublicKey(
  process.env.SKR_MINT || "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3"
);
