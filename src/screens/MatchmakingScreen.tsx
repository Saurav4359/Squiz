import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';

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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finding Match</Text>
        <Text style={styles.headerSub}>
          Speed Quiz • {wagerType === 'skr' ? '💎 SKR' : '◎ SOL'} wager
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
                  transform: [{ rotate: spin }],
                },
              ]}
            >
              <LinearGradient
                colors={wagerType === 'skr' ? colors.gradientPurple : colors.gradientPrimary}
                style={styles.searchCircleInner}
              >
                <Text style={styles.searchIcon}>⚔️</Text>
              </LinearGradient>
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
                <LinearGradient
                  colors={colors.gradientPrimary}
                  style={styles.avatarCircle}
                >
                  <Text style={styles.avatarText}>{playerUsername[0].toUpperCase()}</Text>
                </LinearGradient>
                <Text style={styles.matchPlayerName}>{playerUsername}</Text>
                <Text style={styles.matchPlayerLabel}>YOU</Text>
              </View>

              {/* VS */}
              <View style={styles.matchVsBox}>
                <LinearGradient
                  colors={['#FFD700', '#B8860B'] as const}
                  style={styles.vsCircle}
                >
                  <Text style={styles.vsCircleText}>VS</Text>
                </LinearGradient>
              </View>

              {/* Opponent */}
              <View style={styles.matchPlayer}>
                <LinearGradient
                  colors={colors.gradientPurple}
                  style={styles.avatarCircle}
                >
                  <Text style={styles.avatarText}>
                    {(match.playerA.username === playerUsername
                      ? match.playerB.username
                      : match.playerA.username
                    )[0].toUpperCase()}
                  </Text>
                </LinearGradient>
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
          </View>
        )}
      </View>

      {/* Status */}
      {!match && (
        <View style={styles.statusArea}>
          <Text style={styles.statusText}>{statusText}</Text>
          <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSub: {
    fontSize: fontSize.sm,
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
    overflow: 'hidden',
  },
  searchCircleInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 60,
  },
  searchIcon: {
    fontSize: 48,
  },
  playerBadge: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
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
    marginBottom: spacing.xxl,
  },
  statusText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  timerText: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  infoBox: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
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
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.huge,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.danger,
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
});
