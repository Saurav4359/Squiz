/**
 * Raw Solana instructions for the seekerrank-escrow Anchor program.
 *
 * This module intentionally avoids importing @coral-xyz/anchor to keep
 * the React Native / mobile bundle small. All instruction building,
 * PDA derivation, and account deserialization is done manually.
 */

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import * as Crypto from 'expo-crypto';

// ─── Constants ─────────────────────────────────────────────────────────────────

export const ESCROW_PROGRAM_ID = new PublicKey(
  'DnYdx4D9ugWqL4YUYsiKk2AsaVXV9vmEqXKVWKpCm6yu'
);

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
);

// ─── Minimal synchronous SHA-256 (for Anchor discriminators) ───────────────────
// We need synchronous hashing for discriminator constants computed at module load.
// This is a compact JS SHA-256 implementation that works in any JS runtime.

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Sync(input: string): Uint8Array {
  // Convert string to UTF-8 bytes
  const encoder = new TextEncoder();
  const msg = encoder.encode(input);

  // Pre-processing: padding
  const bitLen = msg.length * 8;
  const padLen = ((msg.length + 9 + 63) & ~63); // next multiple of 64
  const padded = new Uint8Array(padLen);
  padded.set(msg);
  padded[msg.length] = 0x80;

  // Append length as 64-bit big-endian
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen, false);

  // Initial hash values
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3;
    let e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0, false);
  rv.setUint32(4, h1, false);
  rv.setUint32(8, h2, false);
  rv.setUint32(12, h3, false);
  rv.setUint32(16, h4, false);
  rv.setUint32(20, h5, false);
  rv.setUint32(24, h6, false);
  rv.setUint32(28, h7, false);
  return result;
}

// ─── Anchor Discriminators ─────────────────────────────────────────────────────
// Anchor discriminator = SHA256("global:<method_name>")[0..8]

function anchorDiscriminator(methodName: string): Uint8Array {
  return sha256Sync(`global:${methodName}`).slice(0, 8);
}

export const DISCRIMINATORS = {
  depositSol: anchorDiscriminator('deposit_sol'),
  depositSpl: anchorDiscriminator('deposit_spl'),
  initializeEscrow: anchorDiscriminator('initialize_escrow'),
  resolveMatch: anchorDiscriminator('resolve_match'),
  refundMatch: anchorDiscriminator('refund_match'),
} as const;

// ─── Match ID Hashing (async, uses expo-crypto) ────────────────────────────────

/**
 * Compute SHA-256 hash of a match ID string, returning raw bytes.
 * Uses expo-crypto for hardware-accelerated hashing on mobile.
 */
export async function hashMatchId(matchId: string): Promise<Uint8Array> {
  const hexHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    matchId,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  // Convert hex string to Uint8Array
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hexHash.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ─── PDA Derivation Helpers ────────────────────────────────────────────────────

/**
 * Derive the escrow PDA from a match ID hash.
 * Seeds: ["escrow", matchIdHash]
 */
export function getEscrowPDA(
  matchIdHash: Uint8Array
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(matchIdHash)],
    ESCROW_PROGRAM_ID
  );
}

/**
 * Derive the SOL vault PDA from the escrow account pubkey.
 * Seeds: ["vault", escrowPubkey]
 */
export function getVaultPDA(
  escrowPubkey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), escrowPubkey.toBuffer()],
    ESCROW_PROGRAM_ID
  );
}

// ─── Borsh Serialization Helpers ───────────────────────────────────────────────

/**
 * Encode a u64 value as 8 bytes little-endian.
 */
function encodeU64(value: number | bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  if (typeof value === 'bigint') {
    view.setBigUint64(0, value, true);
  } else {
    // For numbers within safe integer range
    view.setBigUint64(0, BigInt(value), true);
  }
  return new Uint8Array(buf);
}

/**
 * Encode an i64 value as 8 bytes little-endian.
 */
function encodeI64(value: number | bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  if (typeof value === 'bigint') {
    view.setBigInt64(0, value, true);
  } else {
    view.setBigInt64(0, BigInt(value), true);
  }
  return new Uint8Array(buf);
}

/**
 * Encode a u8 value.
 */
function encodeU8(value: number): Uint8Array {
  return new Uint8Array([value & 0xff]);
}

/**
 * Encode a boolean as a single byte.
 */
function encodeBool(value: boolean): Uint8Array {
  return new Uint8Array([value ? 1 : 0]);
}

/**
 * Concatenate multiple Uint8Arrays into one.
 */
