import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Linking,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { LeaderboardEntry } from '../types';
import { getRankTitle } from '../services/matchmaking/ratingSystem';

interface LeaderboardScreenProps {
  entries: LeaderboardEntry[];
  currentPlayerId: string;
  onNavigate: (screen: string) => void;
  onViewProfile: (playerId: string) => void;
  onRefresh: () => void;
}

export default function LeaderboardScreen({
  entries,
  currentPlayerId,
  onNavigate,
  onViewProfile,
  onRefresh,
}: LeaderboardScreenProps) {
  const XLogo = () => (
    <Svg viewBox="0 0 16 16" width={12} height={12}>
      <Path
        d="M12.6 0.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867 -5.07 -4.425 5.07H0.316l5.733 -6.57L0 0.75h5.063l3.495 4.633L12.601 0.75Zm-0.86 13.028h1.36L4.323 2.145H2.865z"
        fill="#FFFFFF"
      />
    </Svg>
  );

  const [selectedTab, setSelectedTab] = useState<'global' | 'skr'>('global');
  const [refreshing, setRefreshing] = useState(false);

  const filteredEntries = useMemo(() => {
    const list = selectedTab === 'skr'
      ? entries.filter((e) => e.isSkrStaker)
      : entries;
    return list.sort((a, b) => b.rating - a.rating);
  }, [entries, selectedTab]);

  const allEntries = filteredEntries;

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 1500);
  }, [onRefresh]);

  const openTwitter = React.useCallback(async (handle: string) => {
    const clean = handle.replace(/^@/, '');
    const url = `https://x.com/${clean}`;
    try {
      await Linking.openURL(url);
    } catch {
      // ignore silently for now to keep UI flow simple
    }
  }, []);

  const renderEntry = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isMe = item.playerId === currentPlayerId;
    const displayRank = index + 1;
    const rankTitle = getRankTitle(item.rating);
    const twitterHandle = item.twitter ? `@${String(item.twitter).replace(/^@/, '')}` : null;
    const metaText =
      item.winRate > 0
        ? `${item.winRate}% WR`
        : item.matchesPlayed > 0
        ? `${item.matchesPlayed} matches`
        : '';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.entryRow,
          isMe && styles.entryRowMe,
          pressed && styles.entryRowPressed,
        ]}
        onPress={() => onViewProfile(item.playerId)}
      >
        <View style={styles.rankCol}>
          <Text style={styles.rankText}>#{displayRank}</Text>
        </View>

        <View style={styles.playerCol}>
          <View style={styles.playerNameRow}>
            <Text style={[styles.playerName, isMe && styles.playerNameMe]}>{item.username}</Text>
          </View>
          {twitterHandle ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                openTwitter(twitterHandle);
              }}
              style={styles.twitterRow}
            >
              <XLogo />
              <Text style={styles.twitterHandle}>{twitterHandle}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.ratingCol}>
          <Text style={styles.rankTitleText}>{rankTitle}</Text>
          <Text style={styles.ratingValue}>{item.rating}</Text>
          {metaText ? <Text style={styles.ratingLabel}>{metaText}</Text> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Seeker Ranks</Text>
          <Text style={styles.headerSub}>Arena Champions</Text>
        </View>
      </View>

      {/* Control Panel */}
      <View style={styles.controlPanel}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'global' && styles.tabActive]}
            onPress={() => setSelectedTab('global')}
          >
            <Text style={[styles.tabText, selectedTab === 'global' && styles.tabTextActive]}>Global</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'skr' && styles.tabActive]}
            onPress={() => setSelectedTab('skr')}
          >
            <Text style={[styles.tabText, selectedTab === 'skr' && styles.tabTextActive]}>💎 Champions</Text>
          </TouchableOpacity>
        </View>

        {/* Single global leaderboard now, no role filter */}
      </View>

      {/* List */}
      <FlatList
        data={allEntries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.playerId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{selectedTab === 'skr' ? '💎' : '🏜️'}</Text>
            <Text style={styles.emptyText}>{selectedTab === 'skr' ? 'No Staking Champions Yet' : 'Ranking Commencing...'}</Text>
            <Text style={styles.emptySub}>Be the first to claim a rank!</Text>
          </View>
        }
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', marginBottom: 18, paddingTop: 52 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: 0.6 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  
  // Podium removed

  // Control Panel
  controlPanel: { paddingHorizontal: 16 },
  tabRow: { flexDirection: 'row', backgroundColor: colors.bgElevated, borderRadius: 16, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: colors.bgCard },
  tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.text, fontWeight: 'bold' },
  roleScroll: { marginBottom: 16 },
  roleChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  roleChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  roleChipText: { fontSize: 12, color: colors.textSecondary },
  roleChipTextActive: { color: colors.primary, fontWeight: 'bold' },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 16,
    height: 78,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A1A1AA',
  },
  entryRowPressed: {
    transform: [{ scale: 1.02 }],
  },
  entryRowMe: {
    borderColor: '#9FE870',
    borderWidth: 1.5,
    backgroundColor: '#14181A',
    shadowColor: '#9FE870',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  rankCol: { width: 44, alignItems: 'flex-start' },
  rankText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
  playerCol: { flex: 1, marginLeft: 12 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  playerName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  playerNameMe: { color: colors.primary },
  twitterHandle: {
    fontSize: 12,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  twitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rankTitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.accent,
    marginBottom: 2,
  },
  ratingCol: { alignItems: 'flex-end', minWidth: 118 },
  ratingValue: { fontSize: 16, fontWeight: '700', color: colors.primary },
  ratingLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: 'bold' },
  emptySub: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },

  bottomNav: { position: 'absolute', bottom: 30, left: 20, right: 20, flexDirection: 'row', height: 60, backgroundColor: colors.bgElevated, borderRadius: 30, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  navItem: { flex: 1, alignItems: 'center' },
  navIcon: { fontSize: 24, color: colors.textSecondary },
  navActive: { color: colors.primary },
});
