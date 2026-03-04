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
import { getLeaderboard, persistMatchResult, updatePlayer } from './src/services/db/neon';
import { createEscrow, depositWager, resolveEscrow } from './src/services/wallet/escrow';
import { joinQueue, leaveQueue, pollForMatch, submitAnswerAndPoll, pollMatchState, finishLiveMatch } from './src/services/matchmaking/liveMatchmaking';

// ─── Screen Type ─────────────────────────────────────────
type Screen =
  | 'home'
  | 'matchmaking'
  | 'battle'
  | 'waiting'
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
  const localMatchRef = React.useRef<Match | null>(null);
  const [ratingResult, setRatingResult] = useState<any>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardCache, setLeaderboardCache] = useState<Record<string, LeaderboardEntry[]>>({});
  const [appReady, setAppReady] = useState(false);
  const matchSearchSession = React.useRef(0);
  const liveMatchId = React.useRef<string | null>(null);
  const pollTimerRef = React.useRef<any>(null);

  // Keep ref in sync to access inside closures without dependency arrays
  useEffect(() => {
    localMatchRef.current = currentMatch;
  }, [currentMatch]);

  // ─── Wallet → Auth bridge ─────────────────────────────
  useEffect(() => {
    if (wallet.connected && wallet.address) {
      authHook.signIn(wallet.address).then(() => {
        if (authHook.player?.primaryRole) {
          setSelectedRole(authHook.player.primaryRole);
        }
      }).catch((err) => {
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

  // Fetch leaderboard with caching and race condition prevention
  useEffect(() => {
    if (currentScreen === 'leaderboard' && authHook.player) {
      let isCancelled = false;
      const role = selectedRole;

      // 1. Instant cache hit for snappy switching
      if (leaderboardCache[role]) {
        setLeaderboardEntries(leaderboardCache[role]);
      } else {
        setLeaderboardEntries([]); // Only clear if we don't have it cached
      }
      
      getLeaderboard(role)
        .then((entries) => {
          if (isCancelled) return;
          
          const marked = entries.map((e: LeaderboardEntry) => ({
            ...e,
            isCurrentUser: String(e.playerId) === String(authHook.player?.id),
          }));

          setLeaderboardCache(prev => ({ ...prev, [role]: marked }));
          setLeaderboardEntries(marked);
        })
        .catch((err) => {
          if (!isCancelled) console.warn('[App] Leaderboard fetch failed:', err);
        });

      return () => { isCancelled = true; };
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
      
      const sessionId = ++matchSearchSession.current;
      setSelectedRole(role);
      setWagerType(wager);
      setCurrentMatch(null);
      liveMatchId.current = null;
      setCurrentScreen('matchmaking');

      const startSearch = async () => {
        // 1. Join the matchmaking queue
        const playerRating = authHook.player!.ratings[role] || DEFAULT_RATING;
        await joinQueue(
          authHook.player!.id,
          authHook.player!.username,
          playerRating,
          role,
          wager
        );

        if (sessionId !== matchSearchSession.current) return;

        // 2. Poll for opponent every 3 seconds (Neon-efficient)
        const poll = async () => {
          if (sessionId !== matchSearchSession.current) return; // Cancelled

          try {
            const result = await pollForMatch(authHook.player!.id, role, wager);

            if (sessionId !== matchSearchSession.current) return; // Cancelled during poll

            if (result.status === 'matched' && result.match) {
              // MATCH FOUND!
              liveMatchId.current = result.match.id;
              setCurrentMatch(result.match);

              // Show VS screen for 2.5 seconds
              await new Promise((r) => setTimeout(r, 2500));

              if (sessionId !== matchSearchSession.current) return;

              // Start battle
              setCurrentScreen('battle');
              return;
            }

            // Still searching — poll again in 3 seconds
            if (sessionId === matchSearchSession.current) {
              pollTimerRef.current = setTimeout(poll, 3000);
            }
          } catch (err) {
            console.warn('[App] Poll error:', err);
            // Retry in 5 seconds on error
            if (sessionId === matchSearchSession.current) {
              pollTimerRef.current = setTimeout(poll, 5000);
            }
          }
        };

        // Start first poll after 2 seconds (give opponent time to join)
        pollTimerRef.current = setTimeout(poll, 2000);
      };

      startSearch();
    },
    [authHook.player]
  );

  const handleAnswer = useCallback(
    (questionIndex: number, selectedOption: number, reactionTimeMs: number) => {
      if (!currentMatch || !authHook.player) return;

      const question = currentMatch.questions[questionIndex];
      const isCorrect = selectedOption === question.correctIndex;
      const isPlayerA = currentMatch.playerA.id === authHook.player.id;

      const playerAnswer = {
        questionIndex,
        selectedOption,
        isCorrect,
        reactionTimeMs,
        answeredAt: Date.now(),
      };

      const myAnswers = isPlayerA ? currentMatch.playerA.answers : currentMatch.playerB.answers;
      const myScore = isPlayerA ? currentMatch.playerA.score : currentMatch.playerB.score;
      
      const newAnswers = [...myAnswers, playerAnswer];
      const newScore = myScore + (isCorrect ? 1 : 0);

      // 1. Update LOCAL state immediately (BattleScreen shows result feedback)
      setCurrentMatch((prev) => {
        if (!prev) return prev;
        if (isPlayerA) {
          return {
            ...prev,
            playerA: {
              ...prev.playerA,
              answers: newAnswers,
              score: newScore,
            },
          };
        } else {
          return {
            ...prev,
            playerB: {
              ...prev.playerB,
              answers: newAnswers,
              score: newScore,
            },
          };
        }
      });

      // 2. Submit ALL answers to DB in background (FIRE-AND-FORGET — no blocking!)
      // By sending the entire array, we eliminate any chance of Postgres dropped updates
      if (liveMatchId.current) {
        submitAnswerAndPoll(liveMatchId.current, authHook.player.id, newAnswers, newScore)
          .catch(e => console.warn('[App] Answer submit failed:', e));
      }

      // 3. After 2s result display, advance to next question OR wait for opponent
      const nextIdx = questionIndex + 1;
      const isLast = nextIdx >= currentMatch.questions.length;

      setTimeout(() => {
        if (isLast) {
          // All questions done — switch to waiting screen
          setCurrentScreen('waiting');
          startWaitingForOpponent();
        } else {
          // Move to next question
          setCurrentMatch((m) =>
            m ? { ...m, currentQuestionIndex: nextIdx } : m
          );
        }
      }, 2000);
    },
    [currentMatch, authHook.player]
  );

  // Poll DB until opponent has also finished all questions, then show results
  const startWaitingForOpponent = useCallback(() => {
    if (!authHook.player || !liveMatchId.current) return;

    const playerId = authHook.player.id;
    const matchId = liveMatchId.current;

    const checkDone = async () => {
      try {
        const latestMatch = await pollMatchState(matchId);
        if (!latestMatch) return;

        const isPlayerA = latestMatch.playerA.id === playerId;
        const opponentAnswers = isPlayerA
          ? latestMatch.playerB.answers
          : latestMatch.playerA.answers;
        const myDbAnswers = isPlayerA
          ? latestMatch.playerA.answers
          : latestMatch.playerB.answers;
        const totalQ = latestMatch.questions.length;

        // EMERGENCY SYNC: In case of network drop, force sync our local answers to DB
        // We do this while waiting to ensure the opponent isn't stuck waiting for us forever.
        if (myDbAnswers.length < totalQ && localMatchRef.current) {
          const myLocalAnswers = isPlayerA 
            ? localMatchRef.current.playerA.answers 
            : localMatchRef.current.playerB.answers;
          
          if (myLocalAnswers.length > myDbAnswers.length) {
            // Re-submit the ENTIRE missing answers array to forcefully fix DB state
            console.log(`[App] Emergency syncing ${myLocalAnswers.length} answers to DB`);
            const myScore = isPlayerA ? localMatchRef.current.playerA.score : localMatchRef.current.playerB.score;
            await submitAnswerAndPoll(matchId, playerId, myLocalAnswers, myScore);
          }
        }

        if (opponentAnswers.length >= totalQ) {
          // BOTH DONE — calculate results
          const winnerId =
            latestMatch.playerA.score > latestMatch.playerB.score
              ? latestMatch.playerA.id
              : latestMatch.playerB.score > latestMatch.playerA.score
              ? latestMatch.playerB.id
              : undefined;

          const isWin = winnerId === playerId;
          const result = calculateMatchRatings(
            isWin ? latestMatch.playerA.rating : latestMatch.playerB.rating,
            isWin ? latestMatch.playerB.rating : latestMatch.playerA.rating
          );
          setRatingResult(result);

          const myAnswers = isPlayerA ? latestMatch.playerA.answers : latestMatch.playerB.answers;
          const correctCount = myAnswers.filter((a: any) => a.isCorrect).length;
          const avgReaction = myAnswers.length > 0
            ? myAnswers.reduce((sum: number, a: any) => sum + a.reactionTimeMs, 0) / myAnswers.length
            : 2000;

          const xp = calculateXP(
            isWin,
            wagerType === 'skr',
            correctCount,
            totalQ,
            avgReaction,
            authHook.player?.isSkrStaker || false,
            authHook.player?.currentStreak || 0
          );
          setXpEarned(xp);

          // Update match state with final data
          setCurrentMatch({
            ...latestMatch,
            status: 'finished',
            winnerId,
            endedAt: Date.now(),
          });

          // Finish live match in DB
          finishLiveMatch(matchId, winnerId).catch(console.warn);

          // Persist results
          persistMatchResult({
            match: { ...latestMatch, status: 'finished', winnerId, endedAt: Date.now() },
            currentPlayerId: playerId,
            role: selectedRole,
            ratingResult: result,
            xpEarned: xp,
            correctAnswers: correctCount,
            totalQuestions: totalQ,
            isWin,
            isDraw: winnerId === undefined,
            wagerType,
            winnerWalletAddress: wallet.address || undefined,
            authToken: wallet.authToken || undefined,
          }).then(() => authHook.refreshPlayer())
            .catch(e => console.warn('[App] Match persist failed:', e));

          // Show results
          setCurrentScreen('results');
        } else {
          // Opponent still playing — poll again in 2 seconds
          pollTimerRef.current = setTimeout(checkDone, 2000);
        }
      } catch (err) {
        console.warn('[App] Waiting poll error:', err);
        pollTimerRef.current = setTimeout(checkDone, 3000);
      }
    };

    // Start polling immediately
    checkDone();
  }, [authHook.player, selectedRole, wagerType, wallet.address, wallet.authToken]);

  const handleMatchEnd = useCallback(() => setCurrentScreen('results'), []);
  const handleNavigate = useCallback((s: string) => setCurrentScreen(s as Screen), []);
  const handleCancel = useCallback(() => {
    matchSearchSession.current = 0;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    // Remove from queue in DB
    if (authHook.player) {
      leaveQueue(authHook.player.id).catch(console.warn);
    }
    liveMatchId.current = null;
    setCurrentMatch(null);
    setCurrentScreen('home');
  }, [authHook.player]);

  const handlePlayAgain = useCallback(() => {
    setCurrentMatch(null);
    handleFindMatch(selectedRole, wagerType);
  }, [selectedRole, wagerType, handleFindMatch]);

  const handleGoHome = useCallback(() => {
    setCurrentMatch(null);
    setCurrentScreen('home');
  }, []);

  const handleLeaderboardRoleChange = useCallback((role: UserRole) => {
    setSelectedRole(role);
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
            match={currentMatch}
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
      case 'waiting':
        return (
          <View style={styles.waitingContainer}>
            <StatusBar style="light" backgroundColor={colors.bg} />
            <Text style={styles.waitingEmoji}>⏳</Text>
            <Text style={styles.waitingTitle}>Waiting for opponent...</Text>
            <Text style={styles.waitingSubtitle}>
              {currentMatch
                ? `${currentMatch.playerA.id === player.id
                    ? currentMatch.playerB.username
                    : currentMatch.playerA.username
                  } is still answering`
                : 'Calculating results...'}
            </Text>
            <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 24 }} />
            <Text style={styles.waitingHint}>Results will appear automatically</Text>
          </View>
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
            selectedRole={selectedRole}
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
            onUpdatePlayer={async (data) => {
              await updatePlayer(player.walletAddress, data);
              await authHook.refreshPlayer();
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
  waitingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
  },
  waitingEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  waitingSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
  waitingHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 32,
    opacity: 0.6,
  },
});
