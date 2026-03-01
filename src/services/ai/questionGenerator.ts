import { GROQ_API_KEY } from '../../config/constants';
import { Question, UserRole } from '../../types';
import { v4 as uuidv4 } from 'react-native-uuid';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GeneratedQuestion {
  question: string;
  options: string[];
  correct: string;
  role: string;
  difficulty: number;
}

export async function generateQuestionsFromNews(
  newsItems: string[],
  role: UserRole,
  count: number = 50
): Promise<Question[]> {
  const newsText = newsItems.join('\n\n');
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a quiz question generator for a Solana/Web3 quiz battle app called SeekerRank. Generate multiple-choice questions that:
- Are 8-15 words maximum
- Have exactly 4 answer options (A, B, C, D)
- Are answerable within 5-10 seconds
- Have no ambiguity — only one clearly correct answer
- Are based on recent Web3/Solana/crypto news
- Are tagged with difficulty 1-5
- Require NO deep reasoning, just knowledge recall
- Have NO trick questions

Return ONLY valid JSON array. No explanation.`,
        },
        {
          role: 'user',
          content: `Generate ${count} quiz questions for the "${role}" category based on this recent Web3/Solana news:

${newsText}

Return JSON format:
[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct": "A",
    "role": "${role}",
    "difficulty": 2
  }
]`,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content from Groq API');
  }

  let parsed: { questions?: GeneratedQuestion[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse Groq response as JSON');
  }

  const rawQuestions = parsed.questions || (Array.isArray(parsed) ? parsed : []);

  return rawQuestions.map((q: GeneratedQuestion) => {
    const correctIndex = ['A', 'B', 'C', 'D'].indexOf(q.correct.toUpperCase());
    return {
      id: generateId(),
      question: q.question,
      options: q.options as [string, string, string, string],
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      role: role,
      difficulty: q.difficulty || 2,
      sourceDate: now,
      sourceSummary: 'Generated from latest Solana news',
      createdAt: now,
      expiresAt: now + sevenDays,
    };
  });
}

// Fetch news from various RSS/API sources
export async function fetchLatestNews(): Promise<string[]> {
  const sources = [
    'https://solana.com/news/rss',
    'https://api.coingecko.com/api/v3/search/trending',
  ];

  const newsItems: string[] = [];

  // CoinGecko trending
  try {
    const cgResponse = await fetch(
      'https://api.coingecko.com/api/v3/search/trending'
    );
    if (cgResponse.ok) {
      const cgData = await cgResponse.json();
      const trendingCoins = cgData.coins?.slice(0, 5) || [];
      trendingCoins.forEach((coin: any) => {
        newsItems.push(
          `Trending coin: ${coin.item.name} (${coin.item.symbol}) is trending on CoinGecko with market cap rank ${coin.item.market_cap_rank}`
        );
      });
    }
  } catch (e) {
    console.log('CoinGecko fetch failed, skipping');
  }

  // DeFiLlama Solana TVL
  try {
    const dlResponse = await fetch(
      'https://api.llama.fi/v2/chains'
    );
    if (dlResponse.ok) {
      const chains = await dlResponse.json();
      const solana = chains.find((c: any) => c.name === 'Solana');
      if (solana) {
        newsItems.push(
          `Solana current TVL is $${(solana.tvl / 1e9).toFixed(2)} billion`
        );
      }
    }
  } catch (e) {
    console.log('DeFiLlama fetch failed, skipping');
  }

  // Add some evergreen Solana facts as fallback
  const evergreen = [
    'Jupiter DEX is the largest DEX aggregator on Solana, processing billions in volume',
    'Solana Mobile Seeker is the second-generation crypto phone with Seed Vault hardware security',
    'SKR token is the coordination layer for the Solana Mobile economy, used for governance and staking',
    'Mobile Wallet Adapter (MWA) v2.0 enables seamless wallet connections on Android devices',
    'The Solana dApp Store has over 225 published applications with zero platform fees',
    'Solana processes over 4000 transactions per second with sub-second finality',
    'Marinade Finance is a leading liquid staking protocol on Solana',
    'Helius provides RPC infrastructure and developer tools for Solana builders',
    'Tensor is the leading NFT marketplace on Solana by volume',
    'Raydium is an automated market maker (AMM) on Solana',
    'Orca provides concentrated liquidity pools on Solana',
    'The Solana Seeker phone includes Genesis Token for early adopter benefits',
    'Solana staking yields approximately 7-8% annual returns',
    'Compressed NFTs on Solana reduce minting costs by 99.9%',
    'Phantom wallet is the most popular Solana wallet with over 10 million users',
  ];

  newsItems.push(...evergreen);

  return newsItems;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Generate questions for all roles
export async function generateAllRoleQuestions(): Promise<Question[]> {
  const news = await fetchLatestNews();
  const roles: UserRole[] = ['Trader', 'Developer', 'NFT Collector', 'DeFi User', 'Beginner'];
  const allQuestions: Question[] = [];

  for (const role of roles) {
    try {
      const questions = await generateQuestionsFromNews(news, role, 10);
      allQuestions.push(...questions);
    } catch (e) {
      console.error(`Failed to generate questions for ${role}:`, e);
    }
  }

  return allQuestions;
}
