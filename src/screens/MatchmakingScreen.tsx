import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { DEFAULT_WAGER_SOL, SKR_WAGER_BASE_UNITS } from '../config/constants';

interface MatchmakingScreenProps {
  playerRating: number;
  playerUsername: string;
  wagerType: 'sol' | 'skr';
  onMatchFound: (matchId: string) => void;
  onCancel: () => void;
  match?: any;
}

export default function MatchmakingScreen({
  playerRating,
  playerUsername,
  wagerType,
  onMatchFound,
  onCancel,
  match,
}: MatchmakingScreenProps) {
  const [statusText, setStatusText] = useState('Searching for opponent...');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const leftCoinX = useRef(new Animated.Value(-64)).current;
  const leftCoinY = useRef(new Animated.Value(-8)).current;
  const rightCoinX = useRef(new Animated.Value(64)).current;
  const rightCoinY = useRef(new Animated.Value(-8)).current;
  const matchCoinOpacity = useRef(new Animated.Value(0)).current;
  const potScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotate animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Ring ripple animations
    const startRing = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startRing(ring1, 0);
    startRing(ring2, 700);
    startRing(ring3, 1400);
  }, []);

  useEffect(() => {
    if (!match) return;
    leftCoinX.setValue(-64);
    leftCoinY.setValue(-8);
    rightCoinX.setValue(64);
    rightCoinY.setValue(-8);
    matchCoinOpacity.setValue(0);
    potScale.setValue(1);

    Animated.sequence([
      Animated.timing(matchCoinOpacity, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(leftCoinX, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(leftCoinY, {
          toValue: 28,
          duration: 600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rightCoinX, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rightCoinY, {
          toValue: 28,
          duration: 600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(potScale, {
          toValue: 1.12,
          friction: 6,
          tension: 140,
          useNativeDriver: true,
        }),
        Animated.spring(potScale, {
          toValue: 1,
          friction: 6,
          tension: 140,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [match, leftCoinX, leftCoinY, rightCoinX, rightCoinY, matchCoinOpacity, potScale]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Status text updates
  useEffect(() => {
    if (elapsedSeconds < 5) {
      setStatusText('Searching for opponent...');
    } else if (elapsedSeconds < 10) {
      setStatusText('Expanding search range...');
    } else if (elapsedSeconds < 20) {
      setStatusText('Searching across all ratings...');
    } else {
      setStatusText('Still searching...');
    }
  }, [elapsedSeconds]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0.96, 1.05],
  });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  const totalPotDisplay = wagerType === 'skr'
    ? `${(SKR_WAGER_BASE_UNITS / 1e9) * 2} SKR`
    : `${(DEFAULT_WAGER_SOL * 2).toFixed(2)} SOL`;

  const renderRing = (anim: Animated.Value) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2.5],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 0],
    });
    return (
      <Animated.View
        style={[
          styles.ring,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgBlobTop} />
      <View style={styles.bgBlobBottom} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.queueChip}>
          <Text style={styles.queueChipText}>ARENA QUEUE</Text>
        </View>
        <Text style={styles.headerTitle}>Finding Match</Text>
        <Text style={styles.headerSub}>
          Speed Quiz • {wagerType === 'skr' ? 'SKR' : 'SOL'} wager
        </Text>
      </View>

      {/* Center animation / Match Found UI */}
      <View style={styles.centerArea}>
        {!match ? (
          <>
            {renderRing(ring1)}
            {renderRing(ring2)}
            {renderRing(ring3)}

            <Animated.View
              style={[
                styles.searchCircle,
                {
                  opacity: pulseAnim,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            >
              <View style={styles.searchCircleInnerRing} />
              <Animated.Text style={[styles.searchIcon, { transform: [{ rotate: spin }] }]}>⚔️</Animated.Text>
            </Animated.View>

            <View style={styles.playerBadge}>
              <Text style={styles.playerBadgeName}>{playerUsername}</Text>
              <Text style={styles.playerBadgeRating}>{playerRating}</Text>
            </View>
          </>
        ) : (
          <View style={styles.matchFoundContainer}>
            <View style={styles.vsRow}>
              {/* You */}
              <View style={styles.matchPlayer}>
                <View>
                  <Text style={styles.avatarText}>{playerUsername[0].toUpperCase()}</Text>
                </View>
                <Text style={styles.matchPlayerName}>{playerUsername}</Text>
                <Text style={styles.matchPlayerLabel}>YOU</Text>
              </View>

              {/* VS */}
              <View style={styles.matchVsBox}>
                <View>
                  <Text style={styles.vsCircleText}>VS</Text>
                </View>
              </View>

              {/* Opponent */}
              <View style={styles.matchPlayer}>
                <View>
                  <Text style={styles.avatarText}>
                    {(match.playerA.username === playerUsername
                      ? match.playerB.username
                      : match.playerA.username
                    )[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.matchPlayerName}>
                  {match.playerA.username === playerUsername
                    ? match.playerB.username
                    : match.playerA.username}
                </Text>
                <Text style={styles.matchPlayerLabel}>OPPONENT</Text>
              </View>
            </View>

            <View style={styles.readyTag}>
              <Text style={styles.readyText}>GET READY!</Text>
            </View>

            <View style={styles.matchPotArea}>
              <Animated.View style={[styles.matchPot, { transform: [{ scale: potScale }] }]}>
                <Text style={styles.matchPotLabel}>POT</Text>
                <Ionicons name="logo-bitcoin" size={18} color={colors.primary} />
                <Text style={styles.matchPotValue}>{totalPotDisplay}</Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.matchCoin,
                  {
                    opacity: matchCoinOpacity,
                    transform: [{ translateX: leftCoinX }, { translateY: leftCoinY }],
                  },
                ]}
              >
                <Ionicons name={wagerType === 'skr' ? 'diamond-outline' : 'ios-sparkles-outline'} size={16} color={colors.primary} />
              </Animated.View>

              <Animated.View
                style={[
                  styles.matchCoin,
                  {
                    opacity: matchCoinOpacity,
                    transform: [{ translateX: rightCoinX }, { translateY: rightCoinY }],
                  },
                ]}
              >
                <Ionicons name={wagerType === 'skr' ? 'diamond-outline' : 'ios-sparkles-outline'} size={16} color={colors.primary} />
              </Animated.View>
            </View>
          </View>
        )}
      </View>

      {/* Status */}
      {!match && (
        <View style={styles.statusArea}>
          <Text style={styles.statusText}>{statusText}</Text>
          <View style={styles.timerChip}>
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        </View>
      )}

      {/* Rating range info */}
      {!match && (
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Rating Range</Text>
          <Text style={styles.infoValue}>
            {Math.max(100, playerRating - 200 - elapsedSeconds * 10)} —{' '}
            {playerRating + 200 + elapsedSeconds * 10}
          </Text>
        </View>
      )}

      {/* Cancel button */}
      {!match && (
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingTop: 60,
    overflow: 'hidden',
  },
  bgBlobTop: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.primary,
    opacity: 0.06,
  },
  bgBlobBottom: {
    position: 'absolute',
    bottom: -150,
    left: -110,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.accent,
    opacity: 0.05,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  queueChip: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  queueChipText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  searchCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  searchCircleInnerRing: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    fontSize: 48,
    lineHeight: 48,
    textAlign: 'center',
  },
  playerBadge: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerBadgeName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  playerBadgeRating: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    fontWeight: fontWeight.semibold,
    marginTop: 2,
  },
  statusArea: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 260,
  },
  statusText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  timerChip: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  timerText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  infoBox: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: spacing.huge,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.bgCard,
    marginBottom: 40,
  },
  cancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.danger,
    letterSpacing: 2,
  },
  matchFoundContainer: {
    alignItems: 'center',
    width: '100%',
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  matchPlayer: {
    alignItems: 'center',
    width: 100,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.bg,
  },
  matchPlayerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  matchPlayerLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 4,
    letterSpacing: 1,
  },
  matchVsBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  vsCircleText: {
    fontSize: 18,
    fontWeight: fontWeight.extrabold,
    color: colors.bg,
  },
  readyTag: {
    backgroundColor: colors.primaryDim,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  readyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: 3,
  },
  matchPotArea: {
    width: 220,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  matchPot: {
    minWidth: 132,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  matchPotLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
    fontWeight: fontWeight.semibold,
  },
  matchPotValue: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  matchCoin: {
    position: 'absolute',
    top: 4,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
});
