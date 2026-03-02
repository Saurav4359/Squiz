import { GROQ_API_KEY } from '../../config/constants';
import { UserRole } from '../../config/constants';
import { Question } from '../../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// ─── Question Generation ─────────────────────────────────

export async function generateQuestionsFromNews(
  newsItems: string[],
  role: UserRole,
  count: number = 5
): Promise<Question[]> {
  const newsText = newsItems.slice(0, 15).join('\n');
  const now = Date.now();
  const sevenDays = 7 * 86400000;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a quiz question generator for SeekerRank, a Solana/Web3 quiz battle app.

Rules:
- Questions must be 8-15 words max
- Exactly 4 options per question
- Only ONE correct answer, zero ambiguity
- Must be answerable in 5-10 seconds (knowledge recall, not reasoning)
- No trick questions
- Difficulty 1-5 (1=beginner, 5=expert)
- Questions should test real crypto/Solana knowledge

Return a JSON object with a "questions" array. No other text.`,
          },
          {
            role: 'user',
            content: `Generate ${count} ORIGINAL quiz questions for the "${role}" category.
            
            IMPORTANT: Use the LATEST developments and news items provided below. Do NOT repeat basic facts (like "what is SOL") unless there is a new update about it. Focus on recent news, TVL changes, trending tokens, or blog updates.

            Context about current Web3/Solana:
            ${newsText}
            
            Return EXACTLY this JSON format:
            {
              "questions": [
                {
                  "question": "Which DEX aggregator is largest on Solana?",
                  "options": ["Jupiter", "Uniswap", "PancakeSwap", "1inch"],
                  "correctIndex": 0,
                  "difficulty": 2
                }
              ]
            }`,
          },

        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Groq] API error ${response.status}:`, errText);
      return generateFallbackQuestions(role, count);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.warn('[Groq] Empty response');
      return generateFallbackQuestions(role, count);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn('[Groq] Invalid JSON, using fallback');
      return generateFallbackQuestions(role, count);
    }

    const rawQuestions: any[] = parsed.questions || (Array.isArray(parsed) ? parsed : []);

    if (rawQuestions.length === 0) {
      return generateFallbackQuestions(role, count);
    }

    return rawQuestions.slice(0, count).map((q: any, i: number) => {
      // Handle both "correctIndex" (number) and "correct" (letter) formats
      let correctIdx = 0;
      if (typeof q.correctIndex === 'number') {
        correctIdx = q.correctIndex;
      } else if (typeof q.correct === 'string') {
        correctIdx = ['A', 'B', 'C', 'D'].indexOf(q.correct.toUpperCase());
        if (correctIdx < 0) correctIdx = 0;
      }

      return {
        id: `groq_${now}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        question: String(q.question || '').slice(0, 200),
        options: validateOptions(q.options),
        correctIndex: Math.min(Math.max(correctIdx, 0), 3),
        role,
        difficulty: Math.min(Math.max(q.difficulty || 2, 1), 5),
        sourceDate: now,
        sourceSummary: 'AI-generated from latest Solana/Web3 news',
        createdAt: now,
        expiresAt: now + sevenDays,
      };
    });
  } catch (err) {
    console.error('[Groq] Fetch failed:', err);
    return generateFallbackQuestions(role, count);
  }
}

function validateOptions(opts: any): [string, string, string, string] {
  const defaults = ['Option A', 'Option B', 'Option C', 'Option D'];
  if (!Array.isArray(opts) || opts.length < 4) {
    return defaults as [string, string, string, string];
  }
  return [
    String(opts[0]).slice(0, 100),
    String(opts[1]).slice(0, 100),
    String(opts[2]).slice(0, 100),
    String(opts[3]).slice(0, 100),
  ];
}

// ─── News Fetching ───────────────────────────────────────

export async function fetchLatestNews(): Promise<string[]> {
  const newsItems: string[] = [];

  // Solana Blog via RSS2JSON (Solana Blogs source)
  try {
    const rssUrls = [
      'https://solana.com/news/rss',
      'https://solana.com/blog/rss'
    ];
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrls[Math.floor(Math.random() * rssUrls.length)])}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      (data.items?.slice(0, 8) || []).forEach((item: any) => {
        newsItems.push(`NEWS: ${item.title} - ${item.description?.slice(0, 100)}...`);
      });
    }
  } catch (e) {
    console.warn('[News] RSS fetch failed:', e);
  }

  // CoinGecko trending
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending', {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      (data.coins?.slice(0, 5) || []).forEach((coin: any) => {
        newsItems.push(
          `Trending Coin: ${coin.item.name} (${coin.item.symbol}) - Market Cap Rank: #${coin.item.market_cap_rank}`
        );
      });
    }
  } catch { /* skip */ }

  // DeFiLlama Solana TVL
  try {
    const res = await fetch('https://api.llama.fi/v2/chains', {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const chains = await res.json();
      const solana = chains.find((c: any) => c.name === 'Solana');
      if (solana) {
        newsItems.push(`Current Solana TVL: $${(solana.tvl / 1e9).toFixed(2)}B`);
      }
    }
  } catch { /* skip */ }

  // Evergreen Solana knowledge (shuffled and limited)
  const evergreen = [
    'Jupiter is the #1 DEX aggregator on Solana leading in volume and innovation',
    'Solana Seeker is the 2nd-gen crypto phone featuring Seed Vault and dApp store',
    'SKR token coordinates the Solana Mobile ecosystem and participation',
    'Mobile Wallet Adapter (MWA) 2.0 is the standard for mobile dapp connections',
    'Solana handles 4000+ real-time TPS with sub-second finality using PoH',
    'Marinade Finance and Jito lead the liquid staking and MEV landscape on Solana',
    'Helius and Triton provide critical RPC and data infrastructure for developers',
    'Tensor and Magic Eden dominate the Solana NFT marketplace volume',
    'Phantom and Solflare are the most used wallets in the Solana ecosystem',
    'Compressed NFTs (cNFTs) use state compression to reduce minting costs',
    'Solana Sealevel allows parallel execution of thousands of smart contracts',
    'Helium and Hivemapper are key DePIN projects successfully scaled on Solana',
    'Metaplex Core is the newest NFT standard for optimized performance',
    'Pyth Network delivers institutional-grade price feeds to Solana DeFi',
    'Firedancer is the new independent validator client being developed by Jump Crypto',
    'Solana Actions and Blinks allow crypto transactions on any website or social media',
    'The Solana Foundation supports ecosystem growth through grants and hackathons',
    'Twitter Pulse: High interest in Solana L2s vs Sidechains debate and SVM expansion',
    'Twitter Pulse: Discussions on "The Real SOL" and upcoming breakpoint conference features',
    'Twitter Pulse: Growing community adoption of Blinks for NFT mints on X (formerly Twitter)',
  ];


  // Pick 5 random evergreen facts to keep base knowledge fresh
  const randomEvergreen = evergreen
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);
  
  newsItems.push(...randomEvergreen);

  // Final shuffle of all news items to prevent AI pattern bias
  return newsItems.sort(() => Math.random() - 0.5);
}

