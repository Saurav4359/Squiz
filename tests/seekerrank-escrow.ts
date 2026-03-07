import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { createHash } from "crypto";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/seekerrank_escrow.json"), "utf8"));

const PROGRAM_ID = new PublicKey("DnYdx4D9ugWqL4YUYsiKk2AsaVXV9vmEqXKVWKpCm6yu");

describe("seekerrank-escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(idl as any, provider);
  const authority = provider.wallet as anchor.Wallet;

  const playerA = Keypair.generate();
  const playerB = Keypair.generate();
  const houseWallet = Keypair.generate();

  const WAGER_SOL = 0.05 * LAMPORTS_PER_SOL; // 50,000,000 lamports
  const WAGER_SPL = 10_000_000_000; // 10 tokens with 9 decimals

  let tokenMint: PublicKey;
  let matchIdHash: Uint8Array;
  let escrowPDA: PublicKey;
  let escrowBump: number;
  let vaultPDA: PublicKey;
  let vaultBump: number;

  function hashMatchId(matchId: string): Uint8Array {
    return new Uint8Array(createHash("sha256").update(matchId).digest());
  }

  before(async () => {
    // Airdrop to players and house wallet
    const conn = provider.connection;
    await conn.requestAirdrop(playerA.publicKey, 2 * LAMPORTS_PER_SOL);
    await conn.requestAirdrop(playerB.publicKey, 2 * LAMPORTS_PER_SOL);
    await conn.requestAirdrop(houseWallet.publicKey, LAMPORTS_PER_SOL);
    await conn.requestAirdrop(authority.publicKey, 5 * LAMPORTS_PER_SOL);

    // Wait for airdrops
    await new Promise((r) => setTimeout(r, 2000));
  });

  describe("SOL Escrow", () => {
    const matchId = "test_match_sol_001";

    before(() => {
      matchIdHash = hashMatchId(matchId);
      [escrowPDA, escrowBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(matchIdHash)],
        program.programId
      );
      [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), escrowPDA.toBuffer()],
        program.programId
      );
    });

    it("initializes escrow", async () => {
      // For SOL wagers, we still need a token mint for the instruction.
      // Create a dummy mint for the init_if_needed ATA creation.
      tokenMint = await createMint(
        provider.connection,
        authority.payer,
        authority.publicKey,
        null,
        9
      );

      const escrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        escrowPDA,
        true
      );

      await program.methods
        .initializeEscrow(
          Array.from(matchIdHash),
          new BN(WAGER_SOL),
          { sol: {} }
        )
        .accounts({
          authority: authority.publicKey,
          escrow: escrowPDA,
          vault: vaultPDA,
          playerA: playerA.publicKey,
          playerB: playerB.publicKey,
          houseWallet: houseWallet.publicKey,
          tokenMint: tokenMint,
          escrowTokenAccount: escrowTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(escrowPDA);
      assert.equal(escrow.wagerAmount.toNumber(), WAGER_SOL);
      assert.ok(escrow.playerA.equals(playerA.publicKey));
      assert.ok(escrow.playerB.equals(playerB.publicKey));
      assert.ok(!escrow.playerADeposited);
      assert.ok(!escrow.playerBDeposited);
      assert.ok("awaitingDeposits" in escrow.status);
    });

    it("player A deposits SOL", async () => {
      await program.methods
        .depositSol()
        .accounts({
          player: playerA.publicKey,
          escrow: escrowPDA,
          vault: vaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([playerA])
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(escrowPDA);
      assert.ok(escrow.playerADeposited);
      assert.ok(!escrow.playerBDeposited);
      assert.ok("awaitingDeposits" in escrow.status);
    });

    it("player B deposits SOL (auto-funds)", async () => {
      await program.methods
        .depositSol()
        .accounts({
          player: playerB.publicKey,
          escrow: escrowPDA,
          vault: vaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([playerB])
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(escrowPDA);
      assert.ok(escrow.playerADeposited);
      assert.ok(escrow.playerBDeposited);
      assert.ok("funded" in escrow.status);

      // Check vault has 2x wager
      const vaultBalance = await provider.connection.getBalance(vaultPDA);
      assert.equal(vaultBalance, WAGER_SOL * 2);
    });

    it("rejects double deposit", async () => {
      try {
        await program.methods
          .depositSol()
          .accounts({
            player: playerA.publicKey,
            escrow: escrowPDA,
            vault: vaultPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([playerA])
          .rpc();
        assert.fail("Should have thrown");
      } catch (err: any) {
        assert.ok(err.toString().includes("AlreadyDeposited") || err.toString().includes("InvalidStatus"));
      }
    });

    it("resolves match (winner gets payout)", async () => {
      const escrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        escrowPDA,
        true
      );

      // Dummy token accounts for the SOL path (not actually used but required by IDL)
      const winnerTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        playerA.publicKey
      );
      const houseTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        houseWallet.publicKey
      );
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority.payer,
        tokenMint,
        playerA.publicKey
      );
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority.payer,
        tokenMint,
        houseWallet.publicKey
      );

      const playerABalBefore = await provider.connection.getBalance(playerA.publicKey);
      const houseBalBefore = await provider.connection.getBalance(houseWallet.publicKey);

      await program.methods
        .resolveMatch()
        .accounts({
          authority: authority.publicKey,
          escrow: escrowPDA,
          vault: vaultPDA,
          winner: playerA.publicKey,
          houseWallet: houseWallet.publicKey,
          escrowTokenAccount: escrowTokenAccount,
          winnerTokenAccount: winnerTokenAccount,
          houseTokenAccount: houseTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(escrowPDA);
      assert.ok("resolved" in escrow.status);

      // Check payouts
      const totalPot = WAGER_SOL * 2;
      const fee = Math.floor((totalPot * 200) / 10000); // 2%
      const payout = totalPot - fee;

      const playerABalAfter = await provider.connection.getBalance(playerA.publicKey);
      const houseBalAfter = await provider.connection.getBalance(houseWallet.publicKey);

      assert.equal(playerABalAfter - playerABalBefore, payout);
      assert.equal(houseBalAfter - houseBalBefore, fee);
    });
  });

  describe("Refund", () => {
    const matchId = "test_match_refund_001";
    let refundEscrowPDA: PublicKey;
    let refundVaultPDA: PublicKey;
    let refundMatchIdHash: Uint8Array;

    before(async () => {
      refundMatchIdHash = hashMatchId(matchId);
      [refundEscrowPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(refundMatchIdHash)],
        program.programId
      );
      [refundVaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), refundEscrowPDA.toBuffer()],
        program.programId
      );

      const escrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        refundEscrowPDA,
        true
      );

      // Initialize
      await program.methods
        .initializeEscrow(
          Array.from(refundMatchIdHash),
          new BN(WAGER_SOL),
          { sol: {} }
        )
        .accounts({
          authority: authority.publicKey,
          escrow: refundEscrowPDA,
          vault: refundVaultPDA,
          playerA: playerA.publicKey,
          playerB: playerB.publicKey,
          houseWallet: houseWallet.publicKey,
          tokenMint: tokenMint,
          escrowTokenAccount: escrowTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      // Both deposit
      await program.methods
        .depositSol()
        .accounts({
          player: playerA.publicKey,
          escrow: refundEscrowPDA,
          vault: refundVaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([playerA])
        .rpc();

      await program.methods
        .depositSol()
        .accounts({
          player: playerB.publicKey,
          escrow: refundEscrowPDA,
          vault: refundVaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([playerB])
        .rpc();
    });

    it("refunds both players", async () => {
      const escrowTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        refundEscrowPDA,
        true
      );
      const playerATokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        playerA.publicKey
      );
      const playerBTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        playerB.publicKey
      );
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority.payer,
        tokenMint,
        playerA.publicKey
      );
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        authority.payer,
        tokenMint,
        playerB.publicKey
      );

      const playerABalBefore = await provider.connection.getBalance(playerA.publicKey);
      const playerBBalBefore = await provider.connection.getBalance(playerB.publicKey);

      await program.methods
        .refundMatch()
        .accounts({
          authority: authority.publicKey,
          escrow: refundEscrowPDA,
          vault: refundVaultPDA,
          playerA: playerA.publicKey,
          playerB: playerB.publicKey,
          escrowTokenAccount: escrowTokenAccount,
          playerATokenAccount: playerATokenAccount,
          playerBTokenAccount: playerBTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const escrow = await program.account.escrowAccount.fetch(refundEscrowPDA);
      assert.ok("refunded" in escrow.status);

      const playerABalAfter = await provider.connection.getBalance(playerA.publicKey);
      const playerBBalAfter = await provider.connection.getBalance(playerB.publicKey);

      assert.equal(playerABalAfter - playerABalBefore, WAGER_SOL);
      assert.equal(playerBBalAfter - playerBBalBefore, WAGER_SOL);
    });
  });
});
