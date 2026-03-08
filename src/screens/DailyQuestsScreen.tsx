import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { DailyQuest } from '../types';

interface DailyQuestsScreenProps {
  quests: DailyQuest[];
  onNavigate: (screen: string) => void;
}

export default function DailyQuestsScreen({ quests, onNavigate }: DailyQuestsScreenProps) {
  const completed = quests.filter(q => q.isCompleted).length;
  const totalXP = quests.filter(q => q.isCompleted).reduce((s, q) => s + q.xpReward, 0);
  const allDone = completed === quests.length && quests.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 DAILY QUESTS</Text>
        <Text style={styles.headerSub}>
          {completed}/{quests.length} completed • {totalXP} XP earned
        </Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Progress Overview */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewContent}>
            {allDone ? (
              <>
                <Ionicons name="trophy-outline" size={48} color={colors.primary} style={{ marginBottom: spacing.md }} />
                <Text style={styles.allDoneTitle}>All Quests Complete!</Text>
                <Text style={styles.allDoneSub}>Come back tomorrow for new quests</Text>
              </>
            ) : (
              <>
                <Text style={styles.overviewLabel}>Today's Progress</Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: quests.length > 0 ? `${(completed / quests.length) * 100}%` : '0%' },
                    ]}
                  />
                </View>
                <Text style={styles.overviewStats}>
                  {quests.length - completed} quest{quests.length - completed !== 1 ? 's' : ''} remaining
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Quest List */}
        <Text style={styles.sectionTitle}>QUESTS</Text>
        {quests.map((quest) => (
          <View
            key={quest.id}
            style={[
              styles.questCard,
              quest.isCompleted && styles.questCardDone,
            ]}
          >
            <View style={styles.questLeft}>
              <Ionicons name={quest.icon as any} size={28} color={quest.isCompleted ? colors.primary : colors.text} />
            </View>
            <View style={styles.questMiddle}>
              <Text style={[styles.questTitle, quest.isCompleted && styles.questTitleDone]}>
                {quest.title}
              </Text>
              <Text style={styles.questDesc}>{quest.description}</Text>
              {/* Progress bar */}
              <View style={styles.questProgressBg}>
                <View
                  style={[
                    styles.questProgressFill,
                    {
                      width: `${Math.min((quest.progress / quest.target) * 100, 100)}%`,
                      backgroundColor: quest.isCompleted ? colors.primary : colors.secondary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.questProgress}>
                {quest.progress}/{quest.target}
              </Text>
            </View>
            <View style={styles.questRight}>
              {quest.isCompleted ? (
                <Ionicons name="checkmark-circle" size={26} color={colors.primary} />
              ) : quest.tokenReward ? (
                <View style={[styles.xpBadge, { borderColor: colors.warning, backgroundColor: 'rgba(255, 171, 0, 0.1)' }]}>
                  <Text style={[styles.xpBadgeText, { color: colors.warning }]}>+{quest.tokenReward}</Text>
                  <Text style={[styles.xpBadgeLabel, { color: colors.warning }]}>{quest.tokenSymbol || 'TOK'}</Text>
                </View>
              ) : (
                <View style={styles.xpBadge}>
                  <Text style={styles.xpBadgeText}>+{quest.xpReward}</Text>
                  <Text style={styles.xpBadgeLabel}>XP</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {/* CTA */}
        {!allDone && (
          <TouchableOpacity
            style={styles.findMatchBtn}
            onPress={() => onNavigate('home')}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.findMatchText}>PLAY TO COMPLETE QUESTS</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  scroll: { flex: 1 },

  // Overview card
  overviewCard: {
    margin: spacing.lg,
    backgroundColor: '#12141A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  overviewContent: {
    width: '100%',
  },
  overviewLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#2A2E35',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9FE870',
    borderRadius: 6,
  },
  overviewStats: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 8,
  },
  allDoneEmoji: { fontSize: 48, marginBottom: spacing.md },
  allDoneTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  allDoneSub: { fontSize: fontSize.sm, color: colors.textSecondary },

  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    marginTop: 0,
  },

  // Quest cards
  questCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  questCardDone: {
    borderColor: colors.primaryDim,
    opacity: 0.75,
  },
  questLeft: { width: 40, alignItems: 'center' },
  questIcon: { fontSize: 28 },
  questMiddle: { flex: 1 },
  questTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
  },
  questTitleDone: { color: colors.textSecondary },
  questDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  questProgressBg: {
    height: 4,
    backgroundColor: colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  questProgressFill: { height: '100%', borderRadius: 2 },
  questProgress: { fontSize: fontSize.xs, color: colors.textDim },
  questRight: { width: 48, alignItems: 'center' },
  checkmark: { fontSize: 22 },
  xpBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  xpBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  xpBadgeLabel: { fontSize: 9, color: colors.primary, letterSpacing: 0.5 },

  // CTA
  findMatchBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  findMatchGradient: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  findMatchText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: colors.bg,
    letterSpacing: 2,
  },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 20,
    paddingTop: spacing.sm,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  navIcon: { fontSize: 20, marginBottom: 2 },
  navLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  navActive: { color: colors.primary },
});
