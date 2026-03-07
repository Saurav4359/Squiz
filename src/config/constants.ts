// API Keys (use env vars in production)
export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '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';
export const HELIUS_RPC_URL = process.env.EXPO_PUBLIC_HELIUS_RPC_URL || 'https://devnet.helius-rpc.com/?api-key=8cb5e526-7ec0-4290-8943-13f9442457f2';

// Solana
export const SKR_MINT_ADDRESS = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
export const ESCROW_PROGRAM_ID = '';

// Quiz Settings
export const QUESTIONS_PER_MATCH = 5;
export const SECONDS_ANSWER_PHASE = 10;
export const SECONDS_QUESTION_PHASE = 2;
export const MIN_WAGER_SOL = 0.01;
export const MAX_WAGER_SOL = 0.1;
export const DEFAULT_WAGER_SOL = 0.05;

// House cut
export const HOUSE_CUT_PERCENT = 2;

// Rating System (Elo)
export const DEFAULT_RATING = 1200;
export const K_FACTOR = 32;
export const MIN_RATING = 100;

// XP System
export const XP_WIN = 75;
export const XP_LOSS = 15;
export const XP_DRAW = 30;
export const XP_QUEST_COMPLETE = 50;
export const XP_STREAK_BONUS = 100;
export const SKR_STAKER_MULTIPLIER = 1.5;