function concatBytes(...arrays: Uint8Array[]): Buffer {
  const totalLen = arrays.reduce((acc, a) => acc + a.length, 0);
  const result = Buffer.alloc(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ─── Instruction Builders ──────────────────────────────────────────────────────

/**
 * Build a `deposit_sol` instruction.
 *
 * Accounts:
 *   0. player         (signer, writable)
 *   1. escrow         (writable)
 *   2. vault          (writable)
 *   3. systemProgram  (readonly)
 */
export function buildDepositSolIx(
  player: PublicKey,
  escrowPDA: PublicKey,
  vaultPDA: PublicKey
): TransactionInstruction {
  const data = Buffer.from(DISCRIMINATORS.depositSol);

  const keys = [
    { pubkey: player, isSigner: true, isWritable: true },
    { pubkey: escrowPDA, isSigner: false, isWritable: true },
    { pubkey: vaultPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Build a `deposit_spl` instruction.
 *
 * Accounts:
 *   0. player              (signer, writable)
 *   1. escrow              (writable)
 *   2. playerTokenAccount  (writable)
 *   3. escrowTokenAccount  (writable)
 *   4. tokenProgram        (readonly)
 */
export function buildDepositSplIx(
  player: PublicKey,
  escrowPDA: PublicKey,
  playerTokenAccount: PublicKey,
  escrowTokenAccount: PublicKey
): TransactionInstruction {
  const data = Buffer.from(DISCRIMINATORS.depositSpl);

  const keys = [
    { pubkey: player, isSigner: true, isWritable: true },
    { pubkey: escrowPDA, isSigner: false, isWritable: true },
    { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys,
    data,
  });
}

// ─── Account Deserialization ───────────────────────────────────────────────────

export enum WagerType {
  Sol = 0,
  Spl = 1,
}

export enum EscrowStatus {
  AwaitingDeposits = 0,
  Funded = 1,
  Resolved = 2,
  Refunded = 3,
}

export interface EscrowAccountData {
  /** SHA-256 hash of the match ID string (32 bytes) */
  matchId: Uint8Array;
  /** Player A public key */
  playerA: PublicKey;
  /** Player B public key */
  playerB: PublicKey;
  /** SOL or SPL wager */
  wagerType: WagerType;
  /** Wager amount in lamports (SOL) or base units (SPL) */
  wagerAmount: bigint;
  /** Whether player A has deposited */
  playerADeposited: boolean;
  /** Whether player B has deposited */
  playerBDeposited: boolean;
  /** Current escrow status */
  status: EscrowStatus;
  /** Backend authority that can resolve/refund */
  authority: PublicKey;
  /** House wallet for fee collection */
  houseWallet: PublicKey;
  /** SPL token mint (zero pubkey for SOL wagers) */
  tokenMint: PublicKey;
  /** PDA bump seed */
  bump: number;
  /** Creation timestamp (unix seconds) */
  createdAt: bigint;
}

/**
 * Deserialize raw account data into an EscrowAccountData object.
 *
 * Layout (after 8-byte Anchor discriminator):
 *   32 bytes  matchId        ([u8; 32])
 *   32 bytes  playerA        (Pubkey)
 *   32 bytes  playerB        (Pubkey)
 *    1 byte   wagerType      (enum: 0=Sol, 1=Spl)
 *    8 bytes  wagerAmount    (u64 LE)
 *    1 byte   playerADeposited (bool)
 *    1 byte   playerBDeposited (bool)
 *    1 byte   status         (enum: 0=AwaitingDeposits, 1=Funded, 2=Resolved, 3=Refunded)
 *   32 bytes  authority      (Pubkey)
 *   32 bytes  houseWallet    (Pubkey)
 *   32 bytes  tokenMint      (Pubkey)
 *    1 byte   bump           (u8)
 *    8 bytes  createdAt      (i64 LE)
 *  ─────────
 *  Total: 8 + 213 = 221 bytes
 */
export function deserializeEscrowAccount(data: Buffer): EscrowAccountData {
  // Skip the 8-byte Anchor discriminator
  let offset = 8;

  // matchId: [u8; 32]
  const matchId = new Uint8Array(data.subarray(offset, offset + 32));
  offset += 32;

  // playerA: Pubkey (32 bytes)
  const playerA = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  // playerB: Pubkey (32 bytes)
  const playerB = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  // wagerType: u8 enum
  const wagerType: WagerType = data[offset] as WagerType;
  offset += 1;

  // wagerAmount: u64 LE
  const view = new DataView(data.buffer, data.byteOffset);
  const wagerAmount = view.getBigUint64(offset, true);
  offset += 8;

  // playerADeposited: bool
  const playerADeposited = data[offset] !== 0;
  offset += 1;

  // playerBDeposited: bool
  const playerBDeposited = data[offset] !== 0;
  offset += 1;

  // status: u8 enum
  const status: EscrowStatus = data[offset] as EscrowStatus;
  offset += 1;

  // authority: Pubkey (32 bytes)
  const authority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  // houseWallet: Pubkey (32 bytes)
  const houseWallet = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  // tokenMint: Pubkey (32 bytes)
  const tokenMint = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  // bump: u8
  const bump = data[offset];
  offset += 1;

  // createdAt: i64 LE
  const createdAt = view.getBigInt64(offset, true);
  // offset += 8;

  return {
    matchId,
    playerA,
    playerB,
    wagerType,
    wagerAmount,
    playerADeposited,
    playerBDeposited,
    status,
    authority,
    houseWallet,
    tokenMint,
    bump,
    createdAt,
  };
}
