use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::error::EscrowError;
use crate::state::*;

#[derive(Accounts)]
pub struct ResolveMatch<'info> {
    /// Backend authority - only they can resolve
    #[account(
        mut,
        constraint = authority.key() == escrow.authority @ EscrowError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    /// Escrow account
    #[account(
        mut,
        constraint = escrow.status == EscrowStatus::Funded @ EscrowError::NotFunded,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// SOL vault PDA (for SOL wagers)
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA used as SOL vault
    pub vault: UncheckedAccount<'info>,

    /// Winner's account (receives payout)
    /// CHECK: Validated against escrow players below
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,

    /// House wallet (receives fee)
    /// CHECK: Validated against escrow house_wallet
    #[account(
        mut,
        constraint = house_wallet.key() == escrow.house_wallet,
    )]
    pub house_wallet: UncheckedAccount<'info>,

    /// Escrow's token account (for SPL wagers)
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Winner's token account (for SPL wagers)
    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// House token account (for SPL fee)
    #[account(mut)]
    pub house_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ResolveMatch>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let winner_key = ctx.accounts.winner.key();

    // Validate winner is a participant
    require!(
        winner_key == escrow.player_a || winner_key == escrow.player_b,
        EscrowError::InvalidWinner
    );

    let total_pot = escrow
        .wager_amount
        .checked_mul(2)
        .ok_or(EscrowError::Overflow)?;

    // 2% fee = 200 bps
    let fee = total_pot
        .checked_mul(200)
        .ok_or(EscrowError::Overflow)?
        .checked_div(10000)
        .ok_or(EscrowError::Overflow)?;

    let payout = total_pot.checked_sub(fee).ok_or(EscrowError::Overflow)?;

    match escrow.wager_type {
        WagerType::Sol => {
            // Transfer payout from vault to winner
            let escrow_key = escrow.key();
            let vault_bump = ctx.bumps.vault;
            let vault_seeds: &[&[u8]] = &[b"vault", escrow_key.as_ref(), &[vault_bump]];
            let signer_seeds: &[&[&[u8]]] = &[vault_seeds];

            // Payout to winner
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.winner.to_account_info(),
                    },
                    signer_seeds,
                ),
                payout,
            )?;

            // Fee to house
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.house_wallet.to_account_info(),
                    },
                    signer_seeds,
                ),
                fee,
            )?;

            msg!(
                "SOL resolved: {} to winner, {} fee. Seeds: {:?}",
                payout,
                fee,
                vault_seeds.len()
            );
        }
        WagerType::Spl => {
            let match_id = escrow.match_id;
            let escrow_bump = escrow.bump;
            let escrow_seeds: &[&[u8]] = &[b"escrow", match_id.as_ref(), &[escrow_bump]];

            // Payout SPL to winner
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_token_account.to_account_info(),
                        to: ctx.accounts.winner_token_account.to_account_info(),
                        authority: escrow.to_account_info(),
                    },
                    &[escrow_seeds],
                ),
                payout,
            )?;

            // Fee SPL to house
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_token_account.to_account_info(),
                        to: ctx.accounts.house_token_account.to_account_info(),
                        authority: escrow.to_account_info(),
                    },
                    &[escrow_seeds],
                ),
                fee,
            )?;

            msg!("SPL resolved: {} to winner, {} fee", payout, fee);
        }
    }

    escrow.status = EscrowStatus::Resolved;
    msg!("Match resolved! Winner: {}", winner_key);
    Ok(())
}
