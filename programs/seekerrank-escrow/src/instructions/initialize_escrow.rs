use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::state::*;

#[derive(Accounts)]
#[instruction(match_id_hash: [u8; 32], wager_amount: u64, wager_type: WagerType)]
pub struct InitializeEscrow<'info> {
    /// Authority (backend signer) that creates the escrow
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Escrow PDA: seeds = ["escrow", match_id_hash]
    #[account(
        init,
        payer = authority,
        space = EscrowAccount::LEN,
        seeds = [b"escrow", match_id_hash.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// SOL vault PDA: seeds = ["vault", escrow]
    /// Only used for SOL wagers, but always created for simplicity
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
    )]
    /// CHECK: This is a PDA used as a SOL vault, validated by seeds
    pub vault: UncheckedAccount<'info>,

    /// Player A pubkey (not a signer - backend initializes)
    /// CHECK: Just storing the pubkey, no signing needed
    pub player_a: UncheckedAccount<'info>,

    /// Player B pubkey
    /// CHECK: Just storing the pubkey, no signing needed
    pub player_b: UncheckedAccount<'info>,

    /// House wallet for fee collection
    /// CHECK: Just storing the pubkey
    pub house_wallet: UncheckedAccount<'info>,

    /// Token mint (pass system program if SOL wager)
    pub token_mint: Account<'info, Mint>,

    /// Escrow's ATA for SPL tokens (only needed for SPL wagers)
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializeEscrow>,
    match_id_hash: [u8; 32],
    wager_amount: u64,
    wager_type: WagerType,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    escrow.match_id = match_id_hash;
    escrow.player_a = ctx.accounts.player_a.key();
    escrow.player_b = ctx.accounts.player_b.key();
    escrow.wager_type = wager_type;
    escrow.wager_amount = wager_amount;
    escrow.player_a_deposited = false;
    escrow.player_b_deposited = false;
    escrow.status = EscrowStatus::AwaitingDeposits;
    escrow.authority = ctx.accounts.authority.key();
    escrow.house_wallet = ctx.accounts.house_wallet.key();
    escrow.token_mint = ctx.accounts.token_mint.key();
    escrow.bump = ctx.bumps.escrow;
    escrow.created_at = Clock::get()?.unix_timestamp;

    msg!(
        "Escrow initialized for match. PlayerA: {}, PlayerB: {}, Amount: {}",
        escrow.player_a,
        escrow.player_b,
        wager_amount
    );

    Ok(())
}
