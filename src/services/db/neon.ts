import { neon } from '@neondatabase/serverless';
import { Player, DailyQuest } from '../../types';
import { UserRole, ROLES } from '../../config/constants';

// For development, ensure you define EXPO_PUBLIC_DATABASE_URL in .env
const DATABASE_URL = process.env.EXPO_PUBLIC_DATABASE_URL || 'postgresql://neondb_owner:npg_vi0wBxOmL5Vu@ep-billowing-hill-aiaqq84o-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export const sql = neon(DATABASE_URL);

/**
 * Automatically creates tables if they don't exist.
 * This ensures the app works immediately without manual SQL setup.
 */
async function ensureTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS players (
          id SERIAL PRIMARY KEY,
          walletAddress TEXT UNIQUE NOT NULL,
          seekerId TEXT,
          username TEXT NOT NULL,
          primaryRole TEXT,
          rating INTEGER DEFAULT 1200,
          matchesPlayed INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          createdAt BIGINT,
          lastActiveAt BIGINT
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS dailyquests (
          id SERIAL PRIMARY KEY,
          walletAddress TEXT REFERENCES players(walletAddress),
          type TEXT,
          title TEXT,
          description TEXT,
          target INTEGER DEFAULT 10,
          progress INTEGER DEFAULT 0,
          xpReward INTEGER DEFAULT 50,
          completed BOOLEAN DEFAULT FALSE,
          icon TEXT
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS matches (
          id TEXT PRIMARY KEY,
          playerA JSONB NOT NULL,
          playerB JSONB NOT NULL,
          winnerId TEXT,
          role TEXT,
          createdAt BIGINT,
          endedAt BIGINT
      );
    `;
  } catch (e) {
    console.error('[Neon] Table initialization failed:', e);
  }
}

// ─── Player Functions ─────────────────────────────────────────
export async function getPlayer(walletAddress: string): Promise<Player | null> {
  await ensureTables();
  const result = await sql`SELECT * FROM players WHERE walletAddress = ${walletAddress} LIMIT 1`;

  if (result.length === 0) return null;
  
  const p = result[0];
  const defaultRatings = {
      [ROLES[0]]: 1200,
      [ROLES[1]]: 1200,
      [ROLES[2]]: 1200,
  } as Record<UserRole, number>;

  return {
    id: p.id,
    walletAddress: p.walletaddress,
    seekerId: p.seekerid,
    username: p.username,
    roles: [p.primaryrole as UserRole],
    primaryRole: p.primaryrole as UserRole,
    ratings: defaultRatings,
    xp: 0,
    level: 1,
    matchesPlayed: p.matchesplayed || 0,
    matchesWon: p.wins || 0,
    currentStreak: 0,
    bestStreak: 0,
    avgReactionTime: 0,
    badges: [],
    isSkrStaker: false,
    skrBalance: 0,
    createdAt: Number(p.createdat) || Date.now(),
    lastActiveAt: Number(p.lastactiveat) || Date.now(),
  };
}

export async function createPlayer(
  walletAddress: string,
  seekerId: string,
  username: string,
  primaryRole: UserRole
): Promise<Player> {
  await ensureTables();
  const now = Date.now();
  const rating = 1200; // DEFAULT_RATING
  
  const result = await sql`
    INSERT INTO players (
      walletAddress, seekerId, username, primaryRole, rating, matchesPlayed, wins, losses, createdAt, lastActiveAt
    ) VALUES (
      ${walletAddress}, ${seekerId}, ${username}, ${primaryRole}, ${rating}, 0, 0, 0, ${now}, ${now}
    ) RETURNING *
  `;
  
  const p = result[0];
  const defaultRatings = {
      [ROLES[0]]: 1200,
      [ROLES[1]]: 1200,
      [ROLES[2]]: 1200,
  } as Record<UserRole, number>;

  return {
    id: p.id,
    walletAddress: p.walletaddress,
    seekerId: p.seekerid,
    username: p.username,
    roles: [p.primaryrole as UserRole],
    primaryRole: p.primaryrole as UserRole,
    ratings: defaultRatings,
    xp: 0,
    level: 1,
    matchesPlayed: p.matchesplayed || 0,
    matchesWon: p.wins || 0,
    currentStreak: 0,
    bestStreak: 0,
    avgReactionTime: 0,
    badges: [],
    isSkrStaker: false,
    skrBalance: 0,
    createdAt: Number(p.createdat) || Date.now(),
    lastActiveAt: Number(p.lastactiveat) || Date.now(),
  };
}

export async function updatePlayer(walletAddress: string, data: Partial<Player>): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const setClauses = [];
  const values = [];
  let index = 1;
  const dataEntries = Object.entries(data);

  // Simple ad-hoc update statement builder for neon
  // Note: in a pure implementation, you'd specify updates manually or securely
  let queryStr = 'UPDATE players SET ';
  for (const [k, v] of dataEntries) {
    let column = k.toLowerCase();
    setClauses.push(`"${column}" = $${index}`);
    values.push(v);
    index++;
  }
  queryStr += setClauses.join(', ') + ` WHERE walletAddress = $${index}`;
  values.push(walletAddress);
  
  // Need to bypass neon template string strictly for dynamic updates, using string parsing workaround:
  const query = await sql(queryStr as any, values);
}

// ─── Daily Quests ──────────────────────────────────────────────
export async function getDailyQuests(walletAddress: string): Promise<DailyQuest[]> {
  await ensureTables();
  const result = await sql`SELECT * FROM dailyquests WHERE walletAddress = ${walletAddress}`;
  return result.map((q: any) => ({
    id: q.id,
    type: q.type || 'play_matches',
    title: q.title,
    description: q.description,
    target: q.target || 10,
    progress: q.progress,
    xpReward: q.xpreward || 50,
    isCompleted: q.completed,
    icon: q.icon || 'star',
  }));
}
// ─── Leaderboard Functions ────────────────────────────────────
export async function getLeaderboard(role: UserRole): Promise<any[]> {
  await ensureTables();
  // In a real implementation, we would query the players table and sort by rating in the specific role.
  // For now, we'll sort by the main rating column for simplicity.
  const result = await sql`
    SELECT id, username, rating, wins, matchesPlayed
    FROM players 
    ORDER BY rating DESC 
    LIMIT 20
  `;
  
  return result.map((p: any, index: number) => ({
    rank: index + 1,
    playerId: p.id,
    username: p.username,
    rating: p.rating || 1200,
    winRate: p.matchesplayed > 0 ? (p.wins / p.matchesplayed) * 100 : 0,
    matchesPlayed: p.matchesplayed || 0,
    avgReactionTime: 2500, // Placeholder
    isSkrStaker: false,
    isCurrentUser: false,
  }));
}

// ─── Match Persistence ────────────────────────────────────────
export async function persistMatchResult(data: any): Promise<void> {
  const { 
    match, 
    currentPlayerId, 
    role, 
    ratingResult, 
    xpEarned, 
    isWin, 
    isDraw 
  } = data;

  // 1. Find the player by ID
  const players = await sql`SELECT * FROM players WHERE id = ${currentPlayerId}`;
  if (players.length === 0) return;
  const player = players[0];

  // 2. Calculate new stats
  const newMatchesPlayed = (player.matchesplayed || 0) + 1;
  const newWins = (player.wins || 0) + (isWin ? 1 : 0);
  const newRating = ratingResult.playerNewRating;

  // 3. Update player record
  await sql`
    UPDATE players 
    SET 
      rating = ${newRating},
      matchesPlayed = ${newMatchesPlayed},
      wins = ${newWins},
      lastActiveAt = ${Date.now()}
    WHERE id = ${currentPlayerId}
  `;

  // 4. Record the match (if matches table exists)
  // try {
  //   await sql`
  //     INSERT INTO matches (id, playerA, playerB, winnerId, role, createdAt)
  //     VALUES (${match.id}, ${match.playerA.id}, ${match.playerB.id}, ${match.winnerId}, ${role}, ${Date.now()})
  //   `;
  // } catch (e) {
  //   console.warn('[Neon] Match record insertion failed (table might not exist):', e);
  // }
}

// ─── Match History ───────────────────────────────────────────
export async function getMatchHistory(playerId: string): Promise<any[]> {
  await ensureTables();
  try {
    const result = await sql`
      SELECT * FROM matches 
      WHERE "playerA"->>'id' = ${playerId} OR "playerB"->>'id' = ${playerId}
      ORDER BY "endedAt" DESC 
      LIMIT 20
    `;
    return result.map(m => ({
      ...m,
      id: m.id,
      playerA: m.playerA,
      playerB: m.playerB,
      questions: m.questions || [],
      endedAt: Number(m.endedAt)
    }));
  } catch (e) {
    console.warn('[Neon] Match history fetch failed:', e);
    return [];
  }
}

