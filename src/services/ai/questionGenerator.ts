import {
  GROQ_API_KEY,
  TAVILY_API_KEY,
  CRYPTOPANIC_API_KEY,
  COINGECKO_API_KEY,
  BIRDEYE_API_KEY,
} from '../../config/constants';
import { Question } from '../../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const FETCH_TIMEOUT = 6000;
const NEWS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Hermes/RN doesn't support AbortSignal.timeout — use AbortController instead
function fetchT(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── News Cache ──────────────────────────────────────────

let cachedNews: string[] = [];
let cacheTimestamp = 0;
let isFetching = false;

async function getCachedNews(): Promise<string[]> {
  const now = Date.now();
  const isExpired = now - cacheTimestamp > NEWS_CACHE_TTL;

  if (cachedNews.length > 0 && !isExpired) {
    console.log(`[News Cache] Using cached data (${cachedNews.length} items, ${Math.round((now - cacheTimestamp) / 60000)}min old)`);
    return cachedNews;
  }

  if (isFetching && cachedNews.length > 0) {
    console.log('[News Cache] Fetch in progress, using stale cache');
    return cachedNews;
  }

  isFetching = true;
  try {
    const freshNews = await fetchLatestNews();
    if (freshNews.length > 0) {
      cachedNews = freshNews;
      cacheTimestamp = now;
      console.log(`[News Cache] Refreshed with ${freshNews.length} items`);
    } else if (cachedNews.length > 0) {
      console.warn('[News Cache] Fetch returned empty, keeping stale cache');
    }
  } finally {
    isFetching = false;
  }

  return cachedNews;
}

// Pre-warm cache on app start
export function initNewsCache() {
  getCachedNews().catch(e => console.warn('[News Cache] Pre-warm failed:', e));
}

// ─── Question Generation ─────────────────────────────────

export async function generateQuestionsFromNews(
  newsItems: string[],
  count: number = 5
): Promise<Question[]> {
  const newsText = newsItems.slice(0, 20).join('\n');
  const now = Date.now();
  const sevenDays = 7 * 86400000;

  if (newsItems.length === 0) {
    console.warn('[Quiz] No news items fetched — cannot generate questions');
    return [];
  }

  try {
    const response = await fetchT(GROQ_API_URL, {
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
            content: `You are a quiz question generator for Squiz, a Solana/Web3 speed-based quiz battle app.

            Rules:
            - Questions must be 8-15 words max
            - Exactly 4 options per question
            - Only ONE correct answer, zero ambiguity
            - Must be answerable in 5-10 seconds
            - Difficulty 1-5 (1=beginner, 5=expert)
            - Questions MUST be based ONLY on the provided news/data context
            - Never make up facts — only use what's in the context
            - Mix question types: events, stats, protocols, people, technical

            Return a JSON object with a "questions" array. No other text.`,
          },
          {
            role: 'user',
            content: `Generate ${count} ORIGINAL quiz questions about the Solana ecosystem based STRICTLY on the real-time data below.

            RULES:
            - Every question must trace back to a specific news item or data point below
            - Include questions about: trending tokens, protocol updates, social buzz, on-chain activity, price moves, new launches
            - Do NOT use generic/static Solana trivia — only fresh, timely content
            - Vary difficulty across questions (mix of easy and hard)

            Real-Time Context:
            ${newsText}

            Return EXACTLY this JSON format:
            {
              "questions": [
                {
                  "question": "Which token saw the biggest 24h gain on Solana?",
                  "options": ["JUP", "BONK", "WIF", "PYTH"],
                  "correctIndex": 2,
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
    }, 15000); // Groq gets longer timeout

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Groq] API error ${response.status}:`, errText);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.warn('[Groq] Empty response');
      return [];
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn('[Groq] Invalid JSON');
      return [];
    }

    const rawQuestions: any[] = parsed.questions || (Array.isArray(parsed) ? parsed : []);

    if (rawQuestions.length === 0) return [];

    return rawQuestions.slice(0, count).map((q: any, i: number) => {
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
        difficulty: Math.min(Math.max(q.difficulty || 2, 1), 5),
        sourceDate: now,
        sourceSummary: 'AI-generated from live Solana ecosystem data',
        createdAt: now,
        expiresAt: now + sevenDays,
      };
    });
  } catch (err) {
    console.error('[Groq] Fetch failed:', err);
    return [];
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

// ─── News Fetching (All 9 Live Sources) ──────────────────

export async function fetchLatestNews(): Promise<string[]> {
  const sources = await Promise.allSettled([
    fetchTavily(),
    fetchCryptoPanic(),
    fetchSolanaRSS(),
    fetchCoinGecko(),
    fetchBirdeye(),
    fetchDexScreener(),
  ]);

  const newsItems: string[] = [];
  for (const result of sources) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      newsItems.push(...result.value);
    }
  }

  console.log(`[News] Fetched ${newsItems.length} items from ${sources.filter(r => r.status === 'fulfilled' && r.value.length > 0).length} sources`);

  return newsItems.sort(() => Math.random() - 0.5).slice(0, 25);
}

// ── 1. Tavily (AI Web Crawl) ────────────────────────────

