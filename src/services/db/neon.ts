import { neon } from '@neondatabase/serverless';
import { Player, DailyQuest } from '../../types';
import { UserRole, ROLES } from '../../config/constants';
import { calculateLevel } from '../matchmaking/ratingSystem';

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
          xp INTEGER DEFAULT 0,
          isSkrStaker BOOLEAN DEFAULT FALSE,
          skrBalance DECIMAL DEFAULT 0,
          createdAt BIGINT,
          lastActiveAt BIGINT
      );
    `;
    
    // Migrations for existing tables (won't affect NEW tables but fixes OLD ones)
    try {
      await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0`;
      await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS isskrstaker BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS skrbalance DECIMAL DEFAULT 0`;
      await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS role_ratings JSONB DEFAULT '{}'::jsonb`;
    } catch (err) {
      console.warn('[Neon] Migration: players columns already exist or failed:', err);
    }

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
          wagerLamports BIGINT DEFAULT 0,
          wagerType TEXT DEFAULT 'sol',
          createdAt BIGINT,
          endedAt BIGINT
      );
    `;
    
    // Add missing columns if they don't exist
    try {
      await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS playera JSONB`;
      await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS playerb JSONB`;
      await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS wagerLamports BIGINT DEFAULT 0`;
      await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS wagertype TEXT DEFAULT 'sol'`;
    } catch (e) {
      console.warn('[Neon] Migration: matches columns already exist or failed:', e);
    }
    
    // Seed some legendary bot players for the leaderboard if table is empty
    const playerCount = await sql`SELECT count(*) FROM players`;
    if (playerCount[0].count === '0') {
      const bots = [
        { u: 'SolWarrior', r: 'Trader', rt: 2600, x: 5000 },
        { u: 'HeliusHacker', r: 'Developer', rt: 2450, x: 4200 },
        { u: 'TensorTitan', r: 'NFT Collector', rt: 2380, x: 3800 },
        { u: 'JupiterJuggernaut', r: 'Trader', rt: 2100, x: 2500 },
        { u: 'PhantomPilot', r: 'DeFi User', rt: 1950, x: 1800 },
        { u: 'MeteoraMind', r: 'Researcher', rt: 1800, x: 1200 },
      ];
      for (const bot of bots) {
        await sql`
          INSERT INTO players (walletAddress, username, primaryRole, rating, xp, role_ratings)
          VALUES (${'bot_' + bot.u}, ${bot.u}, ${bot.r}, ${bot.rt}, ${bot.x}, ${JSON.stringify({ [bot.r]: bot.rt })})
        `;
      }
    }
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
  const roleRatings = p.role_ratings || {};
  const ratings: Record<UserRole, number> = {} as any;
  ROLES.forEach(r => {
    ratings[r] = roleRatings[r] ? Number(roleRatings[r]) : 1200;
  });
  // Ensure primary role has something
  if (ratings[p.primaryrole as UserRole] === 1200 && p.rating) {
      ratings[p.primaryrole as UserRole] = p.rating;
  }

  return {
    id: String(p.id),
    walletAddress: p.walletaddress,
    seekerId: p.seekerid,
    username: p.username,
    roles: [p.primaryrole as UserRole],
    primaryRole: p.primaryrole as UserRole,
    ratings,
    xp: p.xp || 0,
    level: calculateLevel(p.xp || 0),
    matchesPlayed: p.matchesplayed || 0,
    matchesWon: p.wins || 0,
    currentStreak: 0,
    bestStreak: 0,
    avgReactionTime: 0,
    badges: [],
    isSkrStaker: p.isskrstaker || false,
    skrBalance: Number(p.skrbalance) || 0,
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
  const ratings: Record<UserRole, number> = {} as any;
  ROLES.forEach(r => ratings[r] = 1200);
  ratings[p.primaryrole as UserRole] = p.rating || 1200;

  return {
    id: String(p.id),
    walletAddress: p.walletaddress,
    seekerId: p.seekerid,
    username: p.username,
    roles: [p.primaryrole as UserRole],
    primaryRole: p.primaryrole as UserRole,
    ratings,
    xp: p.xp || 0,
    level: calculateLevel(p.xp || 0),
    matchesPlayed: p.matchesplayed || 0,
    matchesWon: p.wins || 0,
    currentStreak: 0,
    bestStreak: 0,
    avgReactionTime: 0,
    badges: [],
    isSkrStaker: p.isskrstaker || false,
    skrBalance: Number(p.skrbalance) || 0,
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
  // Only show players who have a rating for this specific role
  const result = await sql`
    SELECT id, username, (role_ratings->>${role})::int as r_val, wins, matchesplayed, isskrstaker
    FROM players 
    WHERE role_ratings ? ${role}
    ORDER BY r_val DESC 
    LIMIT 20
  `;
  
  return result.map((p: any, index: number) => ({
    rank: index + 1,
    playerId: String(p.id),
    username: p.username,
    rating: p.r_val || 1200,
    winRate: p.matchesplayed > 0 ? Math.round((Number(p.wins) / Number(p.matchesplayed)) * 100) : 0,
    matchesPlayed: p.matchesplayed || 0,
    avgReactionTime: 1800,
    isSkrStaker: p.isskrstaker || false,
    isCurrentUser: false,
  }));
}


// ─── Match Persistence ────────────────────────────────────────
export async function persistMatchResult(data: any): Promise<void> {
  await ensureTables();
  const { 
    match, 
    currentPlayerId, 
    role, 
    ratingResult, 
    xpEarned, 
    isWin, 
    isDraw,
    wagerType
  } = data;

  // 1. Find the player by ID
  const pId = Number(currentPlayerId);
  const players = await sql`SELECT * FROM players WHERE id = ${pId}`;
  if (players.length === 0) return;
  const player = players[0];

  // 2. Calculate new stats
  const newMatchesPlayed = (player.matchesplayed || 0) + 1;
  const newWins = (player.wins || 0) + (isWin ? 1 : 0);
  
  // FIX: ratingResult contains winnerNewRating/loserNewRating, not playerNewRating
  const newRating = isWin ? ratingResult.winnerNewRating : ratingResult.loserNewRating;
  const newXP = (player.xp || 0) + xpEarned;

  // 3. Update player record
  // Use explicit casting and ensure columns exist
  // We update both the global rating AND the role-specific rating
  await sql`
    UPDATE players 
    SET 
      rating = ${newRating},
      role_ratings = jsonb_set(COALESCE(role_ratings, '{}'::jsonb), ARRAY[${role}], ${String(newRating)}::jsonb),
      matchesplayed = ${newMatchesPlayed},
      wins = ${newWins},
      xp = ${newXP},
      lastactiveat = ${Date.now()}
    WHERE id = ${Number(currentPlayerId)}
  `;
  console.log(`[Neon] Player stats updated for ID: ${currentPlayerId}`);

  // 4. Record the match
  try {
    const pA = typeof match.playerA === 'string' ? match.playerA : JSON.stringify(match.playerA);
    const pB = typeof match.playerB === 'string' ? match.playerB : JSON.stringify(match.playerB);

    await sql`
      INSERT INTO matches (id, playera, playerb, winnerid, role, wagerlamports, wagertype, createdat, endedat)
      VALUES (
        ${match.id}, 
        ${pA}::jsonb, 
        ${pB}::jsonb, 
        ${match.winnerId || null}, 
        ${role}, 
        ${match.wagerLamports || 0},
        ${wagerType || 'sol'},
        ${match.createdAt}, 
        ${Date.now()}
      )
      ON CONFLICT (id) DO UPDATE SET 
        winnerid = EXCLUDED.winnerid,
        endedat = EXCLUDED.endedat,
        playera = EXCLUDED.playera,
        playerb = EXCLUDED.playerb
    `;
    console.log(`[Neon] Match history record saved: ${match.id}`);
  } catch (e) {
    console.warn('[Neon] Match record insertion failed:', e);
  }
}

// ─── Match History ───────────────────────────────────────────
export async function getMatchHistory(playerId: string): Promise<any[]> {
  await ensureTables();
  try {
    const result = await sql`
      SELECT * FROM matches 
      WHERE (playera->>'id' = ${String(playerId)} OR playerb->>'id' = ${String(playerId)})
      ORDER BY endedat DESC 
      LIMIT 20
    `;
    return result.map(m => ({
      ...m,
      playerA: m.playera,
      playerB: m.playerb,
      winnerId: m.winnerid,
      wagerLamports: Number(m.wagerlamports || 0),
      wagerType: m.wagertype || 'sol',
      endedAt: Number(m.endedat)
    }));
  } catch (e) {
    console.warn('[Neon] Match history fetch failed:', e);
    return [];
  }
}

