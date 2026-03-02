import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';

import ConnectWalletScreen from './src/screens/ConnectWalletScreen';
import HomeScreen from './src/screens/HomeScreen';
import BattleScreen from './src/screens/BattleScreen';
import MatchmakingScreen from './src/screens/MatchmakingScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MatchHistoryScreen from './src/screens/MatchHistoryScreen';
import DailyQuestsScreen from './src/screens/DailyQuestsScreen';

import { useWallet } from './src/hooks/useWallet';
import { useAuth } from './src/hooks/useAuth';
import { colors, fontSize, fontWeight, spacing } from './src/config/theme';
import { DEFAULT_RATING, ROLES, UserRole, QUESTIONS_PER_MATCH } from './src/config/constants';
import { Player, Match, Question, DailyQuest, LeaderboardEntry } from './src/types';
import { calculateMatchRatings, calculateXP } from './src/services/matchmaking/ratingSystem';
import { generateQuestionsFromNews, fetchLatestNews, generateFallbackQuestions } from './src/services/ai/questionGenerator';
import { filterSeenQuestions, markQuestionsAsSeen } from './src/services/ai/antiCheat';
import { getLeaderboard, persistMatchResult } from './src/services/db/neon';
import { createEscrow, depositWager, resolveEscrow } from './src/services/wallet/escrow';

// ─── Screen Type ─────────────────────────────────────────
type Screen =
  | 'home'
  | 'matchmaking'
  | 'battle'
  | 'results'
  | 'leaderboard'
  | 'profile'
  | 'quests'
  | 'history';

// ─── Fallback handling moved to ai service ──────────────

