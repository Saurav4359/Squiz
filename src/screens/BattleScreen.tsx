import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { SECONDS_ANSWER_PHASE, SECONDS_QUESTION_PHASE, QUESTIONS_PER_MATCH } from '../config/constants';
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
  const [phase, setPhase] = useState<'question' | 'answer'>('question');
  const [timeLeft, setTimeLeft] = useState(SECONDS_ANSWER_PHASE);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [lastReactionSeconds, setLastReactionSeconds] = useState<number | null>(null);
  const [lastWasCorrect, setLastWasCorrect] = useState<boolean | null>(null);

  const timerAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerIntervalRef = useRef<any>(null);
  const phaseTimeoutRef = useRef<any>(null);
  const hasAnsweredRef = useRef(false);

  // Stable refs to prevent re-renders when match prop updates (opponent answers)
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;
  const questionIndexRef = useRef(match.currentQuestionIndex);

  // Snapshot question data — only update when question index changes
  const questionRef = useRef(match.questions[match.currentQuestionIndex]);
  if (match.currentQuestionIndex !== questionIndexRef.current) {
    questionIndexRef.current = match.currentQuestionIndex;
    questionRef.current = match.questions[match.currentQuestionIndex];
  }

  const isPlayerA = match.playerA.id === currentPlayerId;
  const myData = isPlayerA ? match.playerA : match.playerB;
  const opponentData = isPlayerA ? match.playerB : match.playerA;

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    timerAnim.stopAnimation();
  }, []);

  const triggerFeedback = useCallback((isCorrect: boolean, points: number, reactionSeconds: number) => {
    setShowResult(true);
    setLastPoints(points);
    setLastReactionSeconds(reactionSeconds);
    setLastWasCorrect(isCorrect);
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

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
  }, []);

  const handleTimeout = useCallback(() => {
    if (hasAnsweredRef.current) return;
    hasAnsweredRef.current = true;

    setSelectedAnswer(-1);
    triggerFeedback(false, 0, SECONDS_ANSWER_PHASE);

    setTimeout(() => {
      onAnswerRef.current(questionIndexRef.current, -1, SECONDS_ANSWER_PHASE * 1000);
    }, 0);
  }, [triggerFeedback]);

  // Timer countdown and state reset per question
  useEffect(() => {
    // Reset local state
    setPhase('question');
    setTimeLeft(SECONDS_ANSWER_PHASE);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuestionStartTime(Date.now());
    hasAnsweredRef.current = false;
    setLastPoints(null);
    setLastReactionSeconds(null);
    setLastWasCorrect(null);

    // Reset animations
    timerAnim.setValue(1);
    flashAnim.setValue(0);
    scaleAnim.setValue(0.5);

    // Clear existing timers
    stopTimer();
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }

    // QUESTION PHASE: wait before showing options
    phaseTimeoutRef.current = setTimeout(() => {
      setPhase('answer');
      setQuestionStartTime(Date.now());

      // ANSWER PHASE: animate timer and start countdown
      timerAnim.setValue(1);
      Animated.timing(timerAnim, {
        toValue: 0,
        duration: SECONDS_ANSWER_PHASE * 1000,
        useNativeDriver: false,
      }).start();

      setTimeLeft(SECONDS_ANSWER_PHASE);
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopTimer();
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, SECONDS_QUESTION_PHASE * 1000);

    return () => {
      stopTimer();
      if (phaseTimeoutRef.current) {
        clearTimeout(phaseTimeoutRef.current);
        phaseTimeoutRef.current = null;
      }
    };
  }, [match.currentQuestionIndex, stopTimer, handleTimeout]);

  const handleSelectAnswer = (optionIndex: number) => {
    if (phase !== 'answer' || hasAnsweredRef.current || selectedAnswer !== null) return;
    hasAnsweredRef.current = true;

    stopTimer();

    const reactionTime = Date.now() - questionStartTime;
    const reactionSeconds = reactionTime / 1000;
    setSelectedAnswer(optionIndex);

    const question = questionRef.current;
    if (!question) return;
    const isCorrect = optionIndex === question.correctIndex;
    const points =
      isCorrect
        ? reactionSeconds < 4
          ? 100
          : reactionSeconds <= 8
          ? 80
          : reactionSeconds <= SECONDS_ANSWER_PHASE
          ? 60
          : 60
        : 0;
    triggerFeedback(isCorrect, points, reactionSeconds);

    // Defer state update to next tick to avoid "update during render" error
    setTimeout(() => {
      onAnswerRef.current(questionIndexRef.current, optionIndex, reactionTime);
    }, 0);
  };

  const getOptionStyle = (index: number) => {
    if (!showResult) {
      return selectedAnswer === index ? styles.optionSelected : styles.option;
    }

    if (index === questionRef.current?.correctIndex) {
      return [styles.option, styles.optionCorrect];
    }
    if (selectedAnswer === index && index !== questionRef.current?.correctIndex) {
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
    if (index === questionRef.current?.correctIndex) {
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
              selectedAnswer === questionRef.current?.correctIndex
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

      {/* Timer Bar (only during answer phase) */}
      {phase === 'answer' && (
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
      )}

      {/* Question */}
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{questionRef.current?.question}</Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {showResult && lastPoints !== null && (
          <Animated.View
            style={[
              styles.speedBadge,
              {
                transform: [
                  { scale: scaleAnim },
                  {
                    translateY: flashAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
                opacity: flashAnim,
              },
            ]}
          >
            <Text style={styles.speedBadgeText}>
              {lastWasCorrect && lastReactionSeconds !== null && lastReactionSeconds < 4
                ? `⚡ PERFECT SPEED +${lastPoints}`
                : `+${lastPoints} SPEED`}
            </Text>
          </Animated.View>
        )}
        {phase === 'answer' &&
          questionRef.current?.options.map((option, index) => (
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
            {selectedAnswer === questionRef.current?.correctIndex ? '✅' : '❌'}
          </Text>
          <Text
            style={[
              styles.resultText,
              {
                color:
                  selectedAnswer === questionRef.current?.correctIndex
                    ? colors.primary
                    : colors.danger,
              },
            ]}
          >
            {selectedAnswer === questionRef.current?.correctIndex
              ? 'CORRECT!'
              : 'WRONG!'}
          </Text>
          {lastReactionSeconds !== null && (
            <Text style={styles.resultTime}>
              {lastReactionSeconds.toFixed(1)}s
            </Text>
          )}
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
  speedBadge: {
    alignSelf: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  speedBadgeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: colors.secondary,
    letterSpacing: 1,
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
