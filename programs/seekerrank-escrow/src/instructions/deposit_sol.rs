use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::error::EscrowError;
use crate::state::*;

#[derive(Accounts)]
pub struct DepositSol<'info> {
    /// Player depositing SOL
    #[account(mut)]
    pub player: Signer<'info>,

    /// Escrow account
    #[account(
        mut,
        constraint = escrow.wager_type == WagerType::Sol @ EscrowError::WagerTypeMismatch,
        constraint = escrow.status == EscrowStatus::AwaitingDeposits @ EscrowError::InvalidStatus,
        constraint = (
            player.key() == escrow.player_a || player.key() == escrow.player_b
        ) @ EscrowError::InvalidPlayer,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// SOL vault PDA
    #[account(
        mut,
        seeds = [b"vault", escrow.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA used as SOL vault, validated by seeds
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositSol>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let player_key = ctx.accounts.player.key();

    // Check which player and prevent double deposits
    let is_player_a = player_key == escrow.player_a;
    if is_player_a {
        require!(!escrow.player_a_deposited, EscrowError::AlreadyDeposited);
    } else {
        require!(!escrow.player_b_deposited, EscrowError::AlreadyDeposited);
    }

    // Transfer SOL from player to vault PDA
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        escrow.wager_amount,
    )?;

    // Mark deposit
    if is_player_a {
        escrow.player_a_deposited = true;
    } else {
        escrow.player_b_deposited = true;
    }

    // Auto-transition to Funded when both deposit
    if escrow.player_a_deposited && escrow.player_b_deposited {
        escrow.status = EscrowStatus::Funded;
        msg!("Escrow fully funded!");
    }

    msg!("SOL deposit received from {}", player_key);
    Ok(())
}