async function fetchTavily(): Promise<string[]> {
  try {
    const res = await fetchT('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: 'latest Solana ecosystem news trending tokens updates today',
        topic: 'news',
        days: 3,
        max_results: 8,
        include_answer: false,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) =>
      `[Tavily] ${r.title}: ${(r.content || '').slice(0, 150)}`
    );
  } catch (e) {
    console.warn('[News] Tavily failed:', e);
    return [];
  }
}

// ── 2. CryptoPanic (News Aggregator) ────────────────────

async function fetchCryptoPanic(): Promise<string[]> {
  try {
    const res = await fetchT(
      `https://cryptopanic.com/api/developer/v2/posts/?auth_token=${CRYPTOPANIC_API_KEY}&currencies=SOL&public=true`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 8).map((post: any) => {
      const votes = post.votes || {};
      const sentiment = votes.positive > votes.negative ? 'Bullish' : votes.negative > votes.positive ? 'Bearish' : 'Neutral';
      return `[CryptoPanic|${sentiment}] ${post.title}`;
    });
  } catch (e) {
    console.warn('[News] CryptoPanic failed:', e);
    return [];
  }
}

// ── 3. Solana.com RSS ───────────────────────────────────

async function fetchSolanaRSS(): Promise<string[]> {
  const feeds = [
    'https://solana.com/news/rss.xml',
    'https://solana.com/news/rss',
  ];
  const items: string[] = [];
  const oneWeekAgo = Date.now() - 7 * 86400000;

  for (const feed of feeds) {
    try {
      const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`;
      const res = await fetchT(url);
      if (!res.ok) continue;
      const data = await res.json();
      (data.items || []).forEach((item: any) => {
        const pubTime = new Date(item.pubDate || item.pubdate).getTime();
        if (pubTime > oneWeekAgo) {
          const cleanDesc = item.description?.replace(/<[^>]*>/g, '').slice(0, 120) || '';
          items.push(`[Solana Official] ${item.title}: ${cleanDesc}`);
        }
      });
    } catch { /* skip */ }
  }
  return items.slice(0, 6);
}

// ── 4. CoinGecko (Market Data + Trending) ───────────────

async function fetchCoinGecko(): Promise<string[]> {
  const items: string[] = [];

  try {
    const res = await fetchT('https://api.coingecko.com/api/v3/search/trending', {
      headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY },
    });
    if (res.ok) {
      const data = await res.json();
      (data.coins?.slice(0, 5) || []).forEach((coin: any) => {
        const c = coin.item;
        items.push(`[CoinGecko Trending] ${c.name} (${c.symbol}) rank #${c.market_cap_rank || '?'}, 24h volume: ${c.data?.total_volume || 'N/A'}`);
      });
    }
  } catch { /* skip */ }

  try {
    const res = await fetchT(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=solana-ecosystem&order=volume_desc&per_page=5&page=1',
      { headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY } }
    );
    if (res.ok) {
      const coins = await res.json();
      (coins || []).forEach((c: any) => {
        items.push(`[CoinGecko Market] ${c.name} (${c.symbol.toUpperCase()}): $${c.current_price}, 24h change: ${c.price_change_percentage_24h?.toFixed(1)}%, vol: $${(c.total_volume / 1e6).toFixed(1)}M`);
      });
    }
  } catch { /* skip */ }

  return items;
}

// ── 5. Birdeye (Solana Token Trending) ──────────────────

async function fetchBirdeye(): Promise<string[]> {
  try {
    const res = await fetchT(
      'https://public-api.birdeye.so/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=5',
      {
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY,
          'x-chain': 'solana',
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.tokens || []).map((t: any) =>
      `[Birdeye Top Volume] ${t.name || t.symbol} (${t.symbol}): $${t.price?.toFixed(4) || '?'}, 24h vol: $${((t.v24hUSD || 0) / 1e6).toFixed(1)}M, 24h change: ${t.v24hChangePercent?.toFixed(1) || '?'}%`
    );
  } catch (e) {
    console.warn('[News] Birdeye failed:', e);
    return [];
  }
}

// ── 6. DexScreener (Trending Solana Pairs — Free) ──────

async function fetchDexScreener(): Promise<string[]> {
  try {
    const res = await fetchT('https://api.dexscreener.com/latest/dex/search?q=SOL');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.pairs || [])
      .filter((p: any) => p.chainId === 'solana')
      .slice(0, 5)
      .map((p: any) =>
        `[DexScreener] ${p.baseToken?.symbol}/${p.quoteToken?.symbol} on ${p.dexId}: $${p.priceUsd || '?'}, 24h vol: $${((p.volume?.h24 || 0) / 1e6).toFixed(1)}M, 24h change: ${p.priceChange?.h24 || '?'}%`
      );
  } catch (e) {
    console.warn('[News] DexScreener failed:', e);
    return [];
  }
}

// ─── Generate a generic question set ─────────────────────

export async function generateGenericQuestions(count: number = 5): Promise<Question[]> {
  const news = await getCachedNews();

  if (news.length === 0) {
    console.error('[Quiz] All news sources failed — no questions generated');
    return [];
  }

  return generateQuestionsFromNews(news, count);
}
