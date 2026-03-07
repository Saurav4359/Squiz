use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct EscrowAccount {
    /// SHA-256 hash of the match ID string
    pub match_id: [u8; 32],
    /// Player A public key
    pub player_a: Pubkey,
    /// Player B public key
    pub player_b: Pubkey,
    /// SOL or SPL wager
    pub wager_type: WagerType,
    /// Wager amount in lamports (SOL) or base units (SPL)
    pub wager_amount: u64,
    /// Whether player A has deposited
    pub player_a_deposited: bool,
    /// Whether player B has deposited
    pub player_b_deposited: bool,
    /// Current escrow status
    pub status: EscrowStatus,
    /// Backend authority that can resolve/refund
    pub authority: Pubkey,
    /// House wallet for fee collection
    pub house_wallet: Pubkey,
    /// SPL token mint (zero pubkey for SOL wagers)
    pub token_mint: Pubkey,
    /// PDA bump seed
    pub bump: u8,
    /// Creation timestamp
    pub created_at: i64,
}

impl EscrowAccount {
    /// 8 (discriminator) + 32 + 32 + 32 + 1 + 8 + 1 + 1 + 1 + 32 + 32 + 32 + 1 + 8 = 221
    pub const LEN: usize = 8 + 32 + 32 + 32 + 1 + 8 + 1 + 1 + 1 + 32 + 32 + 32 + 1 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum WagerType {
    #[default]
    Sol,
    Spl,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum EscrowStatus {
    #[default]
    AwaitingDeposits,
    Funded,
    Resolved,
    Refunded,
}
