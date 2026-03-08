import { supabase } from '../../config/supabase';
import { Player, DailyQuest } from '../../types';
import { calculateLevel } from '../matchmaking/ratingSystem';

// ─── Helper: map DB row to Player object ─────────────────────
function mapPlayer(p: any): Player {
  return {
    id: String(p.id),
    walletAddress: p.wallet_address,
    seekerId: p.seeker_id || '',
    username: p.username,
    rating: p.rating || 1200,
    xp: Number(p.xp) || 0,
    level: calculateLevel(Number(p.xp) || 0),
    matchesPlayed: p.matches_played || 0,
    matchesWon: p.wins || 0,
    currentStreak: p.current_streak || 0,
    bestStreak: p.best_streak || 0,
    avgReactionTime: 0,
    badges: [],
    isSkrStaker: p.is_skr_staker || false,
    skrBalance: Number(p.skr_balance) || 0,
    password: p.password,
    twitter: p.twitter,
    createdAt: Number(p.created_at) || Date.now(),
    lastActiveAt: Number(p.last_active_at) || Date.now(),
  };
}

// ─── Player Functions ─────────────────────────────────────────
export async function getPlayer(walletAddress: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('wallet_address', walletAddress)
    .limit(1)
    .single();

  if (error || !data) return null;
  return mapPlayer(data);
}

export async function getPlayerById(playerId: string): Promise<Player | null> {
  const idValue = Number(playerId);
  if (isNaN(idValue) || idValue === 0) return null;

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', idValue)
    .limit(1)
    .single();

  if (error || !data) return null;
  return mapPlayer(data);
}

export async function checkUsernameUnique(username: string): Promise<boolean> {
  const { data } = await supabase
    .from('players')
    .select('id')
    .ilike('username', username)
    .limit(1);

  return !data || data.length === 0;
}

export async function loginPlayer(username: string, password: string, currentWallet: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .ilike('username', username)
    .eq('password', password)
    .limit(1)
    .single();

  if (error || !data) return null;

  // Update wallet address to currently connected one
  await supabase
    .from('players')
    .update({ wallet_address: currentWallet })
    .eq('id', data.id);

  return getPlayer(currentWallet);
}

export async function updatePassword(walletAddress: string, newPassword: string): Promise<void> {
  await supabase
    .from('players')
    .update({ password: newPassword })
    .eq('wallet_address', walletAddress);
}

