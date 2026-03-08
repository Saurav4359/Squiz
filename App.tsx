import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, AppState, BackHandler, PanResponder, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ConnectWalletScreen from './src/screens/ConnectWalletScreen';
import HomeScreen from './src/screens/HomeScreen';
import BattleScreen from './src/screens/BattleScreen';
import MatchmakingScreen from './src/screens/MatchmakingScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MatchHistoryScreen from './src/screens/MatchHistoryScreen';
import DailyQuestsScreen from './src/screens/DailyQuestsScreen';
import DepositScreen from './src/screens/DepositScreen';

import { useWallet } from './src/hooks/useWallet';
import { useAuth } from './src/hooks/useAuth';
import { colors, fontSize, fontWeight, spacing } from './src/config/theme';
import { DEFAULT_RATING, QUESTIONS_PER_MATCH, SECONDS_ANSWER_PHASE } from './src/config/constants';
import { Player, Match, Question, DailyQuest, LeaderboardEntry } from './src/types';
import { calculateMatchRatings, calculateDrawRatings, calculateXP } from './src/services/matchmaking/ratingSystem';
import { getLeaderboard, persistMatchResult, updatePlayer, getPlayerById, updatePassword } from './src/services/db/database';
import {
  joinQueue,
  leaveQueue,
  joinMatchChannel,
  sendAnswer,
  sendMatchResult,
  leaveMatchChannel,
  finishLiveMatch,
} from './src/services/matchmaking/liveMatchmaking';
import type { MatchResult } from './src/services/matchmaking/liveMatchmaking';

import { joinLivePresence, leaveLivePresence } from './src/services/matchmaking/livePresence';

// ─── Screen Type ─────────────────────────────────────────
type Screen =
  | 'home'
  | 'matchmaking'
  | 'depositing'
  | 'battle'
  | 'waiting'
  | 'results'
  | 'leaderboard'
  | 'profile'
  | 'quests'
  | 'history';

