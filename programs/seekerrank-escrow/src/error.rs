use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Invalid escrow status for this operation")]
    InvalidStatus,
    #[msg("Player is not part of this escrow")]
    InvalidPlayer,
    #[msg("Player has already deposited")]
    AlreadyDeposited,
    #[msg("Only the authority can perform this action")]
    Unauthorized,
    #[msg("Wager type mismatch")]
    WagerTypeMismatch,
    #[msg("Winner is not a participant in this match")]
    InvalidWinner,
    #[msg("Escrow is not fully funded")]
    NotFunded,
    #[msg("Arithmetic overflow")]
    Overflow,
}
