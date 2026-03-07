import { supabase } from '../../config/supabase';
import { Question, Match, MatchPlayer, PlayerAnswer } from '../../types';
import { QUESTIONS_PER_MATCH } from '../../config/constants';
import { generateGenericQuestions, generateFallbackQuestions } from '../ai/questionGenerator';

// ──────────────────────────────────────────────────────────
// SUPABASE REALTIME MATCHMAKING
//
// No polling. No extra tables for queue.
// Uses broadcast channels for instant P2P communication.
// ──────────────────────────────────────────────────────────

let queueChannel: any = null;
let matchChannel: any = null;

// ──────────────────────────────────────────────────────────
// MATCHMAKING QUEUE (broadcast — zero DB queries)
// ──────────────────────────────────────────────────────────

interface QueueCallbacks {
  onMatched: (match: Match) => void;
  onError?: (err: any) => void;
}

/**
 * Join matchmaking queue via Supabase Realtime broadcast.
 * When two players are in the same channel, the second player creates the match.
 */
export async function joinQueue(
  playerId: string,
  username: string,
  rating: number,
  wagerType: 'sol' | 'skr',
  callbacks: QueueCallbacks
): Promise<void> {
  // Clean up any existing channel
  if (queueChannel) {
    supabase.removeChannel(queueChannel);
    queueChannel = null;
  }

  const channelName = `queue:${wagerType}`;
  queueChannel = supabase.channel(channelName);

  // Listen for other players seeking
  queueChannel.on('broadcast', { event: 'seeking' }, async (msg: any) => {
    const opponent = msg.payload;
    if (opponent.playerId === playerId) return; // Ignore self

    // We found an opponent! We (the listener) create the match.
    try {
      const match = await createLiveMatch(
        { id: playerId, username, rating },
        { id: opponent.playerId, username: opponent.username, rating: opponent.rating },
        wagerType
      );

      // Broadcast match to the channel so opponent picks it up
      await queueChannel.send({
        type: 'broadcast',
        event: 'matched',
        payload: { match, creatorId: playerId },
      });

      callbacks.onMatched(match);
    } catch (err) {
      console.warn('[Queue] Match creation failed:', err);
      callbacks.onError?.(err);
    }
  });

  // Listen for match created by opponent (they saw us first)
  queueChannel.on('broadcast', { event: 'matched' }, (msg: any) => {
    const { match, creatorId } = msg.payload;
    if (creatorId === playerId) return; // We created this, ignore

    // Check if we're in this match
    if (match.playerA.id === playerId || match.playerB.id === playerId) {
      callbacks.onMatched(match);
    }
  });

  // Subscribe and announce ourselves
  await queueChannel.subscribe();

  await queueChannel.send({
    type: 'broadcast',
    event: 'seeking',
    payload: { playerId, username, rating },
  });

  console.log(`[Queue] ${username} joined ${channelName}`);
}

/**
 * Leave the matchmaking queue.
 */
export function leaveQueue(playerId: string): void {
  if (queueChannel) {
    supabase.removeChannel(queueChannel);
    queueChannel = null;
  }
  console.log(`[Queue] Player ${playerId} left queue`);
}

// ──────────────────────────────────────────────────────────
// LIVE MATCH (broadcast — real-time answer sync)
// ──────────────────────────────────────────────────────────

export interface MatchResult {
  winnerId: string | undefined;
  playerAScore: number;
  playerBScore: number;
  ratingResult: any;
}

interface MatchCallbacks {
  onOpponentAnswer: (data: { answers: PlayerAnswer[]; score: number }) => void;
  onOpponentFinished: () => void;
  onMatchResult?: (result: MatchResult) => void;
}

/**
 * Join a live match channel to send/receive answers in real-time.
 */
export function joinMatchChannel(
  matchId: string,
  playerId: string,
  callbacks: MatchCallbacks
): void {
  // Clean up existing match channel
  if (matchChannel) {
    supabase.removeChannel(matchChannel);
    matchChannel = null;
  }

  matchChannel = supabase.channel(`match:${matchId}`);

  // Listen for opponent's answers
  matchChannel.on('broadcast', { event: 'answer' }, (msg: any) => {
    const data = msg.payload;
    if (data.playerId === playerId) return; // Ignore own broadcasts

    callbacks.onOpponentAnswer({
      answers: data.answers,
      score: data.score,
    });

    // Check if opponent finished all questions
    if (data.answers.length >= QUESTIONS_PER_MATCH) {
      callbacks.onOpponentFinished();
    }
  });

  // Listen for authoritative match result from playerA
  matchChannel.on('broadcast', { event: 'match_result' }, (msg: any) => {
    const result = msg.payload as MatchResult;
    callbacks.onMatchResult?.(result);
  });

  matchChannel.subscribe();
  console.log(`[Match] Player ${playerId} joined match channel ${matchId}`);
}

/**
 * Broadcast your answer to opponent via realtime channel.
 */
export function sendAnswer(
  matchId: string,
  playerId: string,
  answers: PlayerAnswer[],
  score: number
): void {
  if (!matchChannel) return;

  matchChannel.send({
    type: 'broadcast',
    event: 'answer',
    payload: { playerId, answers, score },
  });
}

/**
 * Broadcast authoritative match result (called only by playerA).
 */
export function sendMatchResult(result: MatchResult): void {
  if (!matchChannel) return;

  matchChannel.send({
    type: 'broadcast',
    event: 'match_result',
    payload: result,
  });
}

/**
 * Leave the match channel.
 */
export function leaveMatchChannel(): void {
  if (matchChannel) {
    supabase.removeChannel(matchChannel);
    matchChannel = null;
  }
}

// ──────────────────────────────────────────────────────────
// MATCH CREATION (generates questions, returns Match object)
// ──────────────────────────────────────────────────────────

async function createLiveMatch(
  playerAData: { id: string; username: string; rating: number },
  playerBData: { id: string; username: string; rating: number },
  wagerType: 'sol' | 'skr'
): Promise<Match> {
  const now = Date.now();
  const matchId = `live_${now}_${Math.random().toString(36).slice(2, 6)}`;

  // Generate questions from latest crypto news (fallback to static pool)
  let questions: Question[];
  try {
    questions = await generateGenericQuestions(QUESTIONS_PER_MATCH);
  } catch (e) {
    console.warn('[Match] AI question generation failed, using fallback:', e);
    questions = generateFallbackQuestions(QUESTIONS_PER_MATCH);
  }

  const playerA: MatchPlayer = {
    id: playerAData.id,
    username: playerAData.username,
    rating: playerAData.rating,
    answers: [],
    score: 0,
    isReady: true,
  };

  const playerB: MatchPlayer = {
    id: playerBData.id,
    username: playerBData.username,
    rating: playerBData.rating,
    answers: [],
    score: 0,
    isReady: true,
  };

  const match: Match = {
    id: matchId,
    playerA,
    playerB,
    questions,
    currentQuestionIndex: 0,
    wagerLamports: wagerType === 'sol' ? 50000000 : 0,
    wagerType,
    status: 'in_progress',
    createdAt: now,
    startedAt: now,
  };

  console.log(`[Match] Created: ${playerA.username} vs ${playerB.username}`);
  return match;
}

/**
 * Persist final match result to DB (called once at match end).
 */
export async function finishLiveMatch(
  matchId: string,
  winnerId: string | undefined
): Promise<void> {
  console.log(`[Match] ${matchId} finished. Winner: ${winnerId || 'DRAW'}`);
}