export default function App() {
  // ─── Hooks ─────────────────────────────────────────────
  const wallet = useWallet();
  const authHook = useAuth();

  // ─── App State ─────────────────────────────────────────
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Trader');
  const [wagerType, setWagerType] = useState<'sol' | 'skr'>('sol');
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [ratingResult, setRatingResult] = useState<any>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [appReady, setAppReady] = useState(false);

  // ─── Wallet → Auth bridge ─────────────────────────────
  useEffect(() => {
    if (wallet.connected && wallet.address) {
      authHook.signIn(wallet.address).catch((err) => {
        console.error('[App] Auth sign-in failed:', err);
      });
    }
  }, [wallet.connected, wallet.address]);

  // App is ready once wallet hook has finished restoring
  useEffect(() => {
    // Small delay to let restore finish
    const timer = setTimeout(() => setAppReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Fetch leaderboard when entering that screen
  useEffect(() => {
    if (currentScreen === 'leaderboard' && authHook.player) {
      getLeaderboard(selectedRole)
        .then((entries) => {
          // Mark current user
          const marked = entries.map((e) => ({
            ...e,
            isCurrentUser: e.playerId === authHook.player?.id,
          }));
          setLeaderboardEntries(marked);
        })
        .catch((err) => {
          console.warn('[App] Leaderboard fetch failed:', err);
        });
    }
  }, [currentScreen, selectedRole]);

  // ─── Handlers ──────────────────────────────────────────
  const handleWalletConnect = useCallback(async () => {
    await wallet.connect();
  }, [wallet]);

  const handleDevConnect = useCallback(async () => {
    await wallet.devConnect();
  }, [wallet]);

  const handlePhantomConnect = useCallback(async () => {
    await wallet.connectPhantomWallet();
  }, [wallet]);

  const handleCreateProfile = useCallback(
    async (username: string, role: UserRole) => {
      if (!wallet.address) return;
      await authHook.createProfile(wallet.address, username, role);
    },
    [wallet.address, authHook]
  );

  const handleFindMatch = useCallback(
    (role: UserRole, wager: 'sol' | 'skr') => {
      if (!authHook.player) return;
      setSelectedRole(role);
      setWagerType(wager);
      setCurrentScreen('matchmaking');

      // Fetch AI questions + simulate matchmaking in parallel
      const startMatch = async () => {
        // Start with a randomized selection of UNSEEN fallbacks immediately
        let questions: Question[] = (await filterSeenQuestions(generateFallbackQuestions(role, 20))).slice(0, QUESTIONS_PER_MATCH);

        // If we ran out of unique fallbacks (unlikely), generate some anyway to avoid empty match
        if (questions.length < QUESTIONS_PER_MATCH) {
          questions = generateFallbackQuestions(role, QUESTIONS_PER_MATCH);
        }

        try {
          const news = await fetchLatestNews();
          // Ask for more than needed so we have room to filter seen ones
          let aiQuestions = await generateQuestionsFromNews(news, role, QUESTIONS_PER_MATCH * 2);
          aiQuestions = await filterSeenQuestions(aiQuestions);

          if (aiQuestions.length >= QUESTIONS_PER_MATCH) {
            questions = aiQuestions.slice(0, QUESTIONS_PER_MATCH);
          } else if (aiQuestions.length > 0) {
            // Mix unique news with unique fallbacks
            const uniqueFallbacks = await filterSeenQuestions(generateFallbackQuestions(role, 20));
            questions = [...aiQuestions, ...uniqueFallbacks].slice(0, QUESTIONS_PER_MATCH);
          }
        } catch (err) {
          console.warn('[App] AI question gen failed, using existing fallbacks:', err);
        }

        // Mark these as seen so they never appear again for this user
        await markQuestionsAsSeen(questions);

        // Ensure minimum matchmaking time for UX
        await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));

        const playerRating = authHook.player!.ratings[role] || DEFAULT_RATING;
        const opponentRating = playerRating + Math.floor(Math.random() * 200 - 100);

        const matchId = `match_${Date.now()}`;
        const match: Match = {
          id: matchId,
          playerA: {
            id: authHook.player!.id,
            username: authHook.player!.username,
            rating: playerRating,
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
          questions,
          currentQuestionIndex: 0,
          wagerLamports: 50000000,
          status: 'in_progress',
          createdAt: Date.now(),
          startedAt: Date.now(),
        };

        // Create escrow and deposit (fire-and-forget — doesn't block match start)
        createEscrow(matchId, authHook.player!.id, 'bot_opponent', wager)
          .then(() => depositWager(
            matchId,
            authHook.player!.id,
            wallet.address || '',
            wallet.authToken || 'dev_token',
            wager
          ))
          .catch(e => console.warn('[App] Escrow setup failed:', e));

        setCurrentMatch(match);
        setCurrentScreen('battle');
      };

      startMatch();
    },
    [authHook.player]
  );

  const handleAnswer = useCallback(
    (questionIndex: number, selectedOption: number, reactionTimeMs: number) => {
      if (!currentMatch || !authHook.player) return;

      const question = currentMatch.questions[questionIndex];
      const isCorrect = selectedOption === question.correctIndex;

      const playerAnswer = {
        questionIndex,
        selectedOption,
        isCorrect,
        reactionTimeMs,
        answeredAt: Date.now(),
      };

      const botCorrect = Math.random() > 0.4;
      const botAnswer = {
        questionIndex,
        selectedOption: botCorrect
          ? question.correctIndex
          : (question.correctIndex + 1) % 4,
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

        const nextIdx = prev.currentQuestionIndex + 1;
        const isLast = nextIdx >= prev.questions.length;

        if (isLast) {
          const winnerId =
            updatedA.score > updatedB.score
              ? updatedA.id
              : updatedB.score > updatedA.score
              ? updatedB.id
              : undefined;

          const isWin = winnerId === authHook.player?.id;
          const result = calculateMatchRatings(
            isWin ? updatedA.rating : updatedB.rating,
            isWin ? updatedB.rating : updatedA.rating
          );
          setRatingResult(result);

          const correctCount = updatedA.answers.filter((a) => a.isCorrect).length;
          const avgReaction =
            updatedA.answers.reduce((sum, a) => sum + a.reactionTimeMs, 0) /
            updatedA.answers.length;
          const xp = calculateXP(
            isWin,
            correctCount,
            prev.questions.length,
            avgReaction,
            authHook.player?.isSkrStaker || false,
            authHook.player?.currentStreak || 0
          );
          setXpEarned(xp);

          const finalMatch = {
            ...prev,
            playerA: updatedA,
            playerB: updatedB,
            currentQuestionIndex: prev.currentQuestionIndex, // Keep on last question to show feedback
            status: 'finished' as const,
            winnerId,
            endedAt: Date.now(),
          };

          // Persist to Firestore asynchronously — doesn't block UI
          persistMatchResult({
            match: finalMatch,
            currentPlayerId: authHook.player!.id,
            role: selectedRole,
            ratingResult: result,
            xpEarned: xp,
            correctAnswers: correctCount,
            totalQuestions: prev.questions.length,
            isWin,
            isDraw: winnerId === undefined,
            wagerType,
            winnerWalletAddress: wallet.address || undefined,
            authToken: wallet.authToken || undefined,
          }).then(() => authHook.refreshPlayer())
            .catch(e => console.warn('[App] Match persist failed:', e));

          setTimeout(() => setCurrentScreen('results'), 3000);
          return finalMatch;
        }


        setTimeout(() => {
          setCurrentMatch((m) =>
            m ? { ...m, currentQuestionIndex: nextIdx } : m
          );
        }, 2000);

        return { ...prev, playerA: updatedA, playerB: updatedB };
      });
    },
    [currentMatch, authHook.player]
  );

  const handleMatchEnd = useCallback(() => setCurrentScreen('results'), []);
  const handleNavigate = useCallback((s: string) => setCurrentScreen(s as Screen), []);
  const handleCancel = useCallback(() => setCurrentScreen('home'), []);

  const handlePlayAgain = useCallback(() => {
    setCurrentMatch(null);
    handleFindMatch(selectedRole, wagerType);
  }, [selectedRole, wagerType, handleFindMatch]);

  const handleGoHome = useCallback(() => {
    setCurrentMatch(null);
    setCurrentScreen('home');
  }, []);

  const handleLeaderboardRoleChange = useCallback((_role: UserRole) => {
    // Will trigger the useEffect for leaderboard refetch
  }, []);

  // ─── Loading splash ────────────────────────────────────
  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" backgroundColor={colors.bg} />
        <Text style={styles.loadingLogo}>SR</Text>
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // ─── Auth Gate ─────────────────────────────────────────
  if (!wallet.connected || authHook.isNewUser || !authHook.player) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor={colors.bg} />
        <ConnectWalletScreen
          onConnect={handleWalletConnect}
          onPhantomConnect={handlePhantomConnect}
          onDevConnect={handleDevConnect}
          onCreateProfile={handleCreateProfile}
          connecting={wallet.connecting}
          isNewUser={authHook.isNewUser}
          walletAddress={wallet.address}
          shortAddress={wallet.shortAddress}
          error={wallet.error || authHook.error}
          loading={wallet.connecting || authHook.loading}
        />
      </View>
    );
  }

  // ─── Authenticated App ─────────────────────────────────
  const player = authHook.player;

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen
            player={player}
            onFindMatch={handleFindMatch}
            onNavigate={handleNavigate}
            dailyQuests={authHook.dailyQuests}
          />
        );
      case 'matchmaking':
        return (
          <MatchmakingScreen
            role={selectedRole}
            playerRating={player.ratings[selectedRole] || DEFAULT_RATING}
            playerUsername={player.username}
            wagerType={wagerType}
            onMatchFound={() => {}}
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
            walletBalance={wallet.balance}
            onDisconnect={async () => {
              await wallet.disconnect();
              authHook.signOut();
            }}
          />
        );
      case 'history':
        return (
          <MatchHistoryScreen
            playerId={player.id}
            onNavigate={handleNavigate}
          />
        );
      case 'quests':
        return (
          <DailyQuestsScreen
            quests={authHook.dailyQuests}
            onNavigate={handleNavigate}
          />
        );
      default:
        return (
          <HomeScreen
            player={player}
            onFindMatch={handleFindMatch}
            onNavigate={handleNavigate}
            dailyQuests={authHook.dailyQuests}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 48,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: 4,
  },
});
