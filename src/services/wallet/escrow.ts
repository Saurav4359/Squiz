/**
 * Wager / Escrow Service
 *
 * Handles SOL/SKR wager deposits and payouts.
 * 2% house cut on every match.
 *
 * Production: Replace with a Solana escrow program (smart contract).
 * Dev/Hackathon: Simulated via Supabase DB tracking.
 */

import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { supabase } from '../../config/supabase';
import { getConnection, signAndSendTransaction } from '../wallet/solanaWallet';
import { TurboModuleRegistry } from 'react-native';
import { HOUSE_CUT_PERCENT } from '../../config/constants';

// ─── Constants ────────────────────────────────────────────
const ESCROW_WALLET = 'EScRoW111SeekerRankProtocolV1000000000000000'; // placeholder
const PROTOCOL_FEE_BPS = HOUSE_CUT_PERCENT * 100; // 2% = 200 bps

const SOL_WAGER = 0.05 * LAMPORTS_PER_SOL;
const SKR_WAGER = 10;

export type WagerType = 'sol' | 'skr';

export interface WagerEscrow {
  matchId: string;
  playerAId: string;
  playerBId: string;
  wagerType: WagerType;
  wagerAmount: number;
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
    await supabase.from('escrows').insert({
      match_id: matchId,
      player_a_id: playerAId,
      player_b_id: playerBId,
      wager_type: wagerType,
      wager_amount: escrow.wagerAmount,
      status: 'pending',
      created_at: escrow.createdAt,
    });
  } catch (e) { /* ignore if table doesn't exist yet */ }

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
    return simulateDeposit(matchId, playerId);
  }

  try {
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
      const isA = await isPlayerAInEscrow(matchId, playerId);

      await supabase
        .from('escrows')
        .update(isA
          ? { player_a_deposited: true, player_a_tx_sig: txSig }
          : { player_b_deposited: true, player_b_tx_sig: txSig }
        )
        .eq('match_id', matchId);

      await checkAndFundEscrow(matchId);
      return { success: true, txSig };
    }

    return simulateDeposit(matchId, playerId);
  } catch (err: any) {
    console.error('[Escrow] Deposit failed:', err);
    return { success: false };
  }
}

async function simulateDeposit(
  matchId: string,
  playerId: string
): Promise<{ success: boolean; simulated: boolean }> {
  try {
    const isA = await isPlayerAInEscrow(matchId, playerId);
    await supabase
      .from('escrows')
      .update(isA ? { player_a_deposited: true } : { player_b_deposited: true })
      .eq('match_id', matchId);

    await checkAndFundEscrow(matchId);
    return { success: true, simulated: true };
  } catch {
    return { success: false, simulated: true };
  }
}

async function checkAndFundEscrow(matchId: string): Promise<void> {
  const { data } = await supabase
    .from('escrows')
    .select('*')
    .eq('match_id', matchId)
    .single();

  if (!data) return;
  if (data.player_a_deposited && data.player_b_deposited) {
    await supabase
      .from('escrows')
      .update({ status: 'funded' })
      .eq('match_id', matchId);
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
  const { data: escrow } = await supabase
    .from('escrows')
    .select('*')
    .eq('match_id', matchId)
    .single();

  if (!escrow || escrow.status !== 'funded') return { success: false };

  if (!isMWAAvailable() || authToken === 'dev_token') {
    await supabase
      .from('escrows')
      .update({
        status: 'resolved',
        winner_id: winnerId,
        resolved_at: Date.now(),
        payout_tx_sig: `simulated_${Date.now()}`,
      })
      .eq('match_id', matchId);
    return { success: true, simulated: true };
  }

  try {
    if (wagerType === 'sol') {
      const totalWager = (escrow.wager_amount || SOL_WAGER) * 2;
      const fee = Math.floor(totalWager * PROTOCOL_FEE_BPS / 10000);
      const payout = totalWager - fee;

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(ESCROW_WALLET),
          toPubkey: new PublicKey(winnerWalletAddress),
          lamports: payout,
        })
      );

      const txSig = await signAndSendTransaction(tx, authToken);
      await supabase
        .from('escrows')
        .update({
          status: 'resolved',
          winner_id: winnerId,
          resolved_at: Date.now(),
          payout_tx_sig: txSig,
        })
        .eq('match_id', matchId);
      return { success: true, txSig };
    }

    await supabase
      .from('escrows')
      .update({ status: 'resolved', winner_id: winnerId, resolved_at: Date.now() })
      .eq('match_id', matchId);
    return { success: true, simulated: true };
  } catch (err) {
    console.error('[Escrow] Resolve failed:', err);
    return { success: false };
  }
}

export async function refundEscrow(matchId: string): Promise<void> {
  try {
    await supabase
      .from('escrows')
      .update({ status: 'refunded', resolved_at: Date.now() })
      .eq('match_id', matchId);
  } catch (err) {
    console.error('[Escrow] Refund failed:', err);
  }
}

export async function getEscrow(matchId: string): Promise<WagerEscrow | null> {
  const { data } = await supabase
    .from('escrows')
    .select('*')
    .eq('match_id', matchId)
    .single();

  return data as WagerEscrow | null;
}

async function isPlayerAInEscrow(matchId: string, playerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('escrows')
    .select('player_a_id')
    .eq('match_id', matchId)
    .single();

  return data?.player_a_id === playerId;
}

export function getWagerDisplay(wagerType: WagerType): string {
  return wagerType === 'sol' ? '0.05 SOL' : '10 SKR';
}

export const WAGER_LAMPORTS = SOL_WAGER;
export const WAGER_SKR = SKR_WAGER;
