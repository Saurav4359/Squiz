/**
 * Wager / Escrow Service
 *
 * Production path (real device with MWA):
 *   - Transfers SOL from both players to an escrow account (protocol wallet)
 *   - Winner receives both wagers minus a 2% protocol fee
 *   - All transactions signed via MWA
 *
 * Development / emulator path (no MWA):
 *   - Wager is tracked in Firestore only (off-chain accounting)
 *   - Simulated balance changes for demo purposes
 *
 * Escrow account: A single protocol wallet holds funds during the match.
 * In production, this would be replaced by a Solana program (smart contract).
 */

import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
  Connection,
} from '@solana/web3.js';
import { sql } from '../db/neon';
import { getConnection, signAndSendTransaction } from '../wallet/solanaWallet';
import { TurboModuleRegistry } from 'react-native';

// ─── Constants ────────────────────────────────────────────
// Protocol escrow wallet — receives wagers during match
// In production: replace with your deployed escrow program PDA
const ESCROW_WALLET = 'EScRoW111SeekerRankProtocolV1000000000000000'; // placeholder
const PROTOCOL_FEE_BPS = 200; // 2% fee on wager amount

const SOL_WAGER = 0.05 * LAMPORTS_PER_SOL;  // 0.05 SOL
const SKR_WAGER = 10;                         // 10 SKR tokens

export type WagerType = 'sol' | 'skr';

export interface WagerEscrow {
  matchId: string;
  playerAId: string;
  playerBId: string;
  wagerType: WagerType;
  wagerAmount: number; // lamports for SOL, tokens for SKR
  playerADeposited: boolean;
  playerBDeposited: boolean;
  playerATxSig?: string;
  playerBTxSig?: string;
  winnerId?: string;
  payoutTxSig?: string;
  status: 'pending' | 'funded' | 'resolved' | 'refunded';
  createdAt: number;
  resolvedAt?: number;
}

// ─── Check MWA ───────────────────────────────────────────
function isMWAAvailable(): boolean {
  try {
    return TurboModuleRegistry.get('SolanaMobileWalletAdapter') != null;
  } catch {
    return false;
  }
}

