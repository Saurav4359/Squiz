import { K_FACTOR, DEFAULT_RATING, MIN_RATING } from '../../config/constants';

/**
 * Elo Rating System (Codeforces-style)
 * 
 * When two players compete, their ratings update based on:
 * - The expected outcome (based on rating difference)
 * - The actual outcome (win/loss/draw)
 * - K-factor (how much ratings can change per match)
 */

export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateNewRating(
  currentRating: number,
  expectedScore: number,
  actualScore: number, // 1 = win, 0.5 = draw, 0 = loss
  kFactor: number = K_FACTOR
): number {
  const newRating = Math.round(currentRating + kFactor * (actualScore - expectedScore));
  return Math.max(MIN_RATING, newRating);
}

export interface RatingResult {
  winnerNewRating: number;
  loserNewRating: number;
  winnerDelta: number;
  loserDelta: number;
}

export function calculateMatchRatings(
  winnerRating: number,
  loserRating: number
): RatingResult {
  const expectedWinner = calculateExpectedScore(winnerRating, loserRating);
  const expectedLoser = calculateExpectedScore(loserRating, winnerRating);

  const winnerNew = calculateNewRating(winnerRating, expectedWinner, 1);
  const loserNew = calculateNewRating(loserRating, expectedLoser, 0);

  return {
    winnerNewRating: winnerNew,
    loserNewRating: loserNew,
    winnerDelta: winnerNew - winnerRating,
    loserDelta: loserNew - loserRating,
  };
}

export function calculateDrawRatings(
  ratingA: number,
  ratingB: number
): { newRatingA: number; newRatingB: number; deltaA: number; deltaB: number } {
  const expectedA = calculateExpectedScore(ratingA, ratingB);
  const expectedB = calculateExpectedScore(ratingB, ratingA);

  const newA = calculateNewRating(ratingA, expectedA, 0.5);
  const newB = calculateNewRating(ratingB, expectedB, 0.5);

  return {
    newRatingA: newA,
    newRatingB: newB,
    deltaA: newA - ratingA,
    deltaB: newB - ratingB,
  };
}

/**
 * Calculate XP earned from a match
 */
export function calculateXP(
  won: boolean,
  _correctAnswers: number,
  _totalQuestions: number,
  _avgReactionTimeMs: number,
  _isSkrStaker: boolean,
  _streakDays: number
): number {
  // STRICT REWARDS: Exactly 20 for win, 5 for loss as requested
  return won ? 20 : 5;
}

/**
 * Level calculation from XP
 */
export function calculateLevel(xp: number): number {
  // Each level requires progressively more XP
  // Level 1: 0 XP, Level 2: 100 XP, Level 3: 250 XP, etc.
  if (xp < 100) return 1;
  if (xp < 250) return 2;
  if (xp < 500) return 3;
  if (xp < 1000) return 4;
  if (xp < 2000) return 5;
  if (xp < 3500) return 6;
  if (xp < 5500) return 7;
  if (xp < 8000) return 8;
  if (xp < 12000) return 9;
  return Math.floor(10 + (xp - 12000) / 5000);
}

export function getXPForNextLevel(currentXP: number): { current: number; required: number; progress: number } {
  const thresholds = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000];
  const level = calculateLevel(currentXP);

  if (level >= 10) {
    const baseXP = 12000 + (level - 10) * 5000;
    const nextXP = baseXP + 5000;
    return {
      current: currentXP - baseXP,
      required: 5000,
      progress: (currentXP - baseXP) / 5000,
    };
  }

  const currentThreshold = thresholds[level - 1] || 0;
  const nextThreshold = thresholds[level] || currentThreshold + 5000;
  const diff = nextThreshold - currentThreshold;

  return {
    current: currentXP - currentThreshold,
    required: diff,
    progress: (currentXP - currentThreshold) / diff,
  };
}

/**
 * Get rank title based on rating
 */
export function getRankTitle(rating: number): string {
  if (rating >= 2400) return 'Legendary';
  if (rating >= 2100) return 'Grandmaster';
  if (rating >= 1900) return 'Master';
  if (rating >= 1600) return 'Expert';
  if (rating >= 1400) return 'Specialist';
  if (rating >= 1200) return 'Apprentice';
  return 'Newcomer';
}

export function getRankColor(rating: number): string {
  if (rating >= 2400) return '#FFD700'; // Gold
  if (rating >= 2100) return '#FF4757'; // Red
  if (rating >= 1900) return '#A855F7'; // Purple
  if (rating >= 1600) return '#00D9FF'; // Cyan
  if (rating >= 1400) return '#00F5A0'; // Green
  if (rating >= 1200) return '#8B8B9E'; // Gray
  return '#5A5A6E'; // Dim
}
