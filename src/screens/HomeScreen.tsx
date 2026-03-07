import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { ROLES, UserRole } from '../config/constants';
import { Player, DailyQuest } from '../types';
import { getRankTitle, getRankColor, calculateLevel, getXPForNextLevel } from '../services/matchmaking/ratingSystem';

interface HomeScreenProps {
  player: Player;
  onFindMatch: (role: UserRole, wagerType: 'sol' | 'skr') => void;
  onNavigate: (screen: string) => void;
  dailyQuests: DailyQuest[];
}

export default function HomeScreen({ player, onFindMatch, onNavigate, dailyQuests }: HomeScreenProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(player.primaryRole);
  const rating = player.ratings[selectedRole] || 1200;
  const rankTitle = getRankTitle(rating);
  const rankColor = getRankColor(rating);
  const level = calculateLevel(player.xp);
  const xpProgress = getXPForNextLevel(player.xp);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {player.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.username}>{player.username}</Text>
              <View style={styles.ratingRow}>
                <Text style={[styles.rankTitle, { color: rankColor }]}>
                  {rankTitle}
                </Text>
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{player.matchesPlayed}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {player.matchesPlayed > 0
                  ? Math.round((player.matchesWon / player.matchesPlayed) * 100)
                  : 0}%
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>🔥 {player.currentStreak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Lv.{level}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
          </View>

          {/* XP Progress Bar */}
          <View style={styles.xpBarContainer}>
            <View style={styles.xpBarBg}>
              <LinearGradient
                colors={colors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.xpBarFill, { width: `${xpProgress.progress * 100}%` }]}
              />
            </View>
            <Text style={styles.xpText}>
              {xpProgress.current} / {xpProgress.required} XP
            </Text>
          </View>

          {player.isSkrStaker && (
            <View style={styles.skrBadge}>
              <Text style={styles.skrBadgeText}>💎 SKR Staker • 1.5x XP</Text>
            </View>
          )}
        </View>

        {/* Role Selector */}
        <Text style={styles.sectionTitle}>SELECT ROLE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.roleScroll}
        >
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.roleChip,
                selectedRole === role && styles.roleChipActive,
              ]}
              onPress={() => setSelectedRole(role)}
            >
              <Text
                style={[
                  styles.roleChipText,
                  selectedRole === role && styles.roleChipTextActive,
                ]}
              >
                {role}
              </Text>
              {selectedRole === role && (
                <Text style={styles.roleRating}>
                  {player.ratings[role] || 1200}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Find Match Button */}
        <TouchableOpacity
          style={styles.findMatchButton}
          onPress={() => onFindMatch(selectedRole, 'sol')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={colors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.findMatchGradient}
          >
            <Text style={styles.findMatchIcon}>⚔️</Text>
            <Text style={styles.findMatchText}>FIND MATCH</Text>
            <Text style={styles.findMatchSub}>0.05 SOL wager</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* SKR Tournament Button */}
        <TouchableOpacity
          style={styles.skrMatchButton}
          onPress={() => onFindMatch(selectedRole, 'skr')}
          activeOpacity={0.8}
        >
          <Text style={styles.skrMatchIcon}>💎</Text>
          <Text style={styles.skrMatchText}>SKR TOURNAMENT</Text>
          <Text style={styles.skrMatchSub}>Wager SKR • 1.5x XP</Text>
        </TouchableOpacity>

        {/* Daily Quests */}
        <Text style={styles.sectionTitle}>📋 DAILY QUESTS</Text>
        {dailyQuests.map((quest) => (
          <View key={quest.id} style={styles.questCard}>
            <View style={styles.questHeader}>
              <Text style={styles.questIcon}>{quest.icon}</Text>
              <View style={styles.questInfo}>
                <Text style={styles.questTitle}>{quest.title}</Text>
                <Text style={styles.questReward}>+{quest.xpReward} XP</Text>
              </View>
              {quest.isCompleted && (
                <Text style={styles.questComplete}>✅</Text>
              )}
            </View>
            <View style={styles.questProgressBg}>
              <View
                style={[
                  styles.questProgressFill,
                  {
                    width: `${(quest.progress / quest.target) * 100}%`,
                    backgroundColor: quest.isCompleted
                      ? colors.primary
                      : colors.secondary,
                  },
                ]}
              />
            </View>
            <Text style={styles.questProgressText}>
              {quest.progress}/{quest.target}
            </Text>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginTop: spacing.xxl + 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  profileInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  username: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  rankTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginRight: spacing.sm,
  },
  ratingText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // XP Bar
  xpBarContainer: {
    marginBottom: spacing.sm,
  },
  xpBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  xpText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'right',
  },

  // SKR Badge
  skrBadge: {
    backgroundColor: colors.purpleDim,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  skrBadgeText: {
    fontSize: fontSize.xs,
    color: colors.purple,
    fontWeight: fontWeight.semibold,
  },

  // Section Title
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    letterSpacing: 1,
  },

  // Role Selector
  roleScroll: {
    marginBottom: spacing.lg,
  },
  roleChip: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  roleChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  roleChipTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  roleRating: {
    fontSize: fontSize.xs,
    color: colors.primary,
    marginLeft: spacing.sm,
    fontWeight: fontWeight.bold,
  },

  // Find Match Button
  findMatchButton: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  findMatchGradient: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  findMatchIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  findMatchText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    color: colors.bg,
    letterSpacing: 2,
  },
  findMatchSub: {
    fontSize: fontSize.sm,
    color: 'rgba(10, 10, 26, 0.6)',
    marginTop: spacing.xs,
  },

  // SKR Match Button
  skrMatchButton: {
    backgroundColor: colors.purpleDim,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.purple,
    marginBottom: spacing.lg,
  },
  skrMatchIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  skrMatchText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.purple,
    letterSpacing: 1,
  },
  skrMatchSub: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Quest Cards
  questCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  questIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  questInfo: {
    flex: 1,
  },
  questTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  questReward: {
    fontSize: fontSize.xs,
    color: colors.primary,
    marginTop: 2,
  },
  questComplete: {
    fontSize: 18,
  },
  questProgressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  questProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  questProgressText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'right',
  },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 20,
    paddingTop: spacing.sm,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  navActive: {
    color: colors.primary,
  },
});
