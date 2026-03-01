import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import HomeScreen from './src/screens/HomeScreen';
import BattleScreen from './src/screens/BattleScreen';
import MatchmakingScreen from './src/screens/MatchmakingScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';

import { colors } from './src/config/theme';
import { DEFAULT_RATING, ROLES, UserRole, QUESTIONS_PER_MATCH } from './src/config/constants';
import { Player, Match, Question, DailyQuest, LeaderboardEntry, MatchPlayer } from './src/types';
import { calculateMatchRatings, calculateXP } from './src/services/matchmaking/ratingSystem';
import { generateQuestionsFromNews, fetchLatestNews } from './src/services/ai/questionGenerator';

// ─── App State Types ────────────────────────────────────
type Screen =
  | 'home'
  | 'matchmaking'
  | 'battle'
  | 'results'
  | 'leaderboard'
  | 'profile'
  | 'quests'
  | 'history';

// ─── Mock Data ──────────────────────────────────────────
const MOCK_PLAYER: Player = {
  id: 'player_1',
  walletAddress: '7vfC...x9Qd',
  seekerId: '4827',
  username: 'CryptoKing',
  primaryRole: 'Trader',
  roles: ['Trader', 'DeFi User'],
  ratings: ROLES.reduce((acc, role) => {
    acc[role] = DEFAULT_RATING;
    return acc;
  }, {} as Record<UserRole, number>),
  xp: 1250,
  level: 4,
  matchesPlayed: 23,
  matchesWon: 15,
  currentStreak: 5,
  bestStreak: 8,
  avgReactionTime: 2800,
  badges: [
    { id: 'b1', name: 'First Blood', description: 'Win your first match', icon: '🗡️', earnedAt: Date.now() },
    { id: 'b2', name: 'Speed Demon', description: 'Answer in under 2s', icon: '⚡', earnedAt: Date.now() },
  ],
  isSkrStaker: true,
  skrBalance: 500,
  createdAt: Date.now() - 86400000 * 7,
  lastActiveAt: Date.now(),
};

const MOCK_DAILY_QUESTS: DailyQuest[] = [
  {
    id: 'q1',
    title: 'Win 3 Matches',
    description: 'Win 3 quiz battles today',
    type: 'win_matches',
    target: 3,
    progress: 2,
    xpReward: 75,
    isCompleted: false,
    icon: '⚔️',
  },
  {
    id: 'q2',
    title: 'Answer 10 Questions',
    description: 'Answer 10 questions correctly',
    type: 'answer_questions',
    target: 10,
    progress: 7,
    xpReward: 50,
    isCompleted: false,
    icon: '🧠',
  },
  {
    id: 'q3',
    title: 'SKR Tournament',
    description: 'Play 1 SKR-wager match',
    type: 'skr_tournament',
    target: 1,
    progress: 0,
    xpReward: 150,
    isCompleted: false,
    icon: '💎',
  },
];

