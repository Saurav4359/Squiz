use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::error::EscrowError;
use crate::state::*;

#[derive(Accounts)]
pub struct RefundMatch<'info> {
    /// Backend authority
    #[account(
        mut,
        constraint = authority.key() == escrow.authority @ EscrowError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    /// Escrow account
    #[account(
        mut,
        constraint = (
            escrow.status == EscrowStatus::AwaitingDeposits ||
            escrow.status == EscrowStatus::Funded
        ) @ EscrowError::InvalidStatus,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// SOL vault PDA
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA used as SOL vault
    pub vault: UncheckedAccount<'info>,

    /// Player A account (refund destination)
    /// CHECK: Validated against escrow.player_a
    #[account(
        mut,
        constraint = player_a.key() == escrow.player_a,
    )]
    pub player_a: UncheckedAccount<'info>,

    /// Player B account (refund destination)
    /// CHECK: Validated against escrow.player_b
    #[account(
        mut,
        constraint = player_b.key() == escrow.player_b,
    )]
    pub player_b: UncheckedAccount<'info>,

    /// Escrow's token account (for SPL refunds)
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Player A's token account
    #[account(mut)]
    pub player_a_token_account: Account<'info, TokenAccount>,

    /// Player B's token account
    #[account(mut)]
    pub player_b_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RefundMatch>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;

    match escrow.wager_type {
        WagerType::Sol => {
            let escrow_key = escrow.key();
            let vault_bump = ctx.bumps.vault;
            let vault_seeds: &[&[u8]] = &[b"vault", escrow_key.as_ref(), &[vault_bump]];
            let signer_seeds: &[&[&[u8]]] = &[vault_seeds];

            // Refund player A if deposited
            if escrow.player_a_deposited {
                system_program::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.vault.to_account_info(),
                            to: ctx.accounts.player_a.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    escrow.wager_amount,
                )?;
            }

            // Refund player B if deposited
            if escrow.player_b_deposited {
                system_program::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.vault.to_account_info(),
                            to: ctx.accounts.player_b.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    escrow.wager_amount,
                )?;
            }

            msg!("SOL refunded to players");
        }
        WagerType::Spl => {
            let match_id = escrow.match_id;
            let escrow_bump = escrow.bump;
            let escrow_seeds: &[&[u8]] = &[b"escrow", match_id.as_ref(), &[escrow_bump]];

            if escrow.player_a_deposited {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.escrow_token_account.to_account_info(),
                            to: ctx.accounts.player_a_token_account.to_account_info(),
                            authority: escrow.to_account_info(),
                        },
                        &[escrow_seeds],
                    ),
                    escrow.wager_amount,
                )?;
            }

            if escrow.player_b_deposited {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.escrow_token_account.to_account_info(),
                            to: ctx.accounts.player_b_token_account.to_account_info(),
                            authority: escrow.to_account_info(),
                        },
                        &[escrow_seeds],
                    ),
                    escrow.wager_amount,
                )?;
            }

            msg!("SPL refunded to players");
        }
    }

    escrow.status = EscrowStatus::Refunded;
    msg!("Match refunded");
    Ok(())
}
