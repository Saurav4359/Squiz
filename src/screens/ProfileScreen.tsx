import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { ROLES, UserRole } from '../config/constants';
import { Player } from '../types';
import {
  getRankTitle,
  getRankColor,
  calculateLevel,
  getXPForNextLevel,
} from '../services/matchmaking/ratingSystem';

interface ProfileScreenProps {
  player: Player;
  onNavigate: (screen: string) => void;
  walletBalance?: { sol: number; skr: number };
  onDisconnect?: () => void;
  onUpdatePlayer?: (data: Partial<Player>) => Promise<void>;
}

export default function ProfileScreen({ player, onNavigate, walletBalance, onDisconnect, onUpdatePlayer }: ProfileScreenProps) {
  const level = calculateLevel(player.xp);
  const xpProgress = getXPForNextLevel(player.xp);

  const sortedRoles = [...ROLES]
    .map((role) => ({
      role,
      rating: player.ratings[role] || 1200,
    }))
    .sort((a, b) => b.rating - a.rating);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <LinearGradient
            colors={colors.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>
                {player.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          </LinearGradient>

          <Text style={styles.username}>{player.username}</Text>
          <Text style={styles.seekerId}>Seeker #{player.seekerId}</Text>

          {player.isSkrStaker && (
            <View style={styles.skrStakerBadge}>
              <Text style={styles.skrStakerText}>💎 SKR Staker • 1.5x XP</Text>
            </View>
          )}
        </View>

        {/* Level & XP */}
        <View style={styles.card}>
          <View style={styles.levelRow}>
            <Text style={styles.levelLabel}>Level</Text>
            <Text style={styles.levelValue}>{level}</Text>
          </View>
          <View style={styles.xpBarBg}>
            <LinearGradient
              colors={colors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.xpBarFill, { width: `${xpProgress.progress * 100}%` }]}
            />
          </View>
          <Text style={styles.xpText}>
            {xpProgress.current} / {xpProgress.required} XP to next level
          </Text>
          <Text style={styles.totalXp}>Total: {player.xp.toLocaleString()} XP</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>STATS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{player.matchesPlayed}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{player.matchesWon}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {player.matchesPlayed > 0
                  ? Math.round((player.matchesWon / player.matchesPlayed) * 100)
                  : 0}%
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {(player.avgReactionTime / 1000).toFixed(1)}s
              </Text>
              <Text style={styles.statLabel}>Avg Speed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                🔥 {player.currentStreak}
              </Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{player.bestStreak}</Text>
              <Text style={styles.statLabel}>Best Streak</Text>
            </View>
          </View>
        </View>

        {/* Ratings by Role */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>RATINGS BY ROLE</Text>
          {sortedRoles.map(({ role, rating }) => {
            const rankTitle = getRankTitle(rating);
            const rankColor = getRankColor(rating);
            const isPrimary = role === player.primaryRole;
            return (
              <View key={role} style={styles.ratingRow}>
                <View style={styles.ratingInfo}>
                  <Text style={[styles.ratingRole, isPrimary && { color: colors.primary }]}>
                    {role}
                    {isPrimary && ' ⭐'}
                  </Text>
                  <Text style={[styles.ratingRank, { color: rankColor }]}>
                    {rankTitle}
                  </Text>
                </View>
                <Text style={[styles.ratingNumber, { color: rankColor }]}>
                  {rating}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Badges */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BADGES</Text>
          {player.badges.length > 0 ? (
            <View style={styles.badgeGrid}>
              {player.badges.map((badge) => (
                <View key={badge.id} style={styles.badgeItem}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={styles.badgeName}>{badge.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noBadges}>
              <Text style={styles.noBadgesEmoji}>🏅</Text>
              <Text style={styles.noBadgesText}>
                Play matches to earn badges!
              </Text>
            </View>
          )}
        </View>

        {/* Wallet Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>WALLET</Text>
          <View style={styles.walletRow}>
            <Text style={styles.walletLabel}>Address</Text>
            <Text style={styles.walletValue}>
              {player.walletAddress.slice(0, 4)}...{player.walletAddress.slice(-4)}
            </Text>
          </View>
          {walletBalance && (
            <>
              <View style={styles.walletRow}>
                <Text style={styles.walletLabel}>SOL Balance</Text>
                <Text style={[styles.walletValue, { color: colors.primary }]}>
                  ◎ {walletBalance.sol.toFixed(4)}
                </Text>
              </View>
              {walletBalance.skr > 0 && (
                <View style={styles.walletRow}>
                  <Text style={styles.walletLabel}>SKR Balance</Text>
                  <Text style={[styles.walletValue, { color: colors.purple }]}>
                    💎 {walletBalance.skr.toLocaleString()}
                  </Text>
                </View>
              )}
            </>
          )}
          {onDisconnect && (
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={onDisconnect}
              activeOpacity={0.7}
            >
              <Text style={styles.disconnectText}>Disconnect Wallet</Text>
            </TouchableOpacity>
          )}

          {/* Join Champions Simulation */}
          {!player.isSkrStaker && walletBalance && walletBalance.skr > 0 && onUpdatePlayer && (
            <TouchableOpacity
              style={styles.stakeButton}
              onPress={() => onUpdatePlayer({ isSkrStaker: true })}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8A2BE2', '#4B0082']}
                style={styles.stakeGradient}
              >
                <Text style={styles.stakeText}>💎 Join Seeker Champions</Text>
                <Text style={styles.stakeSub}>Stake your SKR for 1.5x XP</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('home')}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('leaderboard')}>
          <Text style={styles.navIcon}>🏆</Text>
          <Text style={styles.navLabel}>Ranks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('quests')}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navLabel}>Quests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('history')}>
          <Text style={styles.navIcon}>⚔️</Text>
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Text style={[styles.navIcon, styles.navActive]}>👤</Text>
          <Text style={[styles.navLabel, styles.navActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
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
  },
  content: {
    padding: spacing.lg,
    paddingTop: 56,
    paddingBottom: 20,
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  username: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
    marginTop: spacing.md,
  },
  seekerId: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  skrStakerBadge: {
    backgroundColor: colors.purpleDim,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  skrStakerText: {
    fontSize: fontSize.xs,
    color: colors.purple,
    fontWeight: fontWeight.semibold,
  },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },

  // Level
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  levelLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  levelValue: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  xpBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  xpText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  totalXp: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 2,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statBox: {
    width: '30%',
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Ratings
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ratingInfo: {
    flex: 1,
  },
  ratingRole: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  ratingRank: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  ratingNumber: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
  },

  // Badges
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  badgeItem: {
    alignItems: 'center',
    width: 72,
  },
  badgeIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  badgeName: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  noBadges: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  noBadgesEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  noBadgesText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Wallet
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  walletLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  walletValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  disconnectButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center' as const,
  },
  disconnectText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: fontWeight.semibold,
  },
  stakeButton: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  stakeGradient: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  stakeText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  stakeSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 4,
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