const MOCK_QUESTIONS: Question[] = [
  {
    id: 'mq1',
    question: 'Which DEX is the largest aggregator on Solana?',
    options: ['Jupiter', 'Orca', 'Raydium', 'Tensor'],
    correctIndex: 0,
    role: 'Trader',
    difficulty: 2,
    sourceDate: Date.now(),
    sourceSummary: 'Solana DEX market data',
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 86400000,
  },
  {
    id: 'mq2',
    question: 'What is Solana\'s approximate TPS capacity?',
    options: ['400', '4,000', '40,000', '400,000'],
    correctIndex: 1,
    role: 'Trader',
    difficulty: 1,
    sourceDate: Date.now(),
    sourceSummary: 'Solana technical specs',
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 86400000,
  },
  {
    id: 'mq3',
    question: 'What hardware security does Seeker use?',
    options: ['Secure Element', 'Seed Vault', 'TPM Chip', 'Knox'],
    correctIndex: 1,
    role: 'Trader',
    difficulty: 2,
    sourceDate: Date.now(),
    sourceSummary: 'Solana Mobile features',
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 86400000,
  },
  {
    id: 'mq4',
    question: 'What token is the Solana Mobile coordination layer?',
    options: ['SOL', 'BONK', 'SKR', 'MOBILE'],
    correctIndex: 2,
    role: 'Trader',
    difficulty: 1,
    sourceDate: Date.now(),
    sourceSummary: 'SKR token info',
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 86400000,
  },
  {
    id: 'mq5',
    question: 'Which wallet is most popular on Solana?',
    options: ['MetaMask', 'Phantom', 'Solflare', 'Trust Wallet'],
    correctIndex: 1,
    role: 'Trader',
    difficulty: 1,
    sourceDate: Date.now(),
    sourceSummary: 'Solana ecosystem data',
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 86400000,
  },
];

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, playerId: 'p_moon', username: 'MoonTrader', rating: 2341, winRate: 78, matchesPlayed: 156, avgReactionTime: 1800, isSkrStaker: true, isCurrentUser: false },
  { rank: 2, playerId: 'p_alpha', username: 'AlphaSeeker', rating: 2198, winRate: 72, matchesPlayed: 130, avgReactionTime: 2100, isSkrStaker: false, isCurrentUser: false },
  { rank: 3, playerId: 'p_sol', username: 'SolMaxi', rating: 2045, winRate: 69, matchesPlayed: 98, avgReactionTime: 2400, isSkrStaker: true, isCurrentUser: false },
  { rank: 4, playerId: 'p_chain', username: 'ChainBrain', rating: 1987, winRate: 65, matchesPlayed: 87, avgReactionTime: 2300, isSkrStaker: false, isCurrentUser: false },
  { rank: 5, playerId: 'p_defi', username: 'DeFiQueen', rating: 1923, winRate: 64, matchesPlayed: 76, avgReactionTime: 2500, isSkrStaker: true, isCurrentUser: false },
  { rank: 6, playerId: 'p_nft', username: 'NFTHunter', rating: 1899, winRate: 61, matchesPlayed: 65, avgReactionTime: 2600, isSkrStaker: false, isCurrentUser: false },
  { rank: 7, playerId: 'player_1', username: 'CryptoKing', rating: 1847, winRate: 65, matchesPlayed: 23, avgReactionTime: 2800, isSkrStaker: true, isCurrentUser: true },
  { rank: 8, playerId: 'p_block', username: 'BlockSmith', rating: 1823, winRate: 58, matchesPlayed: 54, avgReactionTime: 2900, isSkrStaker: false, isCurrentUser: false },
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [player, setPlayer] = useState<Player>(MOCK_PLAYER);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Trader');
  const [wagerType, setWagerType] = useState<'sol' | 'skr'>('sol');
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [ratingResult, setRatingResult] = useState<any>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>(MOCK_LEADERBOARD);

  // ─── Handlers ───────────────────────────────────────────
  const handleFindMatch = useCallback((role: UserRole, wager: 'sol' | 'skr') => {
    setSelectedRole(role);
    setWagerType(wager);
    setCurrentScreen('matchmaking');

    // Simulate matchmaking delay, then create a match
    setTimeout(() => {
      const opponentRating = player.ratings[role] + Math.floor(Math.random() * 200 - 100);
      const match: Match = {
        id: `match_${Date.now()}`,
        playerA: {
          id: player.id,
          username: player.username,
          rating: player.ratings[role] || DEFAULT_RATING,
          answers: [],
          score: 0,
          isReady: true,
        },
        playerB: {
          id: 'bot_opponent',
          username: 'SolWarrior',
          rating: opponentRating,
          answers: [],
          score: 0,
          isReady: true,
        },
        questions: MOCK_QUESTIONS.slice(0, QUESTIONS_PER_MATCH),
        currentQuestionIndex: 0,
        wagerLamports: 50000000, // 0.05 SOL
        status: 'in_progress',
        createdAt: Date.now(),
        startedAt: Date.now(),
      };
      setCurrentMatch(match);
      setCurrentScreen('battle');
    }, 3000 + Math.random() * 4000);
  }, [player]);

  const handleAnswer = useCallback((questionIndex: number, selectedOption: number, reactionTimeMs: number) => {
    if (!currentMatch) return;

    const question = currentMatch.questions[questionIndex];
    const isCorrect = selectedOption === question.correctIndex;

    // Player answer
    const playerAnswer = {
      questionIndex,
      selectedOption,
      isCorrect,
      reactionTimeMs,
      answeredAt: Date.now(),
    };

    // Simulate bot answer
    const botCorrect = Math.random() > 0.4;
    const botAnswer = {
      questionIndex,
      selectedOption: botCorrect ? question.correctIndex : (question.correctIndex + 1) % 4,
      isCorrect: botCorrect,
      reactionTimeMs: 1500 + Math.random() * 5000,
      answeredAt: Date.now(),
    };

    setCurrentMatch((prev) => {
      if (!prev) return prev;
      const updatedA = {
        ...prev.playerA,
        answers: [...prev.playerA.answers, playerAnswer],
        score: prev.playerA.score + (isCorrect ? 1 : 0),
      };
      const updatedB = {
        ...prev.playerB,
        answers: [...prev.playerB.answers, botAnswer],
        score: prev.playerB.score + (botCorrect ? 1 : 0),
      };

      const nextQuestionIndex = prev.currentQuestionIndex + 1;
      const isLastQuestion = nextQuestionIndex >= prev.questions.length;

      if (isLastQuestion) {
        // Determine winner
        const winnerId =
          updatedA.score > updatedB.score
            ? updatedA.id
            : updatedB.score > updatedA.score
            ? updatedB.id
            : undefined;

        // Calculate rating changes
        const isWinner = winnerId === player.id;
        const result = calculateMatchRatings(
          isWinner ? updatedA.rating : updatedB.rating,
          isWinner ? updatedB.rating : updatedA.rating
        );
        setRatingResult(result);

        // Calculate XP
        const correctCount = updatedA.answers.filter((a) => a.isCorrect).length;
        const avgReaction =
          updatedA.answers.reduce((sum, a) => sum + a.reactionTimeMs, 0) / updatedA.answers.length;
        const xp = calculateXP(
          isWinner,
          correctCount,
          prev.questions.length,
          avgReaction,
          player.isSkrStaker,
          player.currentStreak
        );
        setXpEarned(xp);

        // Navigate to results after a brief delay
        setTimeout(() => {
          setCurrentScreen('results');
        }, 2000);

        return {
          ...prev,
          playerA: updatedA,
          playerB: updatedB,
          currentQuestionIndex: nextQuestionIndex,
          status: 'finished',
          winnerId,
          endedAt: Date.now(),
        };
      }

      // Move to next question after a delay
      setTimeout(() => {
        setCurrentMatch((m) => {
          if (!m) return m;
          return { ...m, currentQuestionIndex: nextQuestionIndex };
        });
      }, 2000);

      return {
        ...prev,
        playerA: updatedA,
        playerB: updatedB,
      };
    });
  }, [currentMatch, player]);

  const handleMatchEnd = useCallback(() => {
    setCurrentScreen('results');
  }, []);

  const handleNavigate = useCallback((screen: string) => {
    setCurrentScreen(screen as Screen);
  }, []);

  const handleMatchFound = useCallback((matchId: string) => {
    // Already handled in findMatch timeout
  }, []);

  const handleCancel = useCallback(() => {
    setCurrentScreen('home');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setCurrentMatch(null);
    handleFindMatch(selectedRole, wagerType);
  }, [selectedRole, wagerType, handleFindMatch]);

  const handleGoHome = useCallback(() => {
    setCurrentMatch(null);
    setCurrentScreen('home');
  }, []);

  const handleLeaderboardRoleChange = useCallback((role: UserRole) => {
    // In production, fetch from Firestore for this role
    // For now, mock data stays the same
  }, []);

  // ─── Screen Router ────────────────────────────────────
  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen
            player={player}
            onFindMatch={handleFindMatch}
            onNavigate={handleNavigate}
            dailyQuests={MOCK_DAILY_QUESTS}
          />
        );
      case 'matchmaking':
        return (
          <MatchmakingScreen
            role={selectedRole}
            playerRating={player.ratings[selectedRole] || DEFAULT_RATING}
            playerUsername={player.username}
            wagerType={wagerType}
            onMatchFound={handleMatchFound}
            onCancel={handleCancel}
          />
        );
      case 'battle':
        if (!currentMatch) return null;
        return (
          <BattleScreen
            match={currentMatch}
            currentPlayerId={player.id}
            onAnswer={handleAnswer}
            onMatchEnd={handleMatchEnd}
          />
        );
      case 'results':
        if (!currentMatch || !ratingResult) return null;
        return (
          <ResultsScreen
            match={currentMatch}
            currentPlayerId={player.id}
            ratingResult={ratingResult}
            xpEarned={xpEarned}
            onPlayAgain={handlePlayAgain}
            onGoHome={handleGoHome}
          />
        );
      case 'leaderboard':
        return (
          <LeaderboardScreen
            entries={leaderboardEntries}
            currentPlayerId={player.id}
            onNavigate={handleNavigate}
            onRoleChange={handleLeaderboardRoleChange}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            player={player}
            onNavigate={handleNavigate}
          />
        );
      default:
        return (
          <HomeScreen
            player={player}
            onFindMatch={handleFindMatch}
            onNavigate={handleNavigate}
            dailyQuests={MOCK_DAILY_QUESTS}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.bg} />
      {renderScreen()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
