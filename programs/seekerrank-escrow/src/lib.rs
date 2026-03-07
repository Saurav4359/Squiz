use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use state::WagerType;

// Re-export everything for the #[program] macro's __client_accounts modules
pub use instructions::initialize_escrow::*;
pub use instructions::deposit_sol::*;
pub use instructions::deposit_spl::*;
pub use instructions::resolve_match::*;
pub use instructions::refund_match::*;

declare_id!("DnYdx4D9ugWqL4YUYsiKk2AsaVXV9vmEqXKVWKpCm6yu");

#[program]
pub mod seekerrank_escrow {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        match_id_hash: [u8; 32],
        wager_amount: u64,
        wager_type: WagerType,
    ) -> Result<()> {
        instructions::initialize_escrow::handler(ctx, match_id_hash, wager_amount, wager_type)
    }

    pub fn deposit_sol(ctx: Context<DepositSol>) -> Result<()> {
        instructions::deposit_sol::handler(ctx)
    }

    pub fn deposit_spl(ctx: Context<DepositSpl>) -> Result<()> {
        instructions::deposit_spl::handler(ctx)
    }

    pub fn resolve_match(ctx: Context<ResolveMatch>) -> Result<()> {
        instructions::resolve_match::handler(ctx)
    }

    pub fn refund_match(ctx: Context<RefundMatch>) -> Result<()> {
        instructions::refund_match::handler(ctx)
    }
}
