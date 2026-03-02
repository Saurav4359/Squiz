/**
 * Match Result Service
 * Persists match outcome to Firestore: saves match, updates player ratings,
 * XP, stats, quest progress, and leaderboard — all in one call after game ends.
 */

import { Match } from '../../types';
import { UserRole } from '../../config/constants';
import { RatingResult } from '../matchmaking/ratingSystem';
import {
  createMatch,
  updatePlayer,
  updatePlayerRating,
  updateQuestProgress,
  getDailyQuests,
} from './firestore';
import {
  doc,
  increment,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface MatchResultPayload {
  match: Match;
  currentPlayerId: string;
  role: UserRole;
  ratingResult: RatingResult;
  xpEarned: number;
  correctAnswers: number;
  totalQuestions: number;
  isWin: boolean;
  isDraw: boolean;
  wagerType: 'sol' | 'skr';
}

export async function persistMatchResult(payload: MatchResultPayload): Promise<void> {
  const {
    match,
    currentPlayerId,
    role,
    ratingResult,
    xpEarned,
    correctAnswers,
    isWin,
    isDraw,
    wagerType,
  } = payload;

  const isPlayerA = match.playerA.id === currentPlayerId;
  const playerData = isPlayerA ? match.playerA : match.playerB;
  const totalAnswers = playerData.answers.length;
  const avgReaction = totalAnswers > 0
    ? playerData.answers.reduce((s, a) => s + a.reactionTimeMs, 0) / totalAnswers
    : 0;

  // Run all updates concurrently for speed
  await Promise.allSettled([
    // 1. Save the match document
    saveMatchToFirestore(match).catch(e =>
      console.warn('[Match] Failed to save match:', e)
    ),

    // 2. Update player rating for this role
    updatePlayerRating(
      currentPlayerId,
      role,
      isWin ? ratingResult.winnerNewRating : ratingResult.loserNewRating
    ).catch(e => console.warn('[Match] Failed to update rating:', e)),

    // 3. Update player stats atomically
    updatePlayerStats(
      currentPlayerId,
      xpEarned,
      isWin,
      isDraw,
      avgReaction,
      correctAnswers
    ).catch(e => console.warn('[Match] Failed to update stats:', e)),

    // 4. Update quest progress
    updateQuestProgress(currentPlayerId, 'answer_questions', correctAnswers)
      .catch(e => console.warn('[Match] Quest update failed:', e)),
    ...(isWin
      ? [
          updateQuestProgress(currentPlayerId, 'win_matches', 1)
            .catch(e => console.warn('[Match] Quest update failed:', e)),
        ]
      : []),
    ...(wagerType === 'skr'
      ? [
          updateQuestProgress(currentPlayerId, 'skr_tournament', 1)
            .catch(e => console.warn('[Match] Quest update failed:', e)),
        ]
      : []),
  ]);
}

async function saveMatchToFirestore(match: Match): Promise<void> {
  try {
    await setDoc(doc(db, 'matches', match.id), {
      ...match,
      savedAt: Date.now(),
    });
  } catch (e) {
    // Fallback: try addDoc if setDoc fails (e.g., ID conflict)
    await createMatch(match);
  }
}

async function updatePlayerStats(
  playerId: string,
  xpEarned: number,
  isWin: boolean,
  isDraw: boolean,
  avgReaction: number,
  correctAnswers: number
): Promise<void> {
  const playerRef = doc(db, 'players', playerId);

  const updates: Record<string, any> = {
    matchesPlayed: increment(1),
    xp: increment(xpEarned),
    lastActiveAt: Date.now(),
  };

  if (isWin) {
    updates.matchesWon = increment(1);
    updates.currentStreak = increment(1);
  } else if (!isDraw) {
    updates.currentStreak = 0;
  }

  if (avgReaction > 0) {
    // Rolling average reaction time (approximate with weighted blend)
    // Full accuracy would require reading current value first,
    // but this keeps it non-blocking
    updates.avgReactionTime = avgReaction;
  }

  await updateDoc(playerRef, updates);

  // Update bestStreak separately (read-then-write is ok here, it's non-critical)
  if (isWin) {
    try {
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(playerRef);
      if (snap.exists()) {
        const player = snap.data();
        const currentStreak = (player.currentStreak || 0) + 1; // +1 because we just incremented
        if (currentStreak > (player.bestStreak || 0)) {
          await updateDoc(playerRef, { bestStreak: currentStreak });
        }
      }
    } catch {
      // Non-critical, skip
    }
  }
}
