import { neon } from '@neondatabase/serverless';
import { Player, DailyQuest } from '../../types';
import { UserRole } from '../../config/constants';

// For development, ensure you define EXPO_PUBLIC_DATABASE_URL in .env
const DATABASE_URL = process.env.EXPO_PUBLIC_DATABASE_URL || 'postgresql://user:pass@ep-fake-host.neon.tech/neondb?sslmode=require';

export const sql = neon(DATABASE_URL);

// ─── Player Functions ─────────────────────────────────────────
export async function getPlayer(walletAddress: string): Promise<Player | null> {
  const result = await sql`SELECT * FROM players WHERE walletAddress = ${walletAddress} LIMIT 1`;
  if (result.length === 0) return null;
  
  const p = result[0];
  const defaultRatings = {
      [UserRole.DEGEN]: 1200,
      [UserRole.DEV]: 1200,
      [UserRole.NORMIE]: 1200,
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
  return {
    id: p.id,
    walletAddress: p.walletaddress,
    seekerId: p.seekerid,
    username: p.username,
    primaryRole: p.primaryrole as UserRole,
    rating: p.rating,
    matchesPlayed: p.matchesplayed,
    wins: p.wins,
    losses: p.losses,
    createdAt: Number(p.createdat),
    lastActiveAt: Number(p.lastactiveat),
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
