import { sql } from '../db/neon';
import { Question, Match, MatchPlayer, PlayerAnswer } from '../../types';
import { UserRole, QUESTIONS_PER_MATCH, SECONDS_PER_QUESTION } from '../../config/constants';
import { generateFallbackQuestions } from '../ai/questionGenerator';

// ──────────────────────────────────────────────────────────
// NEON-EFFICIENT REAL-TIME PVP MATCHMAKING
// 
// Design goals:
// - Stay within Neon free tier (191.9 compute hrs/month)
// - Poll only when necessary (smart polling)
// - ~23 queries per full match lifecycle
// - Zero queries when user is idle
// ──────────────────────────────────────────────────────────

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS matchmaking_queue (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL,
        username TEXT NOT NULL,
        rating INTEGER DEFAULT 1200,
        role TEXT NOT NULL,
        wager_type TEXT DEFAULT 'sol',
        match_id TEXT,
        status TEXT DEFAULT 'searching',
        created_at BIGINT,
        updated_at BIGINT
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS live_matches (
        id TEXT PRIMARY KEY,
        player_a JSONB NOT NULL,
        player_b JSONB NOT NULL,
        questions JSONB NOT NULL,
        answers_a JSONB DEFAULT '[]'::jsonb,
        answers_b JSONB DEFAULT '[]'::jsonb,
        score_a INTEGER DEFAULT 0,
        score_b INTEGER DEFAULT 0,
        current_question INTEGER DEFAULT 0,
        status TEXT DEFAULT 'in_progress',
        winner_id TEXT,
        role TEXT,
        wager_type TEXT DEFAULT 'sol',
        wager_lamports BIGINT DEFAULT 50000000,
        created_at BIGINT,
        started_at BIGINT,
        ended_at BIGINT
      )
    `;

    // Clean up stale queue entries (older than 2 minutes — saves storage)
    const twoMinAgo = Date.now() - 2 * 60 * 1000;
    await sql`DELETE FROM matchmaking_queue WHERE created_at < ${twoMinAgo}`;
    
    // Clean up finished matches older than 1 hour from live table
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    await sql`DELETE FROM live_matches WHERE status = 'finished' AND ended_at < ${oneHourAgo}`;

    tablesReady = true;
  } catch (e) {
    console.warn('[LiveMatch] Table setup failed:', e);
  }
}

// ──────────────────────────────────────────────────────────
// MATCHMAKING QUEUE (polls every ~3s, ~5 queries to find match)
// ──────────────────────────────────────────────────────────

/**
 * Join the matchmaking queue. Removes any stale entries for this player first.
 */
export async function joinQueue(
  playerId: string,
  username: string,
  rating: number,
  role: UserRole,
  wagerType: 'sol' | 'skr'
): Promise<string> {
  await ensureTables();
  const now = Date.now();

  // Remove stale entries for this player (prevents ghost entries)
  await sql`DELETE FROM matchmaking_queue WHERE player_id = ${playerId}`;

  const result = await sql`
    INSERT INTO matchmaking_queue (player_id, username, rating, role, wager_type, status, created_at, updated_at)
    VALUES (${playerId}, ${username}, ${rating}, ${role}, ${wagerType}, 'searching', ${now}, ${now})
    RETURNING id
  `;
  console.log(`[LiveMatch] ${username} joined queue`);
  return String(result[0].id);
}

/**
 * Leave the matchmaking queue (when user clicks Cancel).
 */
export async function leaveQueue(playerId: string): Promise<void> {
  await sql`DELETE FROM matchmaking_queue WHERE player_id = ${playerId}`;
  console.log(`[LiveMatch] Player ${playerId} left queue`);
}

/**
 * Single poll to check for an opponent. This is the ONLY query that runs every 3s.
 * Returns:
 * - 'searching': No opponent found yet
 * - 'matched': Match created/found, includes full match data
 */
export async function pollForMatch(
  playerId: string,
  role: UserRole,
  wagerType: 'sol' | 'skr'
): Promise<{ status: 'searching' | 'matched'; match?: Match }> {

  // Step 1: Check if someone already matched us (1 query)
  const myEntry = await sql`
    SELECT match_id, status FROM matchmaking_queue 
    WHERE player_id = ${playerId} LIMIT 1
  `;

  if (myEntry.length === 0) {
    return { status: 'searching' }; // Entry was cleaned up, caller should re-join
  }

  // If we've been matched by the other player
  if (myEntry[0].status === 'matched' && myEntry[0].match_id) {
    const match = await getLiveMatch(myEntry[0].match_id);
    if (match) return { status: 'matched', match };
  }

  // Step 2: Find an opponent in the same role & wager (1 query, combined with update)
  const opponents = await sql`
    SELECT * FROM matchmaking_queue 
    WHERE player_id != ${playerId} 
      AND role = ${role} 
      AND wager_type = ${wagerType} 
      AND status = 'searching'
    ORDER BY created_at ASC 
    LIMIT 1
  `;

  if (opponents.length === 0) {
    return { status: 'searching' };
  }

  // Step 3: WE create the match (first-come creates it)
  const opponent = opponents[0];
  const me = await sql`SELECT * FROM matchmaking_queue WHERE player_id = ${playerId} LIMIT 1`;
  if (me.length === 0) return { status: 'searching' };

  const matchId = `live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const questions = generateFallbackQuestions(role, QUESTIONS_PER_MATCH);
  const now = Date.now();

  const playerA: MatchPlayer = {
    id: me[0].player_id,
    username: me[0].username,
    rating: me[0].rating,
    answers: [],
    score: 0,
    isReady: true,
  };

  const playerB: MatchPlayer = {
    id: opponent.player_id,
    username: opponent.username,
    rating: opponent.rating,
    answers: [],
    score: 0,
    isReady: true,
  };

  // Insert the live match (1 query)
  await sql`
    INSERT INTO live_matches (
      id, player_a, player_b, questions, answers_a, answers_b, 
      score_a, score_b, current_question, status, role, wager_type, 
      wager_lamports, created_at, started_at
    ) VALUES (
      ${matchId}, 
      ${JSON.stringify(playerA)}::jsonb, 
      ${JSON.stringify(playerB)}::jsonb, 
      ${JSON.stringify(questions)}::jsonb, 
      '[]'::jsonb, '[]'::jsonb, 
      0, 0, 0, 'in_progress', ${role}, ${wagerType}, 
      50000000, ${now}, ${now}
    )
  `;

  // Mark both players as matched (1 query with OR condition)
  await sql`
    UPDATE matchmaking_queue 
    SET status = 'matched', match_id = ${matchId}, updated_at = ${now}
    WHERE player_id IN (${playerId}, ${opponent.player_id})
  `;

  console.log(`[LiveMatch] Match created: ${me[0].username} vs ${opponent.username}`);

  const match: Match = {
    id: matchId,
    playerA,
    playerB,
    questions,
    currentQuestionIndex: 0,
    wagerLamports: 50000000,
    wagerType,
    status: 'in_progress',
    createdAt: now,
    startedAt: now,
  };

  return { status: 'matched', match };
}

