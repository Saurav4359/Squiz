export interface Player {
  id: string;
  walletAddress: string;
  seekerId: string;
  username: string;
  avatarUrl?: string;
  rating: number;
  xp: number;
  level: number;
  matchesPlayed: number;
  matchesWon: number;
  currentStreak: number;
  bestStreak: number;
  avgReactionTime: number;
  badges: Badge[];
  isSkrStaker: boolean;
  skrBalance: number;
  password?: string;
  twitter?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: number;
}

export interface Question {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0-3
  difficulty: number; // 1-5
  sourceDate: number;
  sourceSummary: string;
  createdAt: number;
  expiresAt: number;
}

export interface Match {
  id: string;
  playerA: MatchPlayer;
  playerB: MatchPlayer;
  questions: Question[];
  currentQuestionIndex: number;
  wagerLamports: number;
  wagerAmount?: number;
  wagerType?: 'sol' | 'skr';
  escrowAddress?: string;
  status: MatchStatus;
  winnerId?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
}

export interface MatchPlayer {
  id: string;
  username: string;
  rating: number;
  answers: PlayerAnswer[];
  score: number;
  isReady: boolean;
}

export interface PlayerAnswer {
  questionIndex: number;
  selectedOption: number; // 0-3, -1 for timeout
  isCorrect: boolean;
  reactionTimeMs: number;
  answeredAt: number;
}

export type MatchStatus =
  | 'waiting_for_opponent'
  | 'waiting_for_deposits'
  | 'in_progress'
  | 'finished'
  | 'cancelled'
  | 'refunded';

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  target: number;
  progress: number;
  xpReward: number;
  isCompleted: boolean;
  icon: string;
}

export type QuestType =
  | 'win_matches'
  | 'answer_questions'
  | 'play_matches'
  | 'streak_days'
  | 'skr_tournament'
  | 'accuracy';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  twitter?: string | null;
  rating: number;
  winRate: number;
  matchesPlayed: number;
  avgReactionTime: number;
  isSkrStaker: boolean;
  isCurrentUser: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  category: string;
  publishedAt: number;
  fetchedAt: number;
}
