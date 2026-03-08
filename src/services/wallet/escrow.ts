/**
 * Wager / Escrow Service — Dual-path implementation
 *
 * Dev mode (authToken === 'dev_token'): Supabase simulation, auto-succeed
 * On-chain mode: Build raw instructions, sign via MWA, read on-chain state
 */

import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { supabase } from '../../config/supabase';
import { getConnection, signAndSendTransaction } from './solanaWallet';
import { TurboModuleRegistry } from 'react-native';
import {
  HOUSE_CUT_PERCENT,
  ESCROW_PROGRAM_ID,
  BACKEND_RESOLVER_URL,
  SOL_WAGER_LAMPORTS,
  SKR_WAGER_BASE_UNITS,
} from '../../config/constants';
import {
  getEscrowPDA,
  getVaultPDA,
  hashMatchId,
  buildDepositSolIx,
  buildDepositSplIx,
  deserializeEscrowAccount,
} from './escrowInstructions';

// ─── Constants ────────────────────────────────────────────
const PROTOCOL_FEE_BPS = HOUSE_CUT_PERCENT * 100; // 2% = 200 bps

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
  escrowAddress?: string;
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

function isDevMode(authToken: string): boolean {
  return !isMWAAvailable() || authToken === 'dev_token' || !ESCROW_PROGRAM_ID;
}

// ─── Initialize Escrow (called by backend after match created) ───
export async function initializeEscrow(
  matchId: string,
  playerAWallet: string,
  playerBWallet: string,
  wagerType: WagerType,
  authToken: string,
): Promise<{ escrowAddress: string; success: boolean }> {
  if (isDevMode(authToken)) {
    // Dev mode: create Supabase record
    const escrow = await createEscrowRecord(matchId, playerAWallet, playerBWallet, wagerType);
    return { escrowAddress: `dev_${matchId}`, success: true };
  }

  // On-chain: call backend resolver to initialize
  try {
    const res = await fetch(`${BACKEND_RESOLVER_URL}/api/initialize-escrow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId,
        playerA: playerAWallet,
        playerB: playerBWallet,
        wagerType,
        wagerAmount: wagerType === 'sol' ? SOL_WAGER_LAMPORTS : SKR_WAGER_BASE_UNITS,
      }),
    });
    const data = await res.json();
    return { escrowAddress: data.escrowAddress || '', success: data.success };
  } catch (err) {
    console.error('[Escrow] Initialize failed:', err);
    return { escrowAddress: '', success: false };
  }
}

// ─── Deposit Wager ────────────────────────────────────────
export async function depositToEscrow(
  matchId: string,
  playerId: string,
  walletAddress: string,
  authToken: string,
  wagerType: WagerType,
): Promise<{ success: boolean; txSig?: string; simulated?: boolean }> {
  if (isDevMode(authToken)) {
    return simulateDeposit(matchId, playerId);
  }

  try {
    const matchIdHash = await hashMatchId(matchId);
    const [escrowPDA] = getEscrowPDA(matchIdHash);
    const [vaultPDA] = getVaultPDA(escrowPDA);

    let tx: Transaction;

    if (wagerType === 'sol') {
      const ix = buildDepositSolIx(
        new PublicKey(walletAddress),
        escrowPDA,
        vaultPDA,
      );
      tx = new Transaction().add(ix);
    } else {
      // SPL deposit - need player's ATA and escrow's ATA
      const { getAssociatedTokenAddress } = await import('./tokenUtils');
      const mint = new PublicKey(
        (await import('../../config/constants')).SKR_MINT_ADDRESS
      );
      const playerATA = await getAssociatedTokenAddress(mint, new PublicKey(walletAddress));
      const escrowATA = await getAssociatedTokenAddress(mint, escrowPDA, true);

      const ix = buildDepositSplIx(
        new PublicKey(walletAddress),
        escrowPDA,
        playerATA,
        escrowATA,
      );
      tx = new Transaction().add(ix);
    }

    const txSig = await signAndSendTransaction(tx, authToken);
    return { success: true, txSig };
  } catch (err: any) {
    console.error('[Escrow] Deposit failed:', err);
    return { success: false };
  }
}

// ─── Get Escrow Status (on-chain read) ────────────────────
export async function getEscrowStatus(
  matchId: string,
  authToken: string,
): Promise<{
  status: string;
  playerADeposited: boolean;
  playerBDeposited: boolean;
} | null> {
  if (isDevMode(authToken)) {
    return getEscrowStatusFromDB(matchId);
  }

  try {
    const matchIdHash = await hashMatchId(matchId);
    const [escrowPDA] = getEscrowPDA(matchIdHash);
    const conn = getConnection();
    const accountInfo = await conn.getAccountInfo(escrowPDA);

    if (!accountInfo || !accountInfo.data) return null;

    const escrow = deserializeEscrowAccount(Buffer.from(accountInfo.data));
    const statusMap: Record<number, string> = {
      0: 'pending',
      1: 'funded',
      2: 'resolved',
      3: 'refunded',
    };

    return {
      status: statusMap[escrow.status] || 'unknown',
      playerADeposited: escrow.playerADeposited,
      playerBDeposited: escrow.playerBDeposited,
    };
  } catch (err) {
    console.error('[Escrow] Status read failed:', err);
    return null;
  }
}

// ─── Dev Mode Helpers ─────────────────────────────────────
async function createEscrowRecord(
  matchId: string,
  playerAId: string,
  playerBId: string,
  wagerType: WagerType,
): Promise<WagerEscrow> {
  const escrow: WagerEscrow = {
    matchId,
    playerAId,
    playerBId,
    wagerType,
    wagerAmount: wagerType === 'sol' ? SOL_WAGER_LAMPORTS : SKR_WAGER_BASE_UNITS,
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
  } catch (e) { /* ignore if table doesn't exist */ }

  return escrow;
}

async function simulateDeposit(
  matchId: string,
  playerId: string,
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
    return { success: true, simulated: true }; // Always succeed in dev
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

async function getEscrowStatusFromDB(matchId: string): Promise<{
  status: string;
  playerADeposited: boolean;
  playerBDeposited: boolean;
} | null> {
  try {
    const { data } = await supabase
      .from('escrows')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (!data) return { status: 'pending', playerADeposited: true, playerBDeposited: true };

    return {
      status: data.status || 'pending',
      playerADeposited: data.player_a_deposited || false,
      playerBDeposited: data.player_b_deposited || false,
    };
  } catch {
    // In dev mode, just auto-succeed
    return { status: 'funded', playerADeposited: true, playerBDeposited: true };
  }
}

async function isPlayerAInEscrow(matchId: string, playerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('escrows')
    .select('player_a_id')
    .eq('match_id', matchId)
    .single();

  return data?.player_a_id === playerId;
}

// ─── Display Helpers ──────────────────────────────────────
export function getWagerDisplay(wagerType: WagerType): string {
  return wagerType === 'sol' ? '0.05 SOL' : '50 SKR';
}

export const WAGER_LAMPORTS = SOL_WAGER_LAMPORTS;
export const WAGER_SKR = SKR_WAGER_BASE_UNITS;