// ──────────────────────────────────────────────────────────
// LIVE MATCH (polls only after YOUR answer, ~3 queries/question)
// ──────────────────────────────────────────────────────────

/**
 * Fetch the full live match state. Used sparingly.
 */
export async function getLiveMatch(matchId: string): Promise<Match | null> {
  const result = await sql`SELECT * FROM live_matches WHERE id = ${matchId} LIMIT 1`;
  if (result.length === 0) return null;

  const m = result[0];
  const playerA = typeof m.player_a === 'string' ? JSON.parse(m.player_a) : m.player_a;
  const playerB = typeof m.player_b === 'string' ? JSON.parse(m.player_b) : m.player_b;
  const questions = typeof m.questions === 'string' ? JSON.parse(m.questions) : m.questions;
  const answersA = typeof m.answers_a === 'string' ? JSON.parse(m.answers_a) : (m.answers_a || []);
  const answersB = typeof m.answers_b === 'string' ? JSON.parse(m.answers_b) : (m.answers_b || []);

  playerA.answers = answersA;
  playerA.score = m.score_a || 0;
  playerB.answers = answersB;
  playerB.score = m.score_b || 0;

  return {
    id: m.id,
    playerA,
    playerB,
    questions,
    currentQuestionIndex: m.current_question || 0,
    wagerLamports: Number(m.wager_lamports) || 50000000,
    wagerType: m.wager_type || 'sol',
    status: m.status || 'in_progress',
    winnerId: m.winner_id || undefined,
    createdAt: Number(m.created_at),
    startedAt: Number(m.started_at),
    endedAt: m.ended_at ? Number(m.ended_at) : undefined,
  };
}

/**
 * Poll the match state. Alias for getLiveMatch, used by the waiting screen.
 */
export async function pollMatchState(matchId: string): Promise<Match | null> {
  return getLiveMatch(matchId);
}

/**
 * Submit ALL of your answers. Then immediately poll for opponent's state.
 * Returns the updated match with both players' latest data.
 * This is the EFFICIENT approach: replace the complete array to prevent race condition data loss.
 */
export async function submitAnswerAndPoll(
  matchId: string,
  playerId: string,
  myAnswers: PlayerAnswer[],
  myScore: number
): Promise<Match | null> {
  const match = await getLiveMatch(matchId);
  if (!match) return null;

  const isPlayerA = match.playerA.id === playerId;

  if (isPlayerA) {
    await sql`
      UPDATE live_matches 
      SET answers_a = ${JSON.stringify(myAnswers)}::jsonb, 
          score_a = ${myScore}
      WHERE id = ${matchId}
    `;
  } else {
    await sql`
      UPDATE live_matches 
      SET answers_b = ${JSON.stringify(myAnswers)}::jsonb, 
          score_b = ${myScore}
      WHERE id = ${matchId}
    `;
  }

  // Immediately fetch the latest state (to see opponent's answer too)
  return getLiveMatch(matchId);
}

/**
 * Lightweight poll: just check opponent's answer count and score.
 * Used while waiting for opponent to answer (every 2s).
 */
export async function pollOpponentStatus(
  matchId: string,
  playerId: string,
  questionIndex: number
): Promise<{ opponentAnswered: boolean; match: Match | null }> {
  const match = await getLiveMatch(matchId);
  if (!match) return { opponentAnswered: false, match: null };

  const isPlayerA = match.playerA.id === playerId;
  const opponentAnswers = isPlayerA ? match.playerB.answers : match.playerA.answers;
  
  const opponentAnswered = opponentAnswers.some(
    (a: PlayerAnswer) => a.questionIndex === questionIndex
  );

  return { opponentAnswered, match };
}

/**
 * Finish the match and record the winner.
 */
export async function finishLiveMatch(
  matchId: string,
  winnerId: string | undefined
): Promise<void> {
  await sql`
    UPDATE live_matches 
    SET status = 'finished', winner_id = ${winnerId || null}, ended_at = ${Date.now()}
    WHERE id = ${matchId} AND status != 'finished'
  `;
  // Clean up queue
  await sql`DELETE FROM matchmaking_queue WHERE match_id = ${matchId}`;
  console.log(`[LiveMatch] Match ${matchId} finished. Winner: ${winnerId || 'DRAW'}`);
}