export async function createPlayer(
  walletAddress: string,
  seekerId: string,
  username: string,
  password?: string,
  twitter?: string
): Promise<Player> {
  const now = Date.now();

  const { data, error } = await supabase
    .from('players')
    .insert({
      wallet_address: walletAddress,
      seeker_id: seekerId,
      username,
      password: password || null,
      twitter: twitter || null,
      rating: 1200,
      matches_played: 0,
      wins: 0,
      losses: 0,
      xp: 0,
      is_skr_staker: false,
      skr_balance: 0,
      created_at: now,
      last_active_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapPlayer(data);
}

export async function updatePlayer(walletAddress: string, updates: Partial<Player>): Promise<void> {
  if (Object.keys(updates).length === 0) return;

  // Map camelCase Player keys to snake_case DB columns
  const columnMap: Record<string, string> = {
    username: 'username',
    rating: 'rating',
    xp: 'xp',
    matchesPlayed: 'matches_played',
    matchesWon: 'wins',
    currentStreak: 'current_streak',
    bestStreak: 'best_streak',
    isSkrStaker: 'is_skr_staker',
    skrBalance: 'skr_balance',
    lastActiveAt: 'last_active_at',
    twitter: 'twitter',
    password: 'password',
  };

  const dbUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    const col = columnMap[key];
    if (col) dbUpdates[col] = value;
  }

  if (Object.keys(dbUpdates).length === 0) return;

  await supabase
    .from('players')
    .update(dbUpdates)
    .eq('wallet_address', walletAddress);
}

// ─── Daily Quests ──────────────────────────────────────────────
export async function getDailyQuests(walletAddress: string): Promise<DailyQuest[]> {
  const { data, error } = await supabase
    .from('daily_quests')
    .select('*')
    .eq('wallet_address', walletAddress);

  if (error || !data) return [];

  return data.map((q: any) => ({
    id: String(q.id),
    type: q.type || 'play_matches',
    title: q.title,
    description: q.description,
    target: q.target || 10,
    progress: q.progress || 0,
    xpReward: q.xp_reward || 50,
    isCompleted: q.completed || false,
    icon: q.icon || 'star',
  }));
}

// ─── Leaderboard ────────────────────────────────────────────────
export async function getLeaderboard(): Promise<any[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, username, twitter, rating, wins, matches_played, is_skr_staker')
    .order('rating', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map((p: any, index: number) => ({
    rank: index + 1,
    playerId: String(p.id),
    username: p.username,
    twitter: p.twitter || null,
    rating: p.rating || 1200,
    winRate: p.matches_played > 0 ? Math.round((Number(p.wins) / Number(p.matches_played)) * 100) : 0,
    matchesPlayed: p.matches_played || 0,
    avgReactionTime: 1800,
    isSkrStaker: p.is_skr_staker || false,
    isCurrentUser: false,
  }));
}

// ─── Match Persistence (called only by playerA — the authority) ─
export async function persistMatchResult(data: any): Promise<void> {
  const {
    match,
    currentPlayerId,
    opponentPlayerId,
    ratingResult,
    xpEarned,
    opponentXpEarned,
    isWin,
    isDraw,
    wagerType,
  } = data;

  const now = Date.now();

  // 1. Update current player (playerA)
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', Number(currentPlayerId))
    .single();

  if (player) {
    await supabase
      .from('players')
      .update({
        rating: isWin ? ratingResult.winnerNewRating : (isDraw ? ratingResult.winnerNewRating : ratingResult.loserNewRating),
        matches_played: (player.matches_played || 0) + 1,
        wins: (player.wins || 0) + (isWin ? 1 : 0),
        xp: Number(player.xp || 0) + Number(xpEarned),
        last_active_at: now,
      })
      .eq('id', Number(currentPlayerId));
  }

  // 2. Update opponent (playerB)
  const { data: opponent } = await supabase
    .from('players')
    .select('*')
    .eq('id', Number(opponentPlayerId))
    .single();

  if (opponent) {
    const oppWon = !isDraw && !isWin;
    await supabase
      .from('players')
      .update({
        rating: oppWon ? ratingResult.winnerNewRating : (isDraw ? ratingResult.loserNewRating : ratingResult.loserNewRating),
        matches_played: (opponent.matches_played || 0) + 1,
        wins: (opponent.wins || 0) + (oppWon ? 1 : 0),
        xp: Number(opponent.xp || 0) + Number(opponentXpEarned),
        last_active_at: now,
      })
      .eq('id', Number(opponentPlayerId));
  }

  // 3. Record the match
  try {
    await supabase
      .from('matches')
      .upsert({
        id: match.id,
        player_a: match.playerA,
        player_b: match.playerB,
        winner_id: match.winnerId || null,
        wager_lamports: match.wagerLamports || 0,
        wager_type: wagerType || 'sol',
        created_at: match.createdAt,
        ended_at: now,
      });
  } catch (e) {
    console.warn('[DB] Match record insertion failed:', e);
  }
}

// ─── Match History ───────────────────────────────────────────
export async function getMatchHistory(playerId: string): Promise<any[]> {
  try {
    // Supabase doesn't support JSONB field queries easily in the client,
    // so we fetch recent matches and filter client-side
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('ended_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    // Filter to matches involving this player
    const pid = String(playerId);
    const filtered = data.filter((m: any) => {
      const aId = typeof m.player_a === 'string' ? JSON.parse(m.player_a)?.id : m.player_a?.id;
      const bId = typeof m.player_b === 'string' ? JSON.parse(m.player_b)?.id : m.player_b?.id;
      return String(aId) === pid || String(bId) === pid;
    });

    return filtered.slice(0, 20).map((m: any) => {
      const playerA = typeof m.player_a === 'string' ? JSON.parse(m.player_a) : m.player_a;
      const playerB = typeof m.player_b === 'string' ? JSON.parse(m.player_b) : m.player_b;
      return {
        ...m,
        playerA,
        playerB,
        winnerId: m.winner_id,
        wagerLamports: Number(m.wager_lamports || 0),
        wagerType: m.wager_type || 'sol',
        endedAt: Number(m.ended_at),
      };
    });
  } catch (e) {
    console.warn('[DB] Match history fetch failed:', e);
    return [];
  }
}