export default function App() {
  // ─── Hooks ─────────────────────────────────────────────
  const wallet = useWallet();
  const authHook = useAuth();

  // ─── App State ─────────────────────────────────────────
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [wagerType, setWagerType] = useState<'sol' | 'skr'>('sol');
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const localMatchRef = React.useRef<Match | null>(null);
  const [ratingResult, setRatingResult] = useState<any>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [escrowState, setEscrowState] = useState<{
    status: string;
    playerADeposited: boolean;
    playerBDeposited: boolean;
  } | null>(null);
  const [depositing, setDepositing] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [viewedPlayer, setViewedPlayer] = useState<Player | null>(null);
  const [leaderboardCache, setLeaderboardCache] = useState<Record<string, LeaderboardEntry[]>>({});
  const [appReady, setAppReady] = useState(false);
  const matchSessionRef = React.useRef(0);
  const opponentFinishedRef = React.useRef(false);
  const opponentDataRef = React.useRef<{ answers: any[]; score: number } | null>(null);
  const isPlayerARef = React.useRef(false);
  const authoritativeResultRef = React.useRef<MatchResult | null>(null);
  const screenHistoryRef = React.useRef<Screen[]>(['home']);
  const isBackNavigationRef = React.useRef(false);

  // Keep ref in sync
  useEffect(() => {
    localMatchRef.current = currentMatch;
  }, [currentMatch]);

  useEffect(() => {
    if (isBackNavigationRef.current) {
      isBackNavigationRef.current = false;
      return;
    }
    const history = screenHistoryRef.current;
    if (history[history.length - 1] !== currentScreen) {
      history.push(currentScreen);
    }
  }, [currentScreen]);

  // ─── Wallet → Auth bridge ─────────────────────────────
  useEffect(() => {
    if (wallet.connected && wallet.address) {
      authHook.signIn(wallet.address).catch((err) => {
        console.error('[App] Auth sign-in failed:', err);
      });
    }
  }, [wallet.connected, wallet.address]);

  useEffect(() => {
    const playerId = authHook.player?.id;
    if (!playerId) return;

    joinLivePresence(playerId);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        joinLivePresence(playerId);
      } else {
        leaveLivePresence();
      }
    });

    return () => {
      subscription.remove();
      leaveLivePresence();
    };
  }, [authHook.player?.id]);

  // Daily open streak sync: updates once when user opens app on a new calendar day.
  useEffect(() => {
    const player = authHook.player;
    if (!player) return;

    let cancelled = false;

    const toDayStart = (ms: number) => {
      const d = new Date(ms);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };

    const syncDailyStreak = async () => {
      const now = Date.now();
      const todayStart = toDayStart(now);
      const lastActive = Number(player.lastActiveAt || 0);
      const lastActiveStart = lastActive > 0 ? toDayStart(lastActive) : 0;
      const currentStreak = Number(player.currentStreak || 0);

      // Safeguard: never keep streak at 0 or negative.
      if (currentStreak <= 0) {
        await updatePlayer(player.walletAddress, {
          currentStreak: 1,
          lastActiveAt: now,
        });
        if (!cancelled) {
          await authHook.refreshPlayer();
        }
        return;
      }

      // Already opened today; no streak mutation needed.
      if (lastActiveStart === todayStart) return;

      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
      const nextStreak =
        lastActiveStart === yesterdayStart
          ? Math.max(1, currentStreak + 1)
          : 1;

      await updatePlayer(player.walletAddress, {
        currentStreak: nextStreak,
        lastActiveAt: now,
      });

      if (!cancelled) {
        await authHook.refreshPlayer();
      }
    };

    syncDailyStreak().catch((err) => {
      console.warn('[App] Daily streak sync failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [authHook.player?.id, authHook.player?.lastActiveAt]);

  // App ready
  useEffect(() => {
    const timer = setTimeout(() => setAppReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Fetch leaderboard
  useEffect(() => {
    if (currentScreen !== 'leaderboard' || !authHook.player) return;

    let isCancelled = false;

    if (leaderboardCache['global']) {
      setLeaderboardEntries(leaderboardCache['global']);
    }

    getLeaderboard()
      .then((entries) => {
        if (isCancelled) return;
        const marked = entries.map((e: LeaderboardEntry) => ({
          ...e,
          isCurrentUser: String(e.playerId) === String(authHook.player?.id),
        }));
        setLeaderboardCache((prev) => ({ ...prev, global: marked }));
        setLeaderboardEntries(marked);
      })
      .catch((err) => {
        if (!isCancelled) console.warn('[App] Leaderboard fetch failed:', err);
      });

    return () => { isCancelled = true; };
  }, [currentScreen, authHook.player]);

  useEffect(() => {
    if (currentScreen !== 'depositing' || !currentMatch) return;

    let cancelled = false;

    // TODO: implement actual treasury check for deposits instead of simulated
    const syncEscrowState = async () => {
      if (!cancelled) {
        // Mock state: waiting for deposit
        setEscrowState({
          status: 'AwaitingDeposits',
          playerADeposited: false,
          playerBDeposited: false
        });
      }
    };

    syncEscrowState();
    const interval = setInterval(syncEscrowState, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentScreen, currentMatch?.id]);

  // ─── Handlers ──────────────────────────────────────────
  const handleWalletConnect = useCallback(async () => {
    await wallet.connect();
  }, [wallet]);


  const handleCreateProfile = useCallback(
    async (username: string, password?: string, twitter?: string) => {
      if (!wallet.address) return;
      await authHook.createProfile(wallet.address, username, password, twitter);
    },
    [wallet.address, authHook]
  );

  const handleLogin = useCallback(
    async (username: string, password: string) => {
      await authHook.login(username, password);
    },
    [authHook]
  );

  const handleUpdatePassword = useCallback(
    async (newPassword: string) => {
      if (!wallet.address) return;
      await updatePassword(wallet.address, newPassword);
      await authHook.refreshPlayer();
    },
    [wallet.address, authHook]
  );

  // ─── MATCHMAKING (Supabase Realtime) ──────────────────
  const handleFindMatch = useCallback(
    (wager: 'sol' | 'skr') => {
      if (!authHook.player) return;

      const sessionId = ++matchSessionRef.current;
      setWagerType(wager);
      setCurrentMatch(null);
      setRatingResult(null);
      setXpEarned(0);
      setEscrowState(null);
      setDepositing(false);
      opponentFinishedRef.current = false;
      opponentDataRef.current = null;
      isPlayerARef.current = false;
      authoritativeResultRef.current = null;
      setCurrentScreen('matchmaking');

      const playerRating = authHook.player.rating || DEFAULT_RATING;

      joinQueue(
        authHook.player.id,
        authHook.player.walletAddress,
        authHook.player.username,
        playerRating,
        wager,
        {
          onMatched: async (match) => {
            if (sessionId !== matchSessionRef.current) return;

            setCurrentMatch(match);
            isPlayerARef.current = match.playerA.id === authHook.player!.id;

            // Join the match realtime channel for answer sync
            joinMatchChannel(match.id, authHook.player!.id, {
              onMatchResult: (result) => {
                authoritativeResultRef.current = result;
              },
              onOpponentAnswer: (data) => {
                opponentDataRef.current = data;
                setCurrentMatch((prev) => {
                  if (!prev) return prev;
                  const isPlayerA = prev.playerA.id === authHook.player!.id;
                  if (isPlayerA) {
                    return {
                      ...prev,
                      playerB: { ...prev.playerB, answers: data.answers, score: data.score },
                    };
                  } else {
                    return {
                      ...prev,
                      playerA: { ...prev.playerA, answers: data.answers, score: data.score },
                    };
                  }
                });
              },
              onOpponentFinished: () => {
                opponentFinishedRef.current = true;
              },
            });

            if (match.playerA.id === authHook.player!.id) {
              // Wait before transitioning to depositing screen
              setTimeout(() => {
                if (sessionId !== matchSessionRef.current) return;
                setCurrentScreen('depositing');
              }, 2500);
            } else {
              // For playerB
              setTimeout(() => {
                if (sessionId !== matchSessionRef.current) return;
                setCurrentScreen('depositing');
              }, 2500);
            }
          },
          onError: (err) => {
            console.warn('[App] Matchmaking error:', err);
          },
        }
      );
    },
    [authHook.player]
  );

  // ─── ANSWER HANDLING ──────────────────────────────────
  const handleAnswer = useCallback(
    (questionIndex: number, selectedOption: number, reactionTimeMs: number) => {
      if (!currentMatch || !authHook.player) return;

      const isPlayerA = currentMatch.playerA.id === authHook.player.id;
      const myCurrentAnswers = isPlayerA
        ? currentMatch.playerA.answers
        : currentMatch.playerB.answers;

      // Guard: don't double-record
      if (myCurrentAnswers.some((a: any) => a.questionIndex === questionIndex)) return;

      const question = currentMatch.questions[questionIndex];
      const isCorrect = selectedOption === question.correctIndex;

      const playerAnswer = {
        questionIndex,
        selectedOption,
        isCorrect,
        reactionTimeMs,
        answeredAt: Date.now(),
      };

      // Calculate points
      let points = 0;
      if (isCorrect) {
        const seconds = reactionTimeMs / 1000;
        if (seconds <= 4) points = 100;
        else if (seconds <= 8) points = 80;
        else points = 60;
      }

      const newAnswers = [...myCurrentAnswers, playerAnswer];
      const myScore = (isPlayerA ? currentMatch.playerA.score : currentMatch.playerB.score) + points;

      // 1. Update LOCAL state immediately
      setCurrentMatch((prev) => {
        if (!prev) return prev;
        if (isPlayerA) {
          return {
            ...prev,
            playerA: { ...prev.playerA, answers: newAnswers, score: myScore },
          };
        } else {
          return {
            ...prev,
            playerB: { ...prev.playerB, answers: newAnswers, score: myScore },
          };
        }
      });

      // 2. Broadcast answer to opponent via realtime
      sendAnswer(currentMatch.id, authHook.player.id, newAnswers, myScore);

      // 3. After 2s feedback, advance or finish
      const nextIdx = questionIndex + 1;
      const isLast = nextIdx >= currentMatch.questions.length;

      setTimeout(() => {
        if (isLast) {
          handleMatchFinished();
        } else {
          setCurrentMatch((m) =>
            m ? { ...m, currentQuestionIndex: nextIdx } : m
          );
        }
      }, 2000);
    },
    [currentMatch, authHook.player]
  );

  // ─── MATCH FINISHED LOGIC ─────────────────────────────
  const handleMatchFinished = useCallback(() => {
    if (!authHook.player) return;

    const isAuthority = isPlayerARef.current;

    if (isAuthority) {
      // PlayerA: wait for opponent to finish, then compute + broadcast
      if (opponentFinishedRef.current) {
        computeResultsAsAuthority();
        return;
      }

      setCurrentScreen('waiting');

      const timeout = setTimeout(() => {
        console.warn('[App] Opponent timeout — playerA forcing results');
        computeResultsAsAuthority();
      }, 90000);

      const check = setInterval(() => {
        if (opponentFinishedRef.current) {
          clearInterval(check);
          clearTimeout(timeout);
          computeResultsAsAuthority();
        }
      }, 500);

      return () => { clearInterval(check); clearTimeout(timeout); };
    } else {
      // PlayerB: wait for authoritative result from playerA
      if (authoritativeResultRef.current) {
        applyAuthoritativeResult(authoritativeResultRef.current);
        return;
      }

      setCurrentScreen('waiting');

      const timeout = setTimeout(() => {
        console.warn('[App] PlayerA result timeout — playerB computing locally as fallback');
        computeResultsFallback();
      }, 90000);

      const check = setInterval(() => {
        if (authoritativeResultRef.current) {
          clearInterval(check);
          clearTimeout(timeout);
          applyAuthoritativeResult(authoritativeResultRef.current);
        }
      }, 500);

      return () => { clearInterval(check); clearTimeout(timeout); };
    }
  }, [authHook.player]);

  // Helper: compute ratings and XP from match state
  const computeRatingsAndXP = useCallback((match: Match, winnerId: string | undefined) => {
    const playerId = authHook.player!.id;
    const effectiveWagerType = match.wagerType || wagerType;
    const isSkrMatch = effectiveWagerType === 'skr';
    const isPlayerA = match.playerA.id === playerId;
    const isWin = winnerId === playerId;
    const isDraw = winnerId === undefined;

    let rResult;
    if (isDraw) {
      const drawResult = calculateDrawRatings(match.playerA.rating, match.playerB.rating);
      rResult = {
        winnerNewRating: drawResult.newRatingA,
        loserNewRating: drawResult.newRatingB,
        winnerDelta: drawResult.deltaA,
        loserDelta: drawResult.deltaB,
      };
    } else {
      const winnerRating = winnerId === match.playerA.id ? match.playerA.rating : match.playerB.rating;
      const loserRating = winnerId === match.playerA.id ? match.playerB.rating : match.playerA.rating;
      rResult = calculateMatchRatings(winnerRating, loserRating);
    }

    const myAnswers = isPlayerA ? match.playerA.answers : match.playerB.answers;
    const correctCount = myAnswers.filter((a: any) => a.isCorrect).length;
    const totalQ = match.questions.length;
    const avgReaction = myAnswers.length > 0
      ? myAnswers.reduce((sum: number, a: any) => sum + a.reactionTimeMs, 0) / myAnswers.length
      : 2000;

    const xp = calculateXP(
      isWin,
      isSkrMatch,
      correctCount,
      totalQ,
      avgReaction,
      authHook.player?.isSkrStaker || false,
      authHook.player?.currentStreak || 0
    );

    // Also compute opponent XP (for DB persistence by authority)
    const oppAnswers = isPlayerA ? match.playerB.answers : match.playerA.answers;
    const oppCorrectCount = oppAnswers.filter((a: any) => a.isCorrect).length;
    const oppXp = calculateXP(
      !isWin && !isDraw,
      isSkrMatch,
      oppCorrectCount,
      totalQ,
      0,
      false,
      0
    );

    return { rResult, xp, oppXp, isWin, isDraw, correctCount, totalQ, effectiveWagerType };
  }, [authHook.player, wagerType]);

  const settleMatchEscrow = useCallback(async (
    match: Match,
    winnerId: string | undefined,
    effectiveWagerType: 'sol' | 'skr',
  ) => {
    // Escrow logic removed as we use treasury-wallet payout pattern.
    // The backend will handle transferring the pot.
  }, []);

  // PlayerA: compute results, broadcast to playerB, persist to DB
  const computeResultsAsAuthority = useCallback(() => {
    const match = localMatchRef.current;
    if (!match || !authHook.player) return;

    const myScore = match.playerA.score;
    const oppScore = match.playerB.score;

    const winnerId =
      myScore > oppScore ? match.playerA.id
      : oppScore > myScore ? match.playerB.id
      : undefined;

    const { rResult, xp, oppXp, isWin, isDraw, effectiveWagerType } = computeRatingsAndXP(match, winnerId);

    // Broadcast authoritative result to playerB
    const matchResult: MatchResult = {
      winnerId,
      playerAScore: myScore,
      playerBScore: oppScore,
      ratingResult: rResult,
    };
    sendMatchResult(matchResult);

    setRatingResult(rResult);
    setXpEarned(xp);

    const finishedMatch = {
      ...match,
      status: 'finished' as const,
      winnerId,
      endedAt: Date.now(),
    };
    setCurrentMatch(finishedMatch);

    // Persist both players' stats (only playerA does this)
    finishLiveMatch(match.id, winnerId);
    persistMatchResult({
      match: finishedMatch,
      currentPlayerId: match.playerA.id,
      opponentPlayerId: match.playerB.id,
      ratingResult: rResult,
      xpEarned: xp,
      opponentXpEarned: oppXp,
      isWin,
      isDraw,
      wagerType: effectiveWagerType,
    })
      .then(() => authHook.refreshPlayer())
      .catch((e) => console.warn('[App] Match persist failed:', e));

    settleMatchEscrow(finishedMatch, winnerId, effectiveWagerType)
      .catch((e) => console.warn('[App] Escrow settlement failed:', e));

    leaveMatchChannel();
    setCurrentScreen('results');
  }, [authHook.player, wagerType, computeRatingsAndXP, settleMatchEscrow]);

  // PlayerB: apply authoritative result from playerA (no DB persist)
  const applyAuthoritativeResult = useCallback((result: MatchResult) => {
    const match = localMatchRef.current;
    if (!match || !authHook.player) return;

    const { winnerId, playerAScore, playerBScore, ratingResult: rResult } = result;

    // Use authoritative scores
    const finishedMatch = {
      ...match,
      playerA: { ...match.playerA, score: playerAScore },
      playerB: { ...match.playerB, score: playerBScore },
      status: 'finished' as const,
      winnerId,
      endedAt: Date.now(),
    };

    const isWin = winnerId === authHook.player.id;
    const myAnswers = match.playerB.id === authHook.player.id ? match.playerB.answers : match.playerA.answers;
    const correctCount = myAnswers.filter((a: any) => a.isCorrect).length;
    const totalQ = match.questions.length;
    const avgReaction = myAnswers.length > 0
      ? myAnswers.reduce((sum: number, a: any) => sum + a.reactionTimeMs, 0) / myAnswers.length
      : 2000;

    const effectiveWagerType = match.wagerType || wagerType;
    const xp = calculateXP(
      isWin,
      effectiveWagerType === 'skr',
      correctCount,
      totalQ,
      avgReaction,
      authHook.player?.isSkrStaker || false,
      authHook.player?.currentStreak || 0
    );

    setRatingResult(rResult);
    setXpEarned(xp);
    setCurrentMatch(finishedMatch);

    // PlayerB does NOT persist — playerA already did
    // Just refresh local player data after a short delay
    setTimeout(() => authHook.refreshPlayer(), 2000);

    leaveMatchChannel();
    setCurrentScreen('results');
  }, [authHook.player, wagerType]);

  // Fallback: playerB computes locally if playerA never sends result
  const computeResultsFallback = useCallback(() => {
    const match = localMatchRef.current;
    if (!match || !authHook.player) return;

    const isPlayerA = match.playerA.id === authHook.player.id;
    const myScore = isPlayerA ? match.playerA.score : match.playerB.score;
    const oppScore = isPlayerA ? match.playerB.score : match.playerA.score;

    const winnerId =
      myScore > oppScore ? authHook.player.id
      : oppScore > myScore ? (isPlayerA ? match.playerB.id : match.playerA.id)
      : undefined;

    const { rResult, xp, oppXp, isWin, isDraw, effectiveWagerType } = computeRatingsAndXP(match, winnerId);

    setRatingResult(rResult);
    setXpEarned(xp);

    const finishedMatch = {
      ...match,
      status: 'finished' as const,
      winnerId,
      endedAt: Date.now(),
    };
    setCurrentMatch(finishedMatch);

    // Fallback: persist as before (single player)
    finishLiveMatch(match.id, winnerId);
    persistMatchResult({
      match: finishedMatch,
      currentPlayerId: authHook.player.id,
      opponentPlayerId: isPlayerA ? match.playerB.id : match.playerA.id,
      ratingResult: rResult,
      xpEarned: xp,
      opponentXpEarned: oppXp,
      isWin,
      isDraw,
      wagerType: effectiveWagerType,
    })
      .then(() => authHook.refreshPlayer())
      .catch((e) => console.warn('[App] Match persist failed:', e));

    settleMatchEscrow(finishedMatch, winnerId, effectiveWagerType)
      .catch((e) => console.warn('[App] Escrow settlement failed:', e));

    leaveMatchChannel();
    setCurrentScreen('results');
  }, [authHook.player, wagerType, computeRatingsAndXP, settleMatchEscrow]);

  const handleMatchEnd = useCallback(() => setCurrentScreen('results'), []);
  const handleNavigate = useCallback((s: string) => setCurrentScreen(s as Screen), []);

  const handleCancel = useCallback(() => {
    matchSessionRef.current++;
    if (authHook.player) {
      leaveQueue(authHook.player.id);
    }
    leaveMatchChannel();
    setCurrentMatch(null);
    setEscrowState(null);
    setDepositing(false);
    setCurrentScreen('home');
  }, [authHook.player]);

  const handleBackNavigation = useCallback((): boolean => {
    if (!authHook.player) return false;

    if (currentScreen === 'matchmaking' || currentScreen === 'depositing') {
      handleCancel();
      return true;
    }

    const history = screenHistoryRef.current;
    if (history.length <= 1) return false;

    history.pop();
    const previous = history[history.length - 1] || 'home';
    isBackNavigationRef.current = true;
    if (previous !== 'profile') {
      setViewedPlayer(null);
    }
    setCurrentScreen(previous);
    return true;
  }, [authHook.player, currentScreen, handleCancel]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      return handleBackNavigation();
    });
    return () => sub.remove();
  }, [handleBackNavigation]);

  const swipeBackResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);
          return absDx > 30 && absDx > absDy * 1.2;
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (Math.abs(gestureState.dx) >= 90) {
            handleBackNavigation();
          }
        },
      }),
    [handleBackNavigation]
  );

  const handlePlayAgain = useCallback(() => {
    setCurrentMatch(null);
    handleFindMatch(wagerType);
  }, [wagerType, handleFindMatch]);

  const handleGoHome = useCallback(() => {
    setCurrentMatch(null);
    setCurrentScreen('home');
  }, []);

  // ─── DEPOSIT HANDLERS ──────────────────────────────────
  const handleDeposit = useCallback(async (): Promise<boolean> => {
    if (!currentMatch || !authHook.player) return false;
    setDepositing(true);
    
    // Simulate transaction delay
    await new Promise(r => setTimeout(r, 1500));
    
    setDepositing(false);
    
    // Mock successful deposit update
    setEscrowState(prev => {
      const isPlayerA = currentMatch.playerA.id === authHook.player?.id;
      return {
        status: prev?.status || 'AwaitingDeposits',
        playerADeposited: isPlayerA ? true : !!prev?.playerADeposited,
        playerBDeposited: !isPlayerA ? true : !!prev?.playerBDeposited,
      };
    });
    
    return true;
  }, [currentMatch, authHook.player]);

  const handleBothDeposited = useCallback(() => {
    setCurrentMatch((prev) =>
      prev
        ? {
            ...prev,
            status: 'in_progress',
            startedAt: prev.startedAt || Date.now(),
          }
        : prev
    );
    setCurrentScreen('battle');
  }, []);

  const handleDepositTimeout = useCallback(() => {
    console.warn('[App] Deposit timeout — cancelling match');
    handleCancel();
  }, [handleCancel]);

  const handleRefreshLeaderboard = useCallback(() => {
    if (authHook.player) {
      getLeaderboard()
        .then((entries) => {
          const marked = entries.map((e: LeaderboardEntry) => ({
            ...e,
            isCurrentUser: String(e.playerId) === String(authHook.player?.id),
          }));
          setLeaderboardCache((prev) => ({ ...prev, global: marked }));
          setLeaderboardEntries(marked);
        })
        .catch((err) => console.warn('[App] Leaderboard refresh failed:', err));
    }
  }, [authHook.player]);

  const handleViewProfile = useCallback(async (playerId: string) => {
    if (authHook.player && playerId === authHook.player.id) {
      setViewedPlayer(null);
      setCurrentScreen('profile');
      return;
    }
    try {
      const p = await getPlayerById(playerId);
      if (p) {
        setViewedPlayer(p);
        setCurrentScreen('profile');
      }
    } catch (err) {
      console.warn('[App] Failed to fetch viewed player:', err);
    }
  }, [authHook.player]);

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
          onCreateProfile={handleCreateProfile}
          onLogin={handleLogin}
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
            playerRating={player.rating || DEFAULT_RATING}
            playerUsername={player.username}
            wagerType={wagerType}
            onMatchFound={() => {}}
            onCancel={handleCancel}
            match={currentMatch}
          />
        );
      case 'depositing': {
        if (!currentMatch) return null;
        const isPlayerAInEscrow = currentMatch.playerA.id === player.id;
        return (
          <DepositScreen
            match={currentMatch}
            currentPlayerId={player.id}
            wagerType={wagerType}
            myDeposited={isPlayerAInEscrow ? !!escrowState?.playerADeposited : !!escrowState?.playerBDeposited}
            opponentDeposited={isPlayerAInEscrow ? !!escrowState?.playerBDeposited : !!escrowState?.playerADeposited}
            depositing={depositing}
            onDeposited={handleDeposit}
            onBothDeposited={handleBothDeposited}
            onTimeout={handleDepositTimeout}
            onCancel={handleCancel}
          />
        );
      }
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
            <Text style={styles.waitingEmoji}>...</Text>
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
        if (!currentMatch || !ratingResult) {
          return (
            <View style={styles.waitingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.waitingHint}>Computing results...</Text>
            </View>
          );
        }
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
            onViewProfile={handleViewProfile}
            onRefresh={handleRefreshLeaderboard}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            player={viewedPlayer || player}
            onNavigate={(s) => {
              setViewedPlayer(null);
              handleNavigate(s);
            }}
            walletBalance={viewedPlayer ? undefined : wallet.balance}
            onDisconnect={viewedPlayer ? undefined : async () => {
              await wallet.disconnect();
              authHook.signOut();
            }}
            onUpdatePlayer={viewedPlayer ? undefined : async (data) => {
              await updatePlayer(player.walletAddress, data);
              await authHook.refreshPlayer();
            }}
            onUpdatePassword={viewedPlayer ? undefined : handleUpdatePassword}
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

  const renderBottomNav = () => {
    const mainScreens = ['home', 'leaderboard', 'quests', 'history', 'profile'];
    if (!authHook.player || !mainScreens.includes(currentScreen)) return null;

    const tabs: Array<{
      key: Screen;
      label: string;
      icon: keyof typeof Ionicons.glyphMap;
      onPress: () => void;
      isActive: boolean;
    }> = [
      {
        key: 'home',
        label: 'Home',
        icon: 'home-outline',
        onPress: () => { setViewedPlayer(null); handleNavigate('home'); },
        isActive: currentScreen === 'home',
      },
      {
        key: 'leaderboard',
        label: 'Ranks',
        icon: 'trophy-outline',
        onPress: () => { setViewedPlayer(null); handleNavigate('leaderboard'); },
        isActive: currentScreen === 'leaderboard',
      },
      {
        key: 'quests',
        label: 'Quests',
        icon: 'flash-outline',
        onPress: () => { setViewedPlayer(null); handleNavigate('quests'); },
        isActive: currentScreen === 'quests',
      },
      {
        key: 'history',
        label: 'History',
        icon: 'time-outline',
        onPress: () => { setViewedPlayer(null); handleNavigate('history'); },
        isActive: currentScreen === 'history',
      },
      {
        key: 'profile',
        label: 'Profile',
        icon: 'person-outline',
        onPress: () => { setViewedPlayer(null); handleNavigate('profile'); },
        isActive: currentScreen === 'profile' && !viewedPlayer,
      },
    ];

    return (
      <View style={styles.bottomNav}>
        {tabs.map((tab) => {
          const color = tab.isActive ? colors.primary : colors.textSecondary;
          return (
            <TouchableOpacity key={tab.key} style={styles.navItem} onPress={tab.onPress} activeOpacity={0.8}>
              <Ionicons name={tab.icon} size={22} color={color} />
              <Text style={[styles.navLabel, tab.isActive && styles.navActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container} {...swipeBackResponder.panHandlers}>
      <StatusBar style="light" backgroundColor={colors.bg} />
      {renderScreen()}
      {renderBottomNav()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    height: 62,
    borderRadius: 32,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    borderRadius: 20,
  },
  navLabel: {
    fontSize: 12,
    marginTop: 3,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  navActive: {
    color: colors.primary,
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
