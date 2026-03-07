use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::error::EscrowError;
use crate::state::*;

#[derive(Accounts)]
pub struct DepositSpl<'info> {
    /// Player depositing SPL tokens
    #[account(mut)]
    pub player: Signer<'info>,

    /// Escrow account
    #[account(
        mut,
        constraint = escrow.wager_type == WagerType::Spl @ EscrowError::WagerTypeMismatch,
        constraint = escrow.status == EscrowStatus::AwaitingDeposits @ EscrowError::InvalidStatus,
        constraint = (
            player.key() == escrow.player_a || player.key() == escrow.player_b
        ) @ EscrowError::InvalidPlayer,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// Player's token account (source)
    #[account(
        mut,
        constraint = player_token_account.owner == player.key(),
        constraint = player_token_account.mint == escrow.token_mint,
    )]
    pub player_token_account: Account<'info, TokenAccount>,

    /// Escrow's ATA (destination)
    #[account(
        mut,
        constraint = escrow_token_account.owner == escrow.key(),
        constraint = escrow_token_account.mint == escrow.token_mint,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<DepositSpl>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let player_key = ctx.accounts.player.key();

    let is_player_a = player_key == escrow.player_a;
    if is_player_a {
        require!(!escrow.player_a_deposited, EscrowError::AlreadyDeposited);
    } else {
        require!(!escrow.player_b_deposited, EscrowError::AlreadyDeposited);
    }

    // Transfer SPL tokens from player to escrow's ATA
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.player_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        ),
        escrow.wager_amount,
    )?;

    if is_player_a {
        escrow.player_a_deposited = true;
    } else {
        escrow.player_b_deposited = true;
    }

    if escrow.player_a_deposited && escrow.player_b_deposited {
        escrow.status = EscrowStatus::Funded;
        msg!("Escrow fully funded!");
    }

    msg!("SPL deposit received from {}", player_key);
    Ok(())
}