// ─── Fallback questions (offline / API failure) ──────────

export function generateFallbackQuestions(role: UserRole, count: number): Question[] {
  const now = Date.now();
  const pool = FALLBACK_POOL.filter(
    (q) => q.role === role || q.role === 'General'
  );

  // Shuffle and pick
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((q, i) => ({
    id: `fallback_${now}_${i}`,
    question: q.question,
    options: q.options as [string, string, string, string],
    correctIndex: q.correctIndex,
    role,
    difficulty: q.difficulty,
    sourceDate: now,
    sourceSummary: 'Curated Solana knowledge',
    createdAt: now,
    expiresAt: now + 7 * 86400000,
  }));
}

interface FallbackQ {
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: number;
  role: string;
}

const FALLBACK_POOL: FallbackQ[] = [
  // Trader
  { question: 'Which DEX aggregator is largest on Solana?', options: ['Jupiter', 'Orca', 'Raydium', '1inch'], correctIndex: 0, difficulty: 1, role: 'Trader' },
  { question: 'What is Solana\'s native token ticker?', options: ['SOL', 'SLN', 'SOLA', 'SNA'], correctIndex: 0, difficulty: 1, role: 'Trader' },
  { question: 'Which AMM uses concentrated liquidity on Solana?', options: ['Raydium', 'Orca', 'Serum', 'Saber'], correctIndex: 1, difficulty: 2, role: 'Trader' },
  { question: 'What is the Solana token standard called?', options: ['ERC-20', 'SPL', 'BEP-20', 'TRC-20'], correctIndex: 1, difficulty: 1, role: 'Trader' },
  { question: 'Which protocol provides price feeds on Solana?', options: ['Chainlink', 'Pyth', 'Band', 'API3'], correctIndex: 1, difficulty: 2, role: 'Trader' },
  { question: 'What is SOL staking APY approximately?', options: ['1-2%', '3-4%', '7-8%', '15-20%'], correctIndex: 2, difficulty: 2, role: 'Trader' },
  { question: 'Which NFT marketplace leads on Solana?', options: ['OpenSea', 'Tensor', 'Blur', 'Rarible'], correctIndex: 1, difficulty: 1, role: 'Trader' },
  { question: 'What does TVL stand for in DeFi?', options: ['Total Value Locked', 'Token Value Listed', 'Trade Volume Log', 'Total Vault Limit'], correctIndex: 0, difficulty: 1, role: 'Trader' },

  // Developer
  { question: 'What consensus mechanism does Solana use?', options: ['Proof of Work', 'Proof of History', 'Delegated PoS', 'Proof of Authority'], correctIndex: 1, difficulty: 1, role: 'Developer' },
  { question: 'What runtime does Solana use for smart contracts?', options: ['EVM', 'Sealevel', 'WASM', 'Move'], correctIndex: 1, difficulty: 2, role: 'Developer' },
  { question: 'What is Solana\'s smart contract framework called?', options: ['Hardhat', 'Anchor', 'Truffle', 'Foundry'], correctIndex: 1, difficulty: 1, role: 'Developer' },
  { question: 'What language are Solana programs written in?', options: ['Solidity', 'Rust', 'Go', 'Python'], correctIndex: 1, difficulty: 1, role: 'Developer' },
  { question: 'What bridges Solana to other chains?', options: ['Polygon Bridge', 'Wormhole', 'Hop Protocol', 'Synapse'], correctIndex: 1, difficulty: 2, role: 'Developer' },
  { question: 'What does MWA stand for on Solana Mobile?', options: ['Mobile Web App', 'Mobile Wallet Adapter', 'Multi Wallet Auth', 'Mobile Web Auth'], correctIndex: 1, difficulty: 2, role: 'Developer' },
  { question: 'Which provider offers Solana RPC and DAS API?', options: ['Alchemy', 'Helius', 'Moralis', 'Ankr'], correctIndex: 1, difficulty: 2, role: 'Developer' },
  { question: 'What network migrated entirely to Solana?', options: ['Polygon', 'Helium', 'Avalanche', 'Near'], correctIndex: 1, difficulty: 3, role: 'Developer' },

  // DeFi User
  { question: 'What is liquid staking on Solana?', options: ['Staking with no lockup', 'Staking with mSOL token', 'Flash staking', 'Lending SOL'], correctIndex: 1, difficulty: 2, role: 'DeFi User' },
  { question: 'Which is Solana\'s leading liquid staking protocol?', options: ['Lido', 'Marinade', 'Rocket Pool', 'Ankr'], correctIndex: 1, difficulty: 2, role: 'DeFi User' },
  { question: 'What is an AMM in DeFi?', options: ['Auto Market Maker', 'Automated Market Maker', 'Asset Management Module', 'Auto Money Maker'], correctIndex: 1, difficulty: 1, role: 'DeFi User' },
  { question: 'What does MEV stand for?', options: ['Max Extractable Value', 'Miner Exact Value', 'Market Exchange Value', 'Minimum Expected Value'], correctIndex: 0, difficulty: 3, role: 'DeFi User' },
  { question: 'Which Solana protocol focuses on MEV?', options: ['Marinade', 'Jito', 'Jupiter', 'Raydium'], correctIndex: 1, difficulty: 3, role: 'DeFi User' },

  // NFT Collector
  { question: 'What does compressed NFT do on Solana?', options: ['Smaller images', 'Reduce mint cost 99.9%', 'Compress metadata', 'Speed up transfers'], correctIndex: 1, difficulty: 2, role: 'NFT Collector' },
  { question: 'Which provides NFT standards on Solana?', options: ['OpenZeppelin', 'Metaplex', 'Zora', 'Manifold'], correctIndex: 1, difficulty: 2, role: 'NFT Collector' },
  { question: 'Where can you trade Solana NFTs?', options: ['OpenSea only', 'Tensor', 'Blur', 'Rarible'], correctIndex: 1, difficulty: 1, role: 'NFT Collector' },

  // Beginner
  { question: 'Which wallet is most popular on Solana?', options: ['MetaMask', 'Phantom', 'Trust Wallet', 'Coinbase'], correctIndex: 1, difficulty: 1, role: 'Beginner' },
  { question: 'How many dApps are on the Solana dApp Store?', options: ['25+', '100+', '225+', '500+'], correctIndex: 2, difficulty: 2, role: 'Beginner' },
  { question: 'What is Solana\'s approximate TPS?', options: ['400', '4,000', '40,000', '400,000'], correctIndex: 1, difficulty: 1, role: 'Beginner' },
  { question: 'What is a Seed Vault on Seeker?', options: ['Token storage', 'Hardware key security', 'NFT gallery', 'DeFi vault'], correctIndex: 1, difficulty: 2, role: 'Beginner' },
  { question: 'What does dApp stand for?', options: ['Digital Application', 'Decentralized Application', 'Data Application', 'Distributed App'], correctIndex: 1, difficulty: 1, role: 'Beginner' },

  // General (matches any role)
  { question: 'What year was Solana launched?', options: ['2017', '2018', '2020', '2021'], correctIndex: 2, difficulty: 2, role: 'General' },
  { question: 'Who is the co-founder of Solana?', options: ['Vitalik Buterin', 'Anatoly Yakovenko', 'Charles Hoskinson', 'Gavin Wood'], correctIndex: 1, difficulty: 2, role: 'General' },
  { question: 'What is Solana\'s block time approximately?', options: ['12 seconds', '400ms', '2 seconds', '6 seconds'], correctIndex: 1, difficulty: 2, role: 'General' },
];

// ─── Generate for all roles ──────────────────────────────

export async function generateAllRoleQuestions(): Promise<Question[]> {
  const news = await fetchLatestNews();
  const roles: UserRole[] = ['Trader', 'Developer', 'NFT Collector', 'DeFi User', 'Beginner'];
  const all: Question[] = [];

  for (const role of roles) {
    try {
      const qs = await generateQuestionsFromNews(news, role, 10);
      all.push(...qs);
    } catch (e) {
      console.error(`[Groq] Failed for ${role}:`, e);
    }
  }

  return all;
}
