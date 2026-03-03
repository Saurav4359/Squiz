import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { ROLES, UserRole } from '../config/constants';
import { LeaderboardEntry } from '../types';
import { getRankTitle, getRankColor } from '../services/matchmaking/ratingSystem';

interface LeaderboardScreenProps {
  entries: LeaderboardEntry[];
  currentPlayerId: string;
  selectedRole: UserRole;
  onNavigate: (screen: string) => void;
  onRoleChange: (role: UserRole) => void;
}

export default function LeaderboardScreen({
  entries,
  currentPlayerId,
  selectedRole,
  onNavigate,
  onRoleChange,
}: LeaderboardScreenProps) {
  const [selectedTab, setSelectedTab] = useState<'global' | 'skr'>('global');
  const [refreshing, setRefreshing] = useState(false);

  const handleRoleChange = (role: UserRole) => {
    onRoleChange(role);
  };

  const filteredEntries = useMemo(() => {
    const list = selectedTab === 'skr'
      ? entries.filter((e) => e.isSkrStaker)
      : entries;
    return list.sort((a, b) => b.rating - a.rating);
  }, [entries, selectedTab]);

  const allEntries = filteredEntries;

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    onRoleChange(selectedRole);
    setTimeout(() => setRefreshing(false), 1500);
  }, [selectedRole, onRoleChange]);

  const renderEntry = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isMe = item.playerId === currentPlayerId;
    const rankColor = getRankColor(item.rating);
    const displayRank = index + 1;

    return (
      <View style={[styles.entryRow, isMe && styles.entryRowMe]}>
        <View style={styles.rankCol}>
          <Text style={styles.rankText}>{displayRank}</Text>
        </View>

        <View style={styles.playerCol}>
          <View style={styles.playerNameRow}>
            <Text style={[styles.playerName, isMe && styles.playerNameMe]}>{item.username}</Text>
            {item.isSkrStaker && <Text style={styles.skrBadge}>💎</Text>}
          </View>
          <Text style={[styles.playerRank, { color: rankColor }]}>{getRankTitle(item.rating)}</Text>
        </View>

        <View style={styles.ratingCol}>
          <Text style={[styles.ratingValue, { color: rankColor }]}>{item.rating}</Text>
          <Text style={styles.ratingLabel}>{item.winRate}% WR</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.primary, colors.bg]} style={styles.headerGradient}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Seeker Ranks</Text>
          <Text style={styles.headerSub}>Compete for the ultimate title</Text>
        </View>
      </LinearGradient>

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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleScroll}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.roleChip, selectedRole === role && styles.roleChipActive]}
              onPress={() => handleRoleChange(role)}
            >
              <Text style={[styles.roleChipText, selectedRole === role && styles.roleChipTextActive]}>{role}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={allEntries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.playerId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{selectedTab === 'skr' ? '💎' : '🏜️'}</Text>
            <Text style={styles.emptyText}>{selectedTab === 'skr' ? 'No Staking Champions Yet' : 'Ranking Commencing...'}</Text>
            <Text style={styles.emptySub}>Be the first to claim a rank!</Text>
          </View>
        }
      />

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('home')}>
          <Text style={styles.navIcon}>🏠</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Text style={[styles.navIcon, styles.navActive]}>🏆</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('quests')}>
          <Text style={styles.navIcon}>📋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('profile')}>
          <Text style={styles.navIcon}>👤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerGradient: { paddingTop: 60, paddingBottom: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  header: { alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  
  // Podium removed

  // Control Panel
  controlPanel: { marginTop: -20, paddingHorizontal: 20 },
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
  list: { padding: 20, paddingBottom: 100 },
  entryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  entryRowMe: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  rankCol: { width: 30 },
  rankText: { color: colors.textSecondary, fontWeight: 'bold' },
  playerCol: { flex: 1, marginLeft: 12 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  playerNameMe: { color: colors.primary },
  playerRank: { fontSize: 11, marginTop: 2 },
  skrBadge: { fontSize: 10 },
  ratingCol: { alignItems: 'flex-end' },
  ratingValue: { fontSize: 18, fontWeight: '900' },
  ratingLabel: { fontSize: 10, color: colors.textDim, marginTop: 2 },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: 'bold' },
  emptySub: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },

  bottomNav: { position: 'absolute', bottom: 30, left: 20, right: 20, flexDirection: 'row', height: 60, backgroundColor: colors.bgElevated, borderRadius: 30, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  navItem: { flex: 1, alignItems: 'center' },
  navIcon: { fontSize: 24, color: colors.textSecondary },
  navActive: { color: colors.primary },
});
