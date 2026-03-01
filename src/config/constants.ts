// API Keys
export const GROQ_API_KEY = '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';
export const HELIUS_RPC_URL = 'https://api.devnet.solana.com'; // Fallback until Helius key is provided

// Solana
export const SKR_MINT_ADDRESS = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
export const ESCROW_PROGRAM_ID = ''; // Will be set after deployment

// Quiz Settings
export const QUESTIONS_PER_MATCH = 5;
export const SECONDS_PER_QUESTION = 10;
export const MIN_WAGER_SOL = 0.01;
export const MAX_WAGER_SOL = 0.1;
export const DEFAULT_WAGER_SOL = 0.05;

// Rating System (Elo)
export const DEFAULT_RATING = 1200;
export const K_FACTOR = 32; // How much rating changes per match
export const MIN_RATING = 100;

// XP System
export const XP_WIN = 75;
export const XP_LOSS = 15;
export const XP_DRAW = 30;
export const XP_QUEST_COMPLETE = 50;
export const XP_STREAK_BONUS = 100;
export const SKR_STAKER_MULTIPLIER = 1.5;

// User Roles
export const ROLES = [
  'Trader',
  'Developer',
  'NFT Collector',
  'DeFi User',
  'Researcher',
  'Beginner',
] as const;

export type UserRole = typeof ROLES[number];
