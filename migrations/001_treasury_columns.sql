-- Run this migration in Supabase SQL Editor to add treasury columns to existing matches table

-- Add treasury deposit/payout columns
ALTER TABLE matches ADD COLUMN IF NOT EXISTS wager_amount BIGINT DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_a_deposit_tx TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_b_deposit_tx TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS payout_tx TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS payout_lamports BIGINT;

-- Remove old escrow columns (safe to drop)
ALTER TABLE matches DROP COLUMN IF EXISTS escrow_address;
ALTER TABLE matches DROP COLUMN IF EXISTS escrow_status;
