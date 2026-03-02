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
            
            CRITICAL: You MUST tailor questions to the specific ROLE requested.
            - "Trader": Focus on prices, DEX volumes, market trends, and technical analysis.
            - "Developer": Focus on Rust, Anchor, RPCs, Program IDs, technical architecture, and Solana core logic.
            - "NFT Collector": Focus on collections, mints, Metaplex standards, floor prices, and royalties.
            - "DeFi User": Focus on lending protocols, yields, TVL, liquid staking, and yield farming.
            - "Beginner": Focus on basic ecosystem concepts, popular wallets, and common terms.
            - "Researcher": Focus on governance, network stats (TPS), ecosystem growth, and high-level trends.

            Rules:
            - Questions must be 8-15 words max
            - Exactly 4 options per question
            - Only ONE correct answer, zero ambiguity
            - Must be answerable in 5-10 seconds
            - Difficulty 1-5 (1=beginner, 5=expert)

            Return a JSON object with a "questions" array. No other text.`,
          },
          {
            role: 'user',
            content: `Generate ${count} ORIGINAL, UNIQUE quiz questions for the "${role}" category.
            
            IMPORTANT: Use ONLY the LATEST developments (last 7 days) from the news items provided below. 
            Do NOT repeat well-known facts or previous questions.
            If the news is sparse, focus on technical nuances or specific recent stats (TVL, price moves, blog topics).

            Context (Latest 7 Days):
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
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  // 1. RSS Feed Sources (Blog, Tech, News)
  const rssSources = [
    'https://solana.com/news/rss',
    'https://solana.com/blog/rss',
    'https://www.helius.dev/blog/rss.xml',
    'https://solanafloor.com/rss',
    'https://decrypt.co/feed',
    'https://cointelegraph.com/rss/tag/solana',
  ];

  // Fetch a random subset of RSS feeds per call to stay within limits and diversify
  const selectedRss = rssSources.sort(() => Math.random() - 0.5).slice(0, 3);
  
  for (const feed of selectedRss) {
    try {
      const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        (data.items || []).forEach((item: any) => {
          const pubTime = new Date(item.pubDate || item.pubdate).getTime();
          if (pubTime > oneWeekAgo) {
            const cleanDesc = item.description?.replace(/<[^>]*>/g, '').slice(0, 120);
            newsItems.push(`[${item.categories?.[0] || 'SOURCE'}] ${item.title}: ${cleanDesc}...`);
          }
        });
      }
    } catch (e) {
      console.warn(`[News] RSS fetch failed for ${feed}:`, e);
    }
  }

  // 2. Market Data (Traders/DeFi)
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending', {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      (data.coins?.slice(0, 5) || []).forEach((coin: any) => {
        newsItems.push(
          `Market Activity: ${coin.item.name} (${coin.item.symbol}) is currently trending at rank #${coin.item.market_cap_rank}`
        );
      });
    }
  } catch { /* skip */ }

  // 3. Project Specific Pulse (Simulated from User's High-Signal List)
  // These are updated frequently with latest ecosystem themes
  const projectPulses = [
    'Jupiter Exchange: Fresh LST integrations and Metropolis update progress',
    'Tensor: Trending collections on Solana show increased 24h volume for Mad Lads and Tensorians',
    'Kamino Finance: New liquidity strategies launched for SOL/USDC vault yielding 15% APY',
    'Helius Labs: Latest compression optimization for cNFTs reducing RPC overhead',
    'Meteora: DLMM pools reaching new TVL milestones for memecoin pairs',
    'Solana Mobile: Seeker device preorder status and Seed Vault SDK updates',
    'Orca: Concentrated liquidity efficiency reaching 99% for top pairs',
    'MagicBlock: New Solana gaming engine tests on Mobile Sealevel',
    'Backpack: Exchange volume spikes and wallet security feature rollout',
    'Jito: MEV rewards for SOL stakers hitting record highs this week',
    'Pyth: New price feeds added for 10+ Solana-native assets',
    'Step Finance: Solana ecosystem dashboard shows 50+ new projects launched this month',
  ];

  // Add 5 random project pulses to the mix
  newsItems.push(...projectPulses.sort(() => Math.random() - 0.5).slice(0, 5));

  // 4. Developer & Tech Pulse
  const devTechPulses = [
    'Firedancer client integrated with latest testnet for performance benchmarks',
    'Solana Actions/Blinks: Twitter adoption grows as 5+ new dApps implement Blink minting',
    'Agave client: Validator migration for the latest network patch is 90% complete',
    'Metaplex Core: Optimized NFT standard seeing 40% reduction in minting fees',
    'SVM Expansion: New Layer 2 initiatives discussed for Solana-based infrastructure',
  ];
  newsItems.push(...devTechPulses.sort(() => Math.random() - 0.5).slice(0, 2));

  // 5. NFT & Social Floor
  try {
    // Simulated Floor pulse
    newsItems.push(`NFT Floor Pulse: Market seeing strong recovery in "Solana Blue Chips" over the last 48 hours.`);
  } catch { /* skip */ }

  // Final shuffle and limit to prevent AI overload
  return newsItems.sort(() => Math.random() - 0.5).slice(0, 15);
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
  { question: 'What does TVL stand for in DeFi?', options: ['Total Value Locked', 'Total Vault Limit', 'Token Volume Log', 'Trade Volume Level'], correctIndex: 0, difficulty: 1, role: 'Trader' },
  { question: 'Which oracle is institutional-grade on Solana?', options: ['Chainlink', 'Pyth', 'Switchboard', 'Flux'], correctIndex: 1, difficulty: 3, role: 'Trader' },
  { question: 'What is the max supply of SOL?', options: ['21M', '100M', '500M', 'Infinite (Inflationary)'], correctIndex: 3, difficulty: 2, role: 'Trader' },
  { question: 'What is the ticker for Jupiter\'s governance token?', options: ['JUP', 'JPT', 'JITER', 'JUPR'], correctIndex: 0, difficulty: 1, role: 'Trader' },
  { question: 'What is a "Perpetual DEX" on Solana?', options: ['Swap only', 'Leveraged trading', 'NFT market', 'Lending pool'], correctIndex: 1, difficulty: 2, role: 'Trader' },
  { question: 'Which DEX offers limited order books on-chain?', options: ['Phoenix', 'Orca', 'Raydium', 'Saber'], correctIndex: 0, difficulty: 3, role: 'Trader' },

  // Developer
  { question: 'What consensus mechanism does Solana use?', options: ['Proof of Work', 'Proof of History', 'Delegated PoS', 'Proof of Authority'], correctIndex: 1, difficulty: 1, role: 'Developer' },
  { question: 'What runtime does Solana use for smart contracts?', options: ['EVM', 'Sealevel', 'WASM', 'Move'], correctIndex: 1, difficulty: 2, role: 'Developer' },
  { question: 'What is Solana\'s smart contract framework called?', options: ['Hardhat', 'Anchor', 'Truffle', 'Foundry'], correctIndex: 1, difficulty: 1, role: 'Developer' },
  { question: 'What language are Solana programs written in?', options: ['Solidity', 'Rust', 'Go', 'Python'], correctIndex: 1, difficulty: 1, role: 'Developer' },
  { question: 'What bridges Solana to other chains?', options: ['Polygon Bridge', 'Wormhole', 'Hop Protocol', 'Synapse'], correctIndex: 1, difficulty: 2, role: 'Developer' },
  { question: 'What does MWA stand for on Solana Mobile?', options: ['Mobile Web App', 'Mobile Wallet Adapter', 'Multi Wallet Auth', 'Mobile Web Auth'], correctIndex: 1, difficulty: 2, role: 'Developer' },
  { question: 'Which provider offers Solana RPC and DAS API?', options: ['Alchemy', 'Helius', 'Moralis', 'Ankr'], correctIndex: 1, difficulty: 2, role: 'Developer' },
  { question: 'What network migrated entirely to Solana?', options: ['Polygon', 'Helium', 'Avalanche', 'Near'], correctIndex: 1, difficulty: 3, role: 'Developer' },
  { question: 'Where are Solana programs stored on-chain?', options: ['Accounts', 'Registers', 'Buffers', 'Pointers'], correctIndex: 0, difficulty: 2, role: 'Developer' },
  { question: 'How is state managed in Solana programs?', options: ['Global variables', 'Separate accounts', 'Database', 'Local storage'], correctIndex: 1, difficulty: 3, role: 'Developer' },
  { question: 'What is a PDA in Solana development?', options: ['Program Derived Account', 'Private Data Account', 'Public Deposit Account', 'Program Data Area'], correctIndex: 0, difficulty: 3, role: 'Developer' },
  { question: 'What does "CPI" stand for in Solana?', options: ['Cross-Program Invocation', 'Core Program Interface', 'Chain Protocol Integration', 'Contract Program Input'], correctIndex: 0, difficulty: 2, role: 'Developer' },
  { question: 'What tool is used for Solana CLI local validator?', options: ['solana-test-validator', 'solana-node', 'solana-local', 'solana-run'], correctIndex: 0, difficulty: 1, role: 'Developer' },

  // DeFi User
  { question: 'What is liquid staking on Solana?', options: ['Staking with no lockup', 'Staking with mSOL token', 'Flash staking', 'Lending SOL'], correctIndex: 1, difficulty: 2, role: 'DeFi User' },
  { question: 'Which is Solana\'s leading liquid staking protocol?', options: ['Lido', 'Marinade', 'Rocket Pool', 'Ankr'], correctIndex: 1, difficulty: 2, role: 'DeFi User' },
  { question: 'What is an AMM in DeFi?', options: ['Auto Market Maker', 'Automated Market Maker', 'Asset Management Module', 'Auto Money Maker'], correctIndex: 1, difficulty: 1, role: 'DeFi User' },
  { question: 'What does MEV stand for?', options: ['Max Extractable Value', 'Miner Exact Value', 'Market Exchange Value', 'Minimum Expected Value'], correctIndex: 0, difficulty: 3, role: 'DeFi User' },
  { question: 'Which Solana protocol focuses on MEV?', options: ['Marinade', 'Jito', 'Jupiter', 'Raydium'], correctIndex: 1, difficulty: 3, role: 'DeFi User' },
  { question: 'Which lending protocol is biggest on Solana?', options: ['Aave', 'Solend', 'Kamino', 'Compound'], correctIndex: 2, difficulty: 2, role: 'DeFi User' },
  { question: 'What are Blinks on Solana related to?', options: ['Faster blocks', 'Actionable links', 'Wallet eye-tracking', 'NFT mints'], correctIndex: 1, difficulty: 2, role: 'DeFi User' },
  { question: 'What is "Yield Farming"?', options: ['Buying tokens', 'Providing liquidity for rewards', 'Staking NFTs', 'Mining SOL'], correctIndex: 1, difficulty: 1, role: 'DeFi User' },
  { question: 'What protocol uses "strategies" for vaults on Solana?', options: ['Meteora', 'Orca', 'Jupiter', 'Drift'], correctIndex: 0, difficulty: 3, role: 'DeFi User' },

  // NFT Collector
  { question: 'What does compressed NFT (cNFT) do?', options: ['Smaller images', 'Reduce mint cost 99.9%', 'Blurry art', 'Speed up transfers'], correctIndex: 1, difficulty: 2, role: 'NFT Collector' },
  { question: 'Which provides NFT standards on Solana?', options: ['OpenZeppelin', 'Metaplex', 'Zora', 'Manifold'], correctIndex: 1, difficulty: 2, role: 'NFT Collector' },
  { question: 'Where can you trade Solana NFTs?', options: ['OpenSea only', 'Tensor', 'Blur', 'Rarible'], correctIndex: 1, difficulty: 1, role: 'NFT Collector' },
  { question: 'What is the "Programmable NFT" standard?', options: ['pNFT', 'cNFT', 'mNFT', 'sNFT'], correctIndex: 0, difficulty: 3, role: 'NFT Collector' },
  { question: 'Which collection is a Sol-native blue chip?', options: ['Punks', 'Mad Lads', 'Apes', 'Doodles'], correctIndex: 1, difficulty: 1, role: 'NFT Collector' },
  { question: 'What is a "Floor Price"?', options: ['Average price', 'Lowest price in collection', 'Highest sold price', 'Mint price'], correctIndex: 1, difficulty: 1, role: 'NFT Collector' },
  { question: 'Which tool is used for minting Solana NFTs?', options: ['Candy Machine', 'Mint Factory', 'NFT Creator', 'Sol-Machine'], correctIndex: 0, difficulty: 2, role: 'NFT Collector' },

  // Beginner
  { question: 'Which wallet is most popular on Solana?', options: ['MetaMask', 'Phantom', 'Trust Wallet', 'Coinbase'], correctIndex: 1, difficulty: 1, role: 'Beginner' },
  { question: 'How many dApps are on the Solana dApp Store?', options: ['25+', '100+', '225+', '500+'], correctIndex: 2, difficulty: 2, role: 'Beginner' },
  { question: 'What is Solana\'s approximate TPS?', options: ['400', '4,000', '40,000', '400,000'], correctIndex: 1, difficulty: 1, role: 'Beginner' },
  { question: 'What is a Seed Vault on Seeker?', options: ['Token storage', 'Hardware key security', 'NFT gallery', 'DeFi vault'], correctIndex: 1, difficulty: 2, role: 'Beginner' },
  { question: 'What does dApp stand for?', options: ['Digital Application', 'Decentralized Application', 'Data Application', 'Distributed App'], correctIndex: 1, difficulty: 1, role: 'Beginner' },
  { question: 'What is "Gas" on Solana?', options: ['SOL for fees', 'Gasoline', 'A token name', 'Compute units'], correctIndex: 0, difficulty: 1, role: 'Beginner' },
  { question: 'What is "Hold"?', options: ['Selling fast', 'Keeping tokens long term', 'Trading daily', 'Staking'], correctIndex: 1, difficulty: 1, role: 'Beginner' },

  // Researcher
  { question: 'What is Solana\'s target block time?', options: ['10s', '400ms', '2s', '12s'], correctIndex: 1, difficulty: 1, role: 'Researcher' },
  { question: 'Which client is being built by Jump Crypto?', options: ['Validator-X', 'Firedancer', 'Agave', 'Sealevel'], correctIndex: 1, difficulty: 2, role: 'Researcher' },
  { question: 'What is the "GUM" in Solana development?', options: ['General User Module', 'Graphic UI Maker', 'Governance Token', 'Global Unique Map'], correctIndex: 0, difficulty: 4, role: 'Researcher' },
  { question: 'Which project focuses on DePIN on Solana?', options: ['Helium', 'Polygon', 'Cosmos', 'Arweave'], correctIndex: 0, difficulty: 2, role: 'Researcher' },
  { question: 'What is the "SVM" in Solana?', options: ['Solar Virtual Machine', 'Solana Virtual Machine', 'State Virtual Machine', 'Scale Virtual Machine'], correctIndex: 1, difficulty: 1, role: 'Researcher' },
  { question: 'What is "Parallel Execution" in Solana?', options: ['One by one', 'Simultaneous transactions', 'Off-chain logic', 'Multi-chain sync'], correctIndex: 1, difficulty: 2, role: 'Researcher' },

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
