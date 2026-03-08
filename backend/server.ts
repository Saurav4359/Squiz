/**
 * Squiz Treasury Payout Server
 *
 * Minimal Bun + Hono backend that:
 *   1. Holds the treasury wallet private key (treasury.json)
 *   2. Verifies player deposit transactions
 *   3. Sends payouts to match winners
 *
 * Run: bun run server.ts
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Configuration ────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001;
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const HOUSE_CUT_BPS = Number(process.env.HOUSE_CUT_BPS) || 200; // 2% = 200 basis points

// ─── Load Treasury Keypair ────────────────────────────────
const TREASURY_PATH = resolve(import.meta.dir, 'treasury.json');
let treasuryKeypair: Keypair;

try {
  const raw = readFileSync(TREASURY_PATH, 'utf-8');
  const secretKey = new Uint8Array(JSON.parse(raw));
  treasuryKeypair = Keypair.fromSecretKey(secretKey);
  console.log(`💰 Treasury wallet: ${treasuryKeypair.publicKey.toBase58()}`);
} catch (err) {
  console.error('❌ Failed to load treasury.json — run: solana-keygen new --outfile backend/treasury.json');
  process.exit(1);
}

// ─── Solana Connection ────────────────────────────────────
const connection = new Connection(RPC_URL, 'confirmed');

// ─── Hono App ─────────────────────────────────────────────
const app = new Hono();

app.use('*', cors());

// Health check
app.get('/', (c) => c.json({ status: 'ok', treasury: treasuryKeypair.publicKey.toBase58() }));

// GET /treasury — returns the treasury public key so the mobile app can send deposits
app.get('/treasury', (c) => {
  return c.json({
    address: treasuryKeypair.publicKey.toBase58(),
  });
});

// POST /verify-deposit — verify that a deposit tx actually sent SOL to treasury
app.post('/verify-deposit', async (c) => {
  try {
    const { txSignature, expectedLamports } = await c.req.json<{
      txSignature: string;
      expectedLamports: number;
    }>();

    if (!txSignature) {
      return c.json({ verified: false, error: 'Missing txSignature' }, 400);
    }

    // Fetch the transaction from the chain
    const tx = await connection.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!tx || tx.meta?.err) {
      return c.json({ verified: false, error: 'Transaction not found or failed' }, 400);
    }

    // Check that the transaction includes a transfer TO the treasury
    const treasuryAddress = treasuryKeypair.publicKey.toBase58();
    const instructions = tx.transaction.message.instructions;

    let depositedLamports = 0;
    let senderAddress = '';

    for (const ix of instructions) {
      if ('parsed' in ix && ix.program === 'system' && ix.parsed?.type === 'transfer') {
        const info = ix.parsed.info;
        if (info.destination === treasuryAddress) {
          depositedLamports += info.lamports;
          senderAddress = info.source;
        }
      }
    }

    if (depositedLamports <= 0) {
      return c.json({ verified: false, error: 'No transfer to treasury found in tx' }, 400);
    }

    // Allow a small tolerance (0.5%) for fee differences
    const minExpected = expectedLamports * 0.995;
    if (depositedLamports < minExpected) {
      return c.json({
        verified: false,
        error: `Deposited ${depositedLamports} lamports but expected ${expectedLamports}`,
      }, 400);
    }

    return c.json({
      verified: true,
      senderAddress,
      depositedLamports,
    });
  } catch (err: any) {
    console.error('[verify-deposit] Error:', err.message);
    return c.json({ verified: false, error: err.message }, 500);
  }
});

// POST /payout — send winnings from treasury to winner
app.post('/payout', async (c) => {
  try {
    const { matchId, winnerWallet, lamports } = await c.req.json<{
      matchId: string;
      winnerWallet: string;
      lamports: number;
    }>();

    if (!winnerWallet || !lamports || lamports <= 0) {
      return c.json({ success: false, error: 'Invalid payout request' }, 400);
    }

    if (!matchId) {
      return c.json({ success: false, error: 'Missing matchId' }, 400);
    }

    // Apply house cut
    const houseCut = Math.floor(lamports * HOUSE_CUT_BPS / 10000);
    const payoutLamports = lamports - houseCut;

    console.log(`[Payout] Match: ${matchId}`);
    console.log(`  Pool: ${lamports / LAMPORTS_PER_SOL} SOL`);
    console.log(`  House cut: ${houseCut / LAMPORTS_PER_SOL} SOL (${HOUSE_CUT_BPS / 100}%)`);
    console.log(`  Payout: ${payoutLamports / LAMPORTS_PER_SOL} SOL → ${winnerWallet}`);

    // Check treasury balance
    const balance = await connection.getBalance(treasuryKeypair.publicKey);
    if (balance < payoutLamports + 5000) {
      console.error(`[Payout] Insufficient treasury balance: ${balance} < ${payoutLamports}`);
      return c.json({ success: false, error: 'Insufficient treasury balance' }, 500);
    }

    // Build and send transfer
    const winnerPubkey = new PublicKey(winnerWallet);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: winnerPubkey,
        lamports: payoutLamports,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair]);

    console.log(`[Payout] ✅ Sent! Signature: ${signature}`);

    return c.json({
      success: true,
      signature,
      payoutLamports,
      houseCut,
    });
  } catch (err: any) {
    console.error('[Payout] Error:', err.message);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /refund — refund both players (draw or cancelled match)
app.post('/refund', async (c) => {
  try {
    const { matchId, playerAWallet, playerBWallet, lamportsEach } = await c.req.json<{
      matchId: string;
      playerAWallet: string;
      playerBWallet: string;
      lamportsEach: number;
    }>();

    if (!playerAWallet || !playerBWallet || !lamportsEach || lamportsEach <= 0) {
      return c.json({ success: false, error: 'Invalid refund request' }, 400);
    }

    console.log(`[Refund] Match: ${matchId} — ${lamportsEach / LAMPORTS_PER_SOL} SOL each`);

    const balance = await connection.getBalance(treasuryKeypair.publicKey);
    const totalRefund = lamportsEach * 2;
    if (balance < totalRefund + 10000) {
      return c.json({ success: false, error: 'Insufficient treasury balance for refund' }, 500);
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: new PublicKey(playerAWallet),
        lamports: lamportsEach,
      }),
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: new PublicKey(playerBWallet),
        lamports: lamportsEach,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair]);
    console.log(`[Refund] ✅ Sent! Signature: ${signature}`);

    return c.json({ success: true, signature });
  } catch (err: any) {
    console.error('[Refund] Error:', err.message);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ─── Start Server ─────────────────────────────────────────
export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(`🚀 Treasury server running on http://localhost:${PORT}`);
