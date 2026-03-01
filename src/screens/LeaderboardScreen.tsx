import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { ROLES, UserRole } from '../config/constants';
import { LeaderboardEntry } from '../types';
import { getRankTitle, getRankColor } from '../services/matchmaking/ratingSystem';

interface LeaderboardScreenProps {
  entries: LeaderboardEntry[];
  currentPlayerId: string;
  onNavigate: (screen: string) => void;
  onRoleChange: (role: UserRole) => void;
}

export default function LeaderboardScreen({
  entries,
  currentPlayerId,
  onNavigate,
  onRoleChange,
}: LeaderboardScreenProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('Trader');
  const [selectedTab, setSelectedTab] = useState<'global' | 'skr'>('global');

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    onRoleChange(role);
  };

  const filteredEntries =
    selectedTab === 'skr'
      ? entries.filter((e) => e.isSkrStaker)
      : entries;

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}`;
  };

  const renderEntry = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isMe = item.playerId === currentPlayerId;
    const rankColor = getRankColor(item.rating);

    return (
      <View
        style={[
          styles.entryRow,
          isMe && styles.entryRowMe,
          index < 3 && styles.entryRowTop3,
        ]}
      >
        <View style={styles.rankCol}>
          <Text
            style={[
              styles.rankText,
              index < 3 && styles.rankTextTop3,
            ]}
          >
            {getMedalEmoji(item.rank)}
          </Text>
        </View>

        <View style={styles.playerCol}>
          <View style={styles.playerNameRow}>
            <Text style={[styles.playerName, isMe && styles.playerNameMe]}>
              {item.username}
            </Text>
            {item.isSkrStaker && <Text style={styles.skrBadge}>💎</Text>}
            {isMe && <Text style={styles.youBadge}>YOU</Text>}
          </View>
          <View style={styles.playerStatsRow}>
            <Text style={[styles.playerRank, { color: rankColor }]}>
              {getRankTitle(item.rating)}
            </Text>
            <Text style={styles.playerStatSep}>•</Text>
            <Text style={styles.playerStat}>{item.winRate}% WR</Text>
            <Text style={styles.playerStatSep}>•</Text>
            <Text style={styles.playerStat}>{item.matchesPlayed} games</Text>
          </View>
        </View>

        <View style={styles.ratingCol}>
          <Text style={[styles.ratingValue, { color: rankColor }]}>
            {item.rating}
          </Text>
          <Text style={styles.ratingLabel}>
            {(item.avgReactionTime / 1000).toFixed(1)}s avg
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Leaderboard</Text>
      </View>

      {/* Tabs: Global / SKR */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'global' && styles.tabActive]}
          onPress={() => setSelectedTab('global')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'global' && styles.tabTextActive,
            ]}
          >
            Global
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'skr' && styles.tabActive]}
          onPress={() => setSelectedTab('skr')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'skr' && styles.tabTextActive,
            ]}
          >
            💎 SKR Champions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Role filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.roleScroll}
        contentContainerStyle={styles.roleScrollContent}
      >
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role}
            style={[
              styles.roleChip,
              selectedRole === role && styles.roleChipActive,
            ]}
            onPress={() => handleRoleChange(role)}
          >
            <Text
              style={[
                styles.roleChipText,
                selectedRole === role && styles.roleChipTextActive,
              ]}
            >
              {role}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <FlatList
        data={filteredEntries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.playerId}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏜️</Text>
            <Text style={styles.emptyText}>No players yet</Text>
            <Text style={styles.emptySub}>Be the first to climb the ranks!</Text>
          </View>
        }
      />

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('home')}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Text style={[styles.navIcon, styles.navActive]}>🏆</Text>
          <Text style={[styles.navLabel, styles.navActive]}>Ranks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('quests')}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navLabel}>Quests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('history')}>
          <Text style={styles.navIcon}>⚔️</Text>
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('profile')}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>Profile</Text>
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
  header: {
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.bgCard,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: fontWeight.bold,
  },

  // Role chips
  roleScroll: {
    maxHeight: 40,
    marginBottom: spacing.md,
  },
  roleScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  roleChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleChipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  roleChipText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  roleChipTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },

  // List
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Entry row
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryRowMe: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  entryRowTop3: {
    borderColor: colors.goldDim,
  },
  rankCol: {
    width: 36,
    alignItems: 'center',
  },
  rankText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  rankTextTop3: {
    fontSize: fontSize.xl,
  },
  playerCol: {
    flex: 1,
    marginLeft: spacing.md,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  playerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  playerNameMe: {
    color: colors.primary,
  },
  skrBadge: {
    fontSize: 12,
  },
  youBadge: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    backgroundColor: colors.primaryDim,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  playerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: spacing.xs,
  },
  playerRank: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  playerStatSep: {
    fontSize: fontSize.xs,
    color: colors.textDim,
  },
  playerStat: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  ratingCol: {
    alignItems: 'flex-end',
  },
  ratingValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
  },
  ratingLabel: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: 1,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.huge,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  emptySub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
