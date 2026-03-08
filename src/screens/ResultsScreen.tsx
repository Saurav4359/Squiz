import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { Match, PlayerAnswer } from '../types';
import { RatingResult } from '../services/matchmaking/ratingSystem';

interface ResultsScreenProps {
  match: Match;
  currentPlayerId: string;
  ratingResult: RatingResult;
  xpEarned: number;
  onPlayAgain: () => void;
  onGoHome: () => void;
}

export default function ResultsScreen({
  match,
  currentPlayerId,
  ratingResult,
  xpEarned,
  onPlayAgain,
  onGoHome,
}: ResultsScreenProps) {
  const isWinner = match.winnerId === currentPlayerId;
  const isDraw = !match.winnerId;

  const isPlayerA = match.playerA.id === currentPlayerId;
  const myData = isPlayerA ? match.playerA : match.playerB;
  const opponentData = isPlayerA ? match.playerB : match.playerA;
  const myRatingDelta = isWinner ? ratingResult.winnerDelta : ratingResult.loserDelta;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const slideUp1 = useRef(new Animated.Value(40)).current;
  const slideUp2 = useRef(new Animated.Value(40)).current;
  const slideUp3 = useRef(new Animated.Value(40)).current;
  const fadeIn1 = useRef(new Animated.Value(0)).current;
  const fadeIn2 = useRef(new Animated.Value(0)).current;
  const fadeIn3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isWinner) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Animated.sequence([
      // Result title entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      // Stats cards stagger
      Animated.stagger(150, [
        Animated.parallel([
          Animated.timing(slideUp1, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(fadeIn1, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(slideUp2, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(fadeIn2, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(slideUp3, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(fadeIn3, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const correctAnswers = myData.answers.filter((a) => a.isCorrect).length;
  const totalQuestions = match.questions.length;
  const avgReactionTime =
    myData.answers.length > 0
      ? myData.answers.reduce((sum, a) => sum + a.reactionTimeMs, 0) / myData.answers.length
      : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Result Banner */}
        <Animated.View
          style={[
            styles.resultBanner,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={styles.resultEmoji}>
            {isWinner ? '🏆' : isDraw ? '🤝' : '😢'}
          </Text>
          <Text
            style={[
              styles.resultTitle,
              {
                color: isWinner
                  ? colors.primary
                  : isDraw
                  ? colors.warning
                  : colors.danger,
              },
            ]}
          >
            {isWinner ? 'VICTORY!' : isDraw ? 'DRAW' : 'DEFEAT'}
          </Text>
          <Text style={styles.scoreText}>
            {myData.score} — {opponentData.score}
          </Text>
        </Animated.View>

        {/* Score Comparison */}
        <Animated.View
          style={[styles.card, { opacity: fadeIn1, transform: [{ translateY: slideUp1 }] }]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Match Breakdown</Text>
          </View>
          <View style={styles.compRow}>
            <View style={styles.compSide}>
              <Text style={styles.compName}>{myData.username}</Text>
              <Text style={[styles.compScore, { color: colors.primary }]}>
                {myData.score}
              </Text>
            </View>
            <Text style={styles.compVs}>VS</Text>
            <View style={[styles.compSide, styles.compSideRight]}>
              <Text style={styles.compName}>{opponentData.username}</Text>
              <Text style={[styles.compScore, { color: colors.danger }]}>
                {opponentData.score}
              </Text>
            </View>
          </View>

          {/* Per-question results */}
          <View style={styles.questionResults}>
            <View style={styles.qHeaderRow}>
              <Text style={styles.qHeaderLabel}>TIME</Text>
              <View style={{ width: 36 }} />
              <Text style={styles.qHeaderLabel}>TIME</Text>
            </View>
            {match.questions.map((q, i) => {
              const myAnswer = myData.answers.find((a) => a.questionIndex === i);
              const theirAnswer = opponentData.answers.find((a) => a.questionIndex === i);
              return (
                <View key={i} style={styles.qRow}>
                  <View style={styles.qSide}>
                    <Text style={styles.qTime}>
                      {myAnswer ? (myAnswer.reactionTimeMs / 1000).toFixed(1) : '—'}s
                    </Text>
                    <Text
                      style={[
                        styles.qResult,
                        { color: myAnswer?.isCorrect ? colors.primary : colors.danger },
                      ]}
                    >
                      {myAnswer?.isCorrect ? '✓' : '✗'}
                    </Text>
                  </View>
                  <Text style={styles.qNum}>Q{i + 1}</Text>
                  <View style={[styles.qSide, styles.qSideRight]}>
                    <Text
                      style={[
                        styles.qResult,
                        { color: theirAnswer?.isCorrect ? colors.primary : colors.danger },
                      ]}
                    >
                      {theirAnswer?.isCorrect ? '✓' : '✗'}
                    </Text>
                    <Text style={styles.qTime}>
                      {theirAnswer ? (theirAnswer.reactionTimeMs / 1000).toFixed(1) : '—'}s
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

        </Animated.View>

        {/* Rating Change */}
        <Animated.View
          style={[styles.card, { opacity: fadeIn2, transform: [{ translateY: slideUp2 }] }]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Rating</Text>
          </View>
          <View style={styles.ratingChangeRow}>
            <Text style={styles.ratingValue}>
              {(isWinner ? ratingResult.winnerNewRating : ratingResult.loserNewRating) - myRatingDelta}
            </Text>
            <Text style={styles.ratingArrow}>→</Text>
            <Text style={[styles.ratingValue, styles.ratingNew]}>
              {isWinner ? ratingResult.winnerNewRating : ratingResult.loserNewRating}
            </Text>
            <Text
              style={[
                styles.ratingDelta,
                { color: myRatingDelta >= 0 ? colors.primary : colors.danger },
              ]}
            >
              {myRatingDelta >= 0 ? '+' : ''}
              {myRatingDelta}
            </Text>
          </View>
        </Animated.View>

        {/* XP & Stats */}
        <Animated.View
          style={[styles.card, { opacity: fadeIn3, transform: [{ translateY: slideUp3 }] }]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Rewards</Text>
          </View>
          <View style={styles.rewardsGrid}>
            <View style={styles.rewardItem}>
              <Text style={styles.rewardValue}>+{xpEarned}</Text>
              <Text style={styles.rewardLabel}>XP Earned</Text>
            </View>
            <View style={styles.rewardDivider} />
            <View style={styles.rewardItem}>
              <Text style={styles.rewardValue}>
                {correctAnswers}/{totalQuestions}
              </Text>
              <Text style={styles.rewardLabel}>Accuracy</Text>
            </View>
            <View style={styles.rewardDivider} />
            <View style={styles.rewardItem}>
              <Text style={styles.rewardValue}>
                {(avgReactionTime / 1000).toFixed(1)}s
              </Text>
              <Text style={styles.rewardLabel}>Avg Speed</Text>
            </View>
          </View>
        </Animated.View>

        {/* Action buttons */}
        <TouchableOpacity style={styles.playAgainBtn} onPress={onPlayAgain} activeOpacity={0.8}>
          <View>
            <Text style={styles.playAgainText}>PLAY AGAIN</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.homeBtn} onPress={onGoHome}>
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Result Banner
  resultBanner: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  resultEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  resultTitle: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 4,
  },
  scoreText: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },

  // Cards
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Comparison
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  compSide: {
    flex: 1,
  },
  compSideRight: {
    alignItems: 'flex-end',
  },
  compName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  compScore: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold,
    marginTop: spacing.xs,
  },
  compVs: {
    fontSize: fontSize.sm,
    color: colors.textDim,
    fontWeight: fontWeight.bold,
    marginHorizontal: spacing.lg,
  },

  // Per-question
  questionResults: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  qHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  qHeaderLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textDim,
    letterSpacing: 1,
    width: 60,
    textAlign: 'center',
  },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '33',
  },
  qSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  qSideRight: {
    justifyContent: 'flex-end',
  },
  qNum: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textDim,
    width: 36,
    textAlign: 'center',
  },
  qTime: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    minWidth: 40,
    textAlign: 'center',
  },
  qResult: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    width: 24,
    textAlign: 'center',
  },


  // Rating
  ratingChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  ratingValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  ratingNew: {
    color: colors.text,
  },
  ratingArrow: {
    fontSize: fontSize.xl,
    color: colors.textDim,
  },
  ratingDelta: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
  },

  // Rewards
  rewardsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardItem: {
    flex: 1,
    alignItems: 'center',
  },
  rewardValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
  },
  rewardLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  rewardDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // Buttons
  playAgainBtn: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.lg,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  playAgainGradient: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  playAgainText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.bg,
    letterSpacing: 2,
  },
  homeBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  homeBtnText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
});
