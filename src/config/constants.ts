// API Keys (use env vars in production)
export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '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';
export const HELIUS_RPC_URL = process.env.EXPO_PUBLIC_HELIUS_RPC_URL || 'https://devnet.helius-rpc.com/?api-key=8cb5e526-7ec0-4290-8943-13f9442457f2';

// News & Data Source API Keys
export const TAVILY_API_KEY = process.env.EXPO_PUBLIC_TAVILY_API_KEY || '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';
export const CRYPTOPANIC_API_KEY = process.env.EXPO_PUBLIC_CRYPTOPANIC_API_KEY || '033ac71aab25462a29f002cbb7993ded10a882fe';
export const TWITTER_BEARER_TOKEN = process.env.EXPO_PUBLIC_TWITTER_BEARER_TOKEN || 'AAAAAAAAAAAAAAAAAAAAABNz8AEAAAAA0wg95Mhb6VI5GcA2Jx3V6dofhPc%3DWK8D21A1vfGguxySziUKZdsPkDXLTWqqQy57taWh2aJAUrRjo4';
export const LUNARCRUSH_API_KEY = process.env.EXPO_PUBLIC_LUNARCRUSH_API_KEY || '6d7cl8eijvao7edcbt6lhjrbqsmmhey29c2oayh7';
export const COINGECKO_API_KEY = process.env.EXPO_PUBLIC_COINGECKO_API_KEY || 'CG-8PCP7LTzcTYFDFu3EUCkzrGe';
export const SANTIMENT_API_KEY = process.env.EXPO_PUBLIC_SANTIMENT_API_KEY || '7mezwxmljkatfdyo_zed2njhwvxyafx4a';
export const THE_GRAPH_API_KEY = process.env.EXPO_PUBLIC_THE_GRAPH_API_KEY || '193a0d5b7c43f1fadd830e3ad53ff641';
export const QUICKNODE_API_KEY = process.env.EXPO_PUBLIC_QUICKNODE_API_KEY || 'QN_7a653a971bb34a8b9b28cc821c9a216f';
export const BIRDEYE_API_KEY = process.env.EXPO_PUBLIC_BIRDEYE_API_KEY || '40d4abd71e2b4425bb724c3b3e7aa889';

// Solana
export const SKR_MINT_ADDRESS = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
export const ESCROW_PROGRAM_ID = 'DnYdx4D9ugWqL4YUYsiKk2AsaVXV9vmEqXKVWKpCm6yu';
export const MATCH_AUTHORITY_PUBKEY = ''; // Set after generating authority keypair
export const HOUSE_WALLET = ''; // Set to house wallet pubkey
export const SOL_WAGER_LAMPORTS = 50_000_000; // 0.05 SOL
export const SKR_WAGER_BASE_UNITS = 50_000_000_000; // 50 SKR (assuming 9 decimals)
export const BACKEND_RESOLVER_URL = process.env.EXPO_PUBLIC_RESOLVER_URL || 'http://localhost:3001';

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
