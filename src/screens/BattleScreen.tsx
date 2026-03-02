import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { SECONDS_PER_QUESTION, QUESTIONS_PER_MATCH } from '../config/constants';
import { Match, Question, PlayerAnswer } from '../types';

interface BattleScreenProps {
  match: Match;
  currentPlayerId: string;
  onAnswer: (questionIndex: number, selectedOption: number, reactionTimeMs: number) => void;
  onMatchEnd: () => void;
}

export default function BattleScreen({
  match,
  currentPlayerId,
  onAnswer,
  onMatchEnd,
}: BattleScreenProps) {
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  const timerAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const currentQuestion = match.questions[match.currentQuestionIndex];
  const isPlayerA = match.playerA.id === currentPlayerId;
  const myData = isPlayerA ? match.playerA : match.playerB;
  const opponentData = isPlayerA ? match.playerB : match.playerA;

  // Timer countdown
  useEffect(() => {
    setTimeLeft(SECONDS_PER_QUESTION);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuestionStartTime(Date.now());

    timerAnim.setValue(1);
    flashAnim.setValue(0);
    scaleAnim.setValue(0.5);

    Animated.timing(timerAnim, {
      toValue: 0,
      duration: SECONDS_PER_QUESTION * 1000,
      useNativeDriver: false,
    }).start();


    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [match.currentQuestionIndex]);

  const handleTimeout = useCallback(() => {
    if (selectedAnswer === null) {
      onAnswer(match.currentQuestionIndex, -1, SECONDS_PER_QUESTION * 1000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [selectedAnswer, match.currentQuestionIndex]);

  const handleSelectAnswer = (optionIndex: number) => {
    if (selectedAnswer !== null) return; // Already answered

    const reactionTime = Date.now() - questionStartTime;
    setSelectedAnswer(optionIndex);
    setShowResult(true);

    const isCorrect = optionIndex === currentQuestion.correctIndex;

    // Haptic feedback
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Animations
    Animated.parallel([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    onAnswer(match.currentQuestionIndex, optionIndex, reactionTime);
  };

  const getOptionStyle = (index: number) => {
    if (!showResult) {
      return selectedAnswer === index ? styles.optionSelected : styles.option;
    }

    if (index === currentQuestion.correctIndex) {
      return [styles.option, styles.optionCorrect];
    }
    if (selectedAnswer === index && index !== currentQuestion.correctIndex) {
      return [styles.option, styles.optionWrong];
    }
    return styles.option;
  };

  const getOptionTextStyle = (index: number) => {
    if (!showResult) {
      return selectedAnswer === index
        ? styles.optionTextSelected
        : styles.optionText;
    }
    if (index === currentQuestion.correctIndex) {
      return styles.optionTextCorrect;
    }
    if (selectedAnswer === index) {
      return styles.optionTextWrong;
    }
    return styles.optionText;
  };

  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [colors.danger, colors.warning, colors.primary],
  });

  const timerWidth = timerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Flash overlay */}
      <Animated.View
        style={[
          styles.flashOverlay,
          {
            opacity: flashAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.4],
            }),
            backgroundColor:
              selectedAnswer !== null &&
              selectedAnswer === currentQuestion?.correctIndex
                ? colors.primary
                : colors.danger,
          },
        ]}
        pointerEvents="none"
      />

      {/* Player Headers */}
      <View style={styles.playerBar}>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>
            {myData.username}
          </Text>
          <Text style={styles.playerRating}>{myData.rating}</Text>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>
            {myData.score} - {opponentData.score}
          </Text>
          <Text style={styles.questionNum}>
            Q{match.currentQuestionIndex + 1}/{QUESTIONS_PER_MATCH}
          </Text>
        </View>

        <View style={[styles.playerInfo, styles.playerInfoRight]}>
          <Text style={styles.playerName} numberOfLines={1}>
            {opponentData.username}
          </Text>
          <Text style={styles.playerRating}>{opponentData.rating}</Text>
        </View>
      </View>

      {/* Timer Bar */}
      <View style={styles.timerContainer}>
        <Animated.View
          style={[styles.timerBar, { width: timerWidth, backgroundColor: timerColor }]}
        />
        <View style={styles.timerCircle}>
          <Text
            style={[
              styles.timerText,
              timeLeft <= 3 && styles.timerTextDanger,
            ]}
          >
            {timeLeft}
          </Text>
        </View>
      </View>

      {/* Question */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{currentQuestion?.question}</Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {currentQuestion?.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={getOptionStyle(index)}
            onPress={() => handleSelectAnswer(index)}
            disabled={selectedAnswer !== null}
            activeOpacity={0.7}
          >
            <View style={styles.optionLetter}>
              <Text style={styles.optionLetterText}>
                {String.fromCharCode(65 + index)}
              </Text>
            </View>
            <Text style={getOptionTextStyle(index)}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Result Flash */}
      {showResult && (
        <Animated.View 
          style={[
            styles.resultFlash,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
              ],
              opacity: flashAnim
            }
          ]}
        >
          {match.status === 'finished' && (
            <Text style={styles.finalMatchText}>MATCH FINISHED</Text>
          )}
          <Text style={styles.resultEmoji}>
            {selectedAnswer === currentQuestion?.correctIndex ? '✅' : '❌'}
          </Text>
          <Text
            style={[
              styles.resultText,
              {
                color:
                  selectedAnswer === currentQuestion?.correctIndex
                    ? colors.primary
                    : colors.danger,
              },
            ]}
          >
            {selectedAnswer === currentQuestion?.correctIndex
              ? 'CORRECT!'
              : 'WRONG!'}
          </Text>
          <Text style={styles.resultTime}>
            {((Date.now() - questionStartTime) / 1000).toFixed(1)}s
          </Text>
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 50,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },

  // Player Bar
  playerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  playerInfo: {
    flex: 1,
  },
  playerInfoRight: {
    alignItems: 'flex-end',
  },
  playerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  playerRating: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  scoreText: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
  },
  questionNum: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Timer
  timerContainer: {
    height: 6,
    backgroundColor: colors.bgElevated,
    marginHorizontal: spacing.lg,
    borderRadius: 3,
    marginBottom: spacing.xl,
    position: 'relative',
  },
  timerBar: {
    height: '100%',
    borderRadius: 3,
  },
  timerCircle: {
    position: 'absolute',
    top: -22,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
  },
  timerTextDanger: {
    color: colors.danger,
  },

  // Question
  questionContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 120,
    justifyContent: 'center',
  },
  questionText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 28,
  },

  // Options
  optionsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  option: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.secondaryDim,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  optionCorrect: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  optionWrong: {
    backgroundColor: colors.dangerDim,
    borderColor: colors.danger,
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionLetterText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  optionText: {
    fontSize: fontSize.md,
    color: colors.text,
    flex: 1,
  },
  optionTextSelected: {
    fontSize: fontSize.md,
    color: colors.secondary,
    flex: 1,
    fontWeight: fontWeight.semibold,
  },
  optionTextCorrect: {
    fontSize: fontSize.md,
    color: colors.primary,
    flex: 1,
    fontWeight: fontWeight.bold,
  },
  optionTextWrong: {
    fontSize: fontSize.md,
    color: colors.danger,
    flex: 1,
    fontWeight: fontWeight.bold,
  },

  // Result Flash
  resultFlash: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    padding: spacing.xl,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  finalMatchText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 3,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },

  resultEmoji: {
    fontSize: 36,
  },
  resultText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    marginTop: spacing.sm,
    letterSpacing: 2,
  },
  resultTime: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
