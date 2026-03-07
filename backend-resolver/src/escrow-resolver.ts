import { Program, AnchorProvider, web3, BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { createHash } from "crypto";
import {
  PROGRAM_ID,
  connection,
  loadAuthorityKeypair,
  HOUSE_WALLET,
  SKR_MINT,
} from "./config.js";

// Load the IDL at module level
import idl from "../../target/idl/seekerrank_escrow.json";

type SeekerrankEscrow = any;

function getProgram(): Program<SeekerrankEscrow> {
  const authority = loadAuthorityKeypair();
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as any, PROGRAM_ID, provider);
}

/**
 * SHA256 hash of matchId, returns first 32 bytes as Uint8Array
 */
export function getMatchIdHash(matchId: string): Uint8Array {
  const hash = createHash("sha256").update(matchId).digest();
  return new Uint8Array(hash.buffer, hash.byteOffset, 32);
}

/**
 * Derive the escrow PDA from ["escrow", matchIdHash]
 */
export function getEscrowPDA(
  matchIdHash: Uint8Array
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), Buffer.from(matchIdHash)],
    PROGRAM_ID
  );
}

/**
 * Derive the vault PDA from ["vault", escrowPubkey]
 */
export function getVaultPDA(
  escrowPubkey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrowPubkey.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Initialize an escrow account on-chain for a match.
 */
export async function initializeEscrowOnChain(
  matchId: string,
  playerAPubkey: string,
  playerBPubkey: string,
  wagerType: "sol" | "skr",
  wagerAmountLamports: number
): Promise<string> {
  const program = getProgram();
  const authority = loadAuthorityKeypair();

  const matchIdHash = getMatchIdHash(matchId);
  const [escrowPDA] = getEscrowPDA(matchIdHash);
  const [vaultPDA] = getVaultPDA(escrowPDA);

  const playerA = new PublicKey(playerAPubkey);
  const playerB = new PublicKey(playerBPubkey);

  const tokenMint = wagerType === "skr" ? SKR_MINT : PublicKey.default;
  const escrowTokenAccount =
    wagerType === "skr"
      ? await getAssociatedTokenAddress(tokenMint, escrowPDA, true)
      : PublicKey.default;

  const wagerTypeArg =
    wagerType === "sol" ? { sol: {} } : { spl: {} };

  const tx = await program.methods
    .initializeEscrow(
      Array.from(matchIdHash),
      new BN(wagerAmountLamports),
      wagerTypeArg
    )
    .accounts({
      authority: authority.publicKey,
      escrow: escrowPDA,
      vault: vaultPDA,
      playerA: playerA,
      playerB: playerB,
      houseWallet: HOUSE_WALLET,
      tokenMint: tokenMint,
      escrowTokenAccount: escrowTokenAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([authority])
    .rpc();

  console.log(`[initializeEscrow] tx: ${tx} for match: ${matchId}`);
  return tx;
}

/**
 * Resolve a match on-chain, sending winnings to the winner and house fee.
 */
export async function resolveMatchOnChain(
  matchId: string,
  winnerPubkey: string,
  wagerType: "sol" | "skr"
): Promise<string> {
  const program = getProgram();
  const authority = loadAuthorityKeypair();

  const matchIdHash = getMatchIdHash(matchId);
  const [escrowPDA] = getEscrowPDA(matchIdHash);
  const [vaultPDA] = getVaultPDA(escrowPDA);

  const winner = new PublicKey(winnerPubkey);

  // Fetch the escrow account to get stored data
  const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
  const tokenMint = escrowAccount.tokenMint as PublicKey;

  let escrowTokenAccount: PublicKey;
  let winnerTokenAccount: PublicKey;
  let houseTokenAccount: PublicKey;

  if (wagerType === "skr") {
    escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowPDA,
      true
    );
    winnerTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      winner
    );
    houseTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      HOUSE_WALLET
    );
  } else {
    // For SOL wagers, token accounts are not used but still required by the IDL
    escrowTokenAccount = PublicKey.default;
    winnerTokenAccount = PublicKey.default;
    houseTokenAccount = PublicKey.default;
  }

  const tx = await program.methods
    .resolveMatch()
    .accounts({
      authority: authority.publicKey,
      escrow: escrowPDA,
      vault: vaultPDA,
      winner: winner,
      houseWallet: HOUSE_WALLET,
      escrowTokenAccount: escrowTokenAccount,
      winnerTokenAccount: winnerTokenAccount,
      houseTokenAccount: houseTokenAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([authority])
    .rpc();

  console.log(`[resolveMatch] tx: ${tx} for match: ${matchId}, winner: ${winnerPubkey}`);
  return tx;
}

/**
 * Refund a match on-chain, returning deposits to both players.
 */
export async function refundMatchOnChain(
  matchId: string
): Promise<string> {
  const program = getProgram();
  const authority = loadAuthorityKeypair();

  const matchIdHash = getMatchIdHash(matchId);
  const [escrowPDA] = getEscrowPDA(matchIdHash);
  const [vaultPDA] = getVaultPDA(escrowPDA);

  // Fetch escrow to get player pubkeys and token info
  const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);
  const playerA = escrowAccount.playerA as PublicKey;
  const playerB = escrowAccount.playerB as PublicKey;
  const tokenMint = escrowAccount.tokenMint as PublicKey;
  const isSpl =
    escrowAccount.wagerType &&
    typeof escrowAccount.wagerType === "object" &&
    "spl" in (escrowAccount.wagerType as any);

  let escrowTokenAccount: PublicKey;
  let playerATokenAccount: PublicKey;
  let playerBTokenAccount: PublicKey;

  if (isSpl) {
    escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowPDA,
      true
    );
    playerATokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      playerA
    );
    playerBTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      playerB
    );
  } else {
    escrowTokenAccount = PublicKey.default;
    playerATokenAccount = PublicKey.default;
    playerBTokenAccount = PublicKey.default;
  }

  const tx = await program.methods
    .refundMatch()
    .accounts({
      authority: authority.publicKey,
      escrow: escrowPDA,
      vault: vaultPDA,
      playerA: playerA,
      playerB: playerB,
      escrowTokenAccount: escrowTokenAccount,
      playerATokenAccount: playerATokenAccount,
      playerBTokenAccount: playerBTokenAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([authority])
    .rpc();

  console.log(`[refundMatch] tx: ${tx} for match: ${matchId}`);
  return tx;
}

/**
 * Read the on-chain escrow status for a match.
 */
export async function getEscrowStatus(
  matchId: string
): Promise<{
  status: string;
  playerADeposited: boolean;
  playerBDeposited: boolean;
} | null> {
  const program = getProgram();
  const matchIdHash = getMatchIdHash(matchId);
  const [escrowPDA] = getEscrowPDA(matchIdHash);

  try {
    const escrowAccount = await program.account.escrowAccount.fetch(escrowPDA);

    // Determine status string from the enum variant
    let status = "unknown";
    const wagerStatus = escrowAccount.status as any;
    if (wagerStatus) {
      if ("awaitingDeposits" in wagerStatus) status = "awaiting_deposits";
      else if ("funded" in wagerStatus) status = "funded";
      else if ("resolved" in wagerStatus) status = "resolved";
      else if ("refunded" in wagerStatus) status = "refunded";
    }

    return {
      status,
      playerADeposited: escrowAccount.playerADeposited as boolean,
      playerBDeposited: escrowAccount.playerBDeposited as boolean,
    };
  } catch (err: any) {
    // Account does not exist
    if (
      err?.message?.includes("Account does not exist") ||
      err?.message?.includes("could not find account")
    ) {
      return null;
    }
    throw err;
  }
}