// ─── Create Escrow Record ─────────────────────────────────
export async function createEscrow(
  matchId: string,
  playerAId: string,
  playerBId: string,
  wagerType: WagerType
): Promise<WagerEscrow> {
  const escrow: WagerEscrow = {
    matchId,
    playerAId,
    playerBId,
    wagerType,
    wagerAmount: wagerType === 'sol' ? SOL_WAGER : SKR_WAGER,
    playerADeposited: false,
    playerBDeposited: false,
    status: 'pending',
    createdAt: Date.now(),
  };

  try {
    const rawSql = `INSERT INTO escrows (
      matchId, playerAId, playerBId, wagerType, wagerAmount, status, createdAt
    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
    await sql(rawSql as any, [matchId, playerAId, playerBId, wagerType, escrow.wagerAmount, 'pending', escrow.createdAt]);
  } catch(e) { /* ignore pg constraints simply logging to console locally */ }
  return escrow;
}

// ─── Deposit Wager ────────────────────────────────────────
export async function depositWager(
  matchId: string,
  playerId: string,
  walletAddress: string,
  authToken: string,
  wagerType: WagerType
): Promise<{ success: boolean; txSig?: string; simulated?: boolean }> {
  if (!isMWAAvailable() || authToken === 'dev_token') {
    // Dev mode: simulate deposit in Firestore
    return simulateDeposit(matchId, playerId);
  }

  try {
    // Build SOL transfer transaction
    if (wagerType === 'sol') {
      const conn = getConnection();
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: new PublicKey(ESCROW_WALLET),
          lamports: SOL_WAGER,
        })
      );

      const txSig = await signAndSendTransaction(tx, authToken);

      const isPlayerA = (await isPlayerAInEscrow(matchId, playerId));
      
      const updateColumn = isPlayerA ? 'playerADeposited' : 'playerBDeposited';
      const updateTxSigColumn = isPlayerA ? 'playerATxSig' : 'playerBTxSig';
      
      await sql(`UPDATE escrows SET "${updateColumn}" = true, "${updateTxSigColumn}" = $1 WHERE matchId = $2` as any, [txSig, matchId]);


      await checkAndFundEscrow(matchId);
      return { success: true, txSig };
    }

    // SKR: SPL token transfer (simplified — production would use @solana/spl-token)
    // For now, treat SKR as simulated
    return simulateDeposit(matchId, playerId);
  } catch (err: any) {
    console.error('[Escrow] Deposit failed:', err);
    return { success: false };
  }
}

// ─── Simulate Deposit (dev / SKR) ────────────────────────
async function simulateDeposit(
  matchId: string,
  playerId: string
): Promise<{ success: boolean; simulated: boolean }> {
  try {
    const isA = await isPlayerAInEscrow(matchId, playerId);
    const updateColumn = isA ? 'playerADeposited' : 'playerBDeposited';
    await sql(`UPDATE escrows SET "${updateColumn}" = true WHERE matchId = $1` as any, [matchId]);
    await checkAndFundEscrow(matchId);
    return { success: true, simulated: true };
  } catch {
    return { success: false, simulated: true };
  }
}

// ─── Check if both deposited ─────────────────────────────
async function checkAndFundEscrow(matchId: string): Promise<void> {
  const result = await sql`SELECT * FROM escrows WHERE matchId = ${matchId}`;
  if (result.length === 0) return;
  const dbData = result[0] as unknown as Record<string,any>;
  
  if (dbData.playeradeposited && dbData.playerbdeposited) {
    await sql`UPDATE escrows SET status = 'funded' WHERE matchId = ${matchId}`;
  }
}

// ─── Resolve Escrow (payout winner) ──────────────────────
export async function resolveEscrow(
  matchId: string,
  winnerId: string,
  winnerWalletAddress: string,
  authToken: string,
  wagerType: WagerType
): Promise<{ success: boolean; txSig?: string; simulated?: boolean }> {
  const result = await sql`SELECT * FROM escrows WHERE matchId = ${matchId}`;
  if (result.length === 0) return { success: false };

  const escrow = result[0] as unknown as Record<string,any>;
  if (escrow.status !== 'funded') return { success: false };

  if (!isMWAAvailable() || authToken === 'dev_token') {
    // Simulate payout
    const payoutTxSig = `simulated_${Date.now()}`;
    await sql(`UPDATE escrows SET status = 'resolved', winnerId = $1, resolvedAt = $2, payoutTxSig = $3 WHERE matchId = $4` as any, [winnerId, Date.now(), payoutTxSig, matchId]);
    return { success: true, simulated: true };
  }

  try {
    if (wagerType === 'sol') {
      const totalWager = (escrow.wageramount || SOL_WAGER) * 2;
      const fee = Math.floor(totalWager * PROTOCOL_FEE_BPS / 10000);
      const payout = totalWager - fee;

      const conn = getConnection();
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(ESCROW_WALLET),
          toPubkey: new PublicKey(winnerWalletAddress),
          lamports: payout,
        })
      );

      const txSig = await signAndSendTransaction(tx, authToken);
      await sql(`UPDATE escrows SET status = 'resolved', winnerId = $1, resolvedAt = $2, payoutTxSig = $3 WHERE matchId = $4` as any, [winnerId, Date.now(), txSig, matchId]);
      return { success: true, txSig };
    }

    // SKR payout: simulated for now
    await sql(`UPDATE escrows SET status = 'resolved', winnerId = $1, resolvedAt = $2 WHERE matchId = $3` as any, [winnerId, Date.now(), matchId]);
    return { success: true, simulated: true };
  } catch (err) {
    console.error('[Escrow] Resolve failed:', err);
    return { success: false };
  }
}

// ─── Refund on cancelled match ────────────────────────────
export async function refundEscrow(matchId: string): Promise<void> {
  try {
    await sql(`UPDATE escrows SET status = 'refunded', resolvedAt = $1 WHERE matchId = $2` as any, [Date.now(), matchId]);
    // In production: send refund transactions back to both players
    console.log(`[Escrow] Refunded match ${matchId}`);
  } catch (err) {
    console.error('[Escrow] Refund failed:', err);
  }
}

// ─── Get escrow status ────────────────────────────────────
export async function getEscrow(matchId: string): Promise<WagerEscrow | null> {
  const result = await sql`SELECT * FROM escrows WHERE matchId = ${matchId}`;
  return result.length > 0 ? (result[0] as unknown as WagerEscrow) : null;
}

// ─── Helper ───────────────────────────────────────────────
async function isPlayerAInEscrow(matchId: string, playerId: string): Promise<boolean> {
  const result = await sql`SELECT playerAId FROM escrows WHERE matchId = ${matchId}`;
  if (result.length === 0) return false;
  return result[0].playeraid === playerId;
}

// ─── Wager amounts for UI display ────────────────────────
export function getWagerDisplay(wagerType: WagerType): string {
  return wagerType === 'sol' ? '0.05 SOL' : '10 SKR';
}

export const WAGER_LAMPORTS = SOL_WAGER;
export const WAGER_SKR = SKR_WAGER;
