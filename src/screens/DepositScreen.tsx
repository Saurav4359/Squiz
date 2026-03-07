import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../config/theme';
import { Match, MatchPlayer } from '../types';

interface DepositScreenProps {
  match: Match;
  currentPlayerId: string;
  wagerType: 'sol' | 'skr';
  onDeposited: () => void;
  onBothDeposited: () => void;
  onTimeout: () => void;
  onCancel: () => void;
}

export default function DepositScreen({
  match,
  currentPlayerId,
  wagerType,
  onDeposited,
  onBothDeposited,
  onTimeout,
  onCancel,
}: DepositScreenProps) {
  const [myDeposited, setMyDeposited] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  const currentPlayer: MatchPlayer =
    match.playerA.id === currentPlayerId ? match.playerA : match.playerB;
  const opponent: MatchPlayer =
    match.playerA.id === currentPlayerId ? match.playerB : match.playerA;

  const opponentDeposited = opponent.isReady;

  const wagerDisplay = wagerType === 'sol' ? '0.05 SOL' : '10 SKR';
  const accentColor = wagerType === 'sol' ? colors.secondary : colors.purple;

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeout();
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, onTimeout]);

  // Check if both deposited
  useEffect(() => {
    if (myDeposited && opponentDeposited) {
      onBothDeposited();
    }
  }, [myDeposited, opponentDeposited, onBothDeposited]);

  const handleDeposit = useCallback(() => {
    setMyDeposited(true);
    onDeposited();
  }, [onDeposited]);

  const timerColor =
    timeLeft <= 10 ? colors.danger : timeLeft <= 30 ? colors.warning : colors.textSecondary;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>Deposit Wager</Text>

      {/* VS Display */}
      <View style={styles.vsContainer}>
        <View style={styles.playerSide}>
          <Text style={styles.playerLabel}>YOU</Text>
          <Text style={styles.playerName} numberOfLines={1}>
            {currentPlayer.username}
          </Text>
          <Text style={styles.playerRating}>{currentPlayer.rating} ELO</Text>
        </View>
        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <View style={styles.playerSide}>
          <Text style={styles.playerLabel}>OPPONENT</Text>
          <Text style={styles.playerName} numberOfLines={1}>
            {opponent.username}
          </Text>
          <Text style={styles.playerRating}>{opponent.rating} ELO</Text>
        </View>
      </View>

      {/* Wager Amount Card */}
      <View style={[styles.wagerCard, { borderColor: accentColor }]}>
        <Text style={styles.wagerLabel}>WAGER AMOUNT</Text>
        <Text style={[styles.wagerAmount, { color: accentColor }]}>{wagerDisplay}</Text>
      </View>

      {/* Deposit Status Section */}
      <View style={styles.statusSection}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Your Deposit</Text>
          {myDeposited ? (
            <View style={styles.statusComplete}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.statusCompleteText}>Deposited</Text>
            </View>
          ) : (
            <TouchableOpacity style={[styles.depositButton, { backgroundColor: accentColor }]} onPress={handleDeposit}>
              <Text style={styles.depositButtonText}>Deposit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statusDivider} />

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Opponent Deposit</Text>
          {opponentDeposited ? (
            <View style={styles.statusComplete}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.statusCompleteText}>Deposited</Text>
            </View>
          ) : (
            <View style={styles.statusWaiting}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={styles.statusWaitingText}>Waiting...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        <Text style={[styles.timerText, { color: timerColor }]}>
          {timeLeft}s
        </Text>
        <Text style={styles.timerLabel}>remaining</Text>
      </View>

      {/* Cancel Button */}
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.huge,
    alignItems: 'center',
  },
  header: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: spacing.xxxl,
  },
  playerSide: {
    flex: 1,
    alignItems: 'center',
  },
  playerLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textDim,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  playerName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  playerRating: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  vsBadge: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
  },
  vsText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: colors.textSecondary,
  },
  wagerCard: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  wagerLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textDim,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  wagerAmount: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.extrabold,
  },
  statusSection: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxxl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  statusLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  statusComplete: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  statusCompleteText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  depositButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  depositButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.bg,
  },
  statusWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusWaitingText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  statusDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  timerText: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.extrabold,
  },
  timerLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textDim,
    marginTop: spacing.xs,
  },
  cancelButton: {
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cancelButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
});
