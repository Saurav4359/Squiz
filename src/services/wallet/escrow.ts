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
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
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

  await setDoc(doc(db, 'escrows', matchId), escrow);
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
      await updateDoc(doc(db, 'escrows', matchId), {
        ...(isPlayerA
          ? { playerADeposited: true, playerATxSig: txSig }
          : { playerBDeposited: true, playerBTxSig: txSig }),
      });

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
    await updateDoc(doc(db, 'escrows', matchId), {
      ...(isA
        ? { playerADeposited: true }
        : { playerBDeposited: true }),
    });
    await checkAndFundEscrow(matchId);
    return { success: true, simulated: true };
  } catch {
    return { success: false, simulated: true };
  }
}

// ─── Check if both deposited ─────────────────────────────
async function checkAndFundEscrow(matchId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'escrows', matchId));
  if (!snap.exists()) return;
  const escrow = snap.data() as WagerEscrow;

  if (escrow.playerADeposited && escrow.playerBDeposited) {
    await updateDoc(doc(db, 'escrows', matchId), { status: 'funded' });
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
  const snap = await getDoc(doc(db, 'escrows', matchId));
  if (!snap.exists()) return { success: false };

  const escrow = snap.data() as WagerEscrow;
  if (escrow.status !== 'funded') return { success: false };

  if (!isMWAAvailable() || authToken === 'dev_token') {
    // Simulate payout
    await updateDoc(doc(db, 'escrows', matchId), {
      status: 'resolved',
      winnerId,
      resolvedAt: Date.now(),
      payoutTxSig: `simulated_${Date.now()}`,
    });
    return { success: true, simulated: true };
  }

  try {
    if (wagerType === 'sol') {
      const totalWager = escrow.wagerAmount * 2;
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
      await updateDoc(doc(db, 'escrows', matchId), {
        status: 'resolved',
        winnerId,
        resolvedAt: Date.now(),
        payoutTxSig: txSig,
      });
      return { success: true, txSig };
    }

    // SKR payout: simulated for now
    await updateDoc(doc(db, 'escrows', matchId), {
      status: 'resolved',
      winnerId,
      resolvedAt: Date.now(),
    });
    return { success: true, simulated: true };
  } catch (err) {
    console.error('[Escrow] Resolve failed:', err);
    return { success: false };
  }
}

// ─── Refund on cancelled match ────────────────────────────
export async function refundEscrow(matchId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'escrows', matchId), {
      status: 'refunded',
      resolvedAt: Date.now(),
    });
    // In production: send refund transactions back to both players
    console.log(`[Escrow] Refunded match ${matchId}`);
  } catch (err) {
    console.error('[Escrow] Refund failed:', err);
  }
}

// ─── Get escrow status ────────────────────────────────────
export async function getEscrow(matchId: string): Promise<WagerEscrow | null> {
  const snap = await getDoc(doc(db, 'escrows', matchId));
  return snap.exists() ? (snap.data() as WagerEscrow) : null;
}

// ─── Helper ───────────────────────────────────────────────
async function isPlayerAInEscrow(matchId: string, playerId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'escrows', matchId));
  if (!snap.exists()) return false;
  return snap.data().playerAId === playerId;
}

// ─── Wager amounts for UI display ────────────────────────
export function getWagerDisplay(wagerType: WagerType): string {
  return wagerType === 'sol' ? '0.05 SOL' : '10 SKR';
}

export const WAGER_LAMPORTS = SOL_WAGER;
export const WAGER_SKR = SKR_WAGER;
