import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../config/theme';
import { Player, DailyQuest } from '../types';
import { getRankTitle, calculateLevel, getXPForNextLevel } from '../services/matchmaking/ratingSystem';
import { getMatchStats } from '../services/matchmaking/matchStats';
import { subscribeActivePlayers } from '../services/matchmaking/livePresence';

interface HomeScreenProps {
  player: Player;
  onFindMatch: (wagerType: 'sol' | 'skr') => void;
  onNavigate: (screen: string) => void;
  dailyQuests: DailyQuest[];
}

export default function HomeScreen({ player, onFindMatch, onNavigate, dailyQuests }: HomeScreenProps) {
  const rating = player.rating || 1200;
  const rankTitle = getRankTitle(rating);
  const level = calculateLevel(player.xp);
  const xpProgress = getXPForNextLevel(player.xp);
  const [stats, setStats] = useState({ active: 0, sol: 0, skr: 0 });

  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      const nextStats = await getMatchStats();
      if (mounted) {
        setStats((prev) => ({ ...prev, sol: nextStats.sol, skr: nextStats.skr }));
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeActivePlayers((count) => {
      setStats((prev) => ({ ...prev, active: count }));
    });
    return unsub;
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.playerCardWrap}>
          <View style={styles.playerCardGlow} />
          <View style={styles.playerCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{player.username.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.usernameText}>{player.username}</Text>
                <View style={styles.ratingRow}>
                  <Text style={styles.rankText}>{rankTitle}</Text>
                  <Text style={styles.cardTitle}>{rating}</Text>
                </View>
              </View>
            </View>

            <View style={styles.xpBarBackground}>
              <View style={[styles.xpBarProgress, { width: `${xpProgress.progress * 100}%` }]} />
              <View
                style={[
                  styles.xpFlameWrap,
                  { left: `${Math.max(0, Math.min(100, xpProgress.progress * 100))}%` },
                ]}
              >
                <Ionicons name="flame" size={14} color="#FB923C" />
              </View>
            </View>
            <Text style={styles.xpText}>{xpProgress.current} / {xpProgress.required} XP • Level {level}</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statBadge}>
                <Ionicons name="people-outline" size={18} color="#22C55E" />
                <Text style={styles.statText} numberOfLines={1}>{stats.active} Active Users</Text>
              </View>
              <View style={styles.statBadge}>
                <Ionicons name="flash-outline" size={18} color="#FACC15" />
                <Text style={styles.statText} numberOfLines={1}>{stats.sol} SOL Matchmakers</Text>
              </View>
              <View style={styles.statBadge}>
                <Ionicons name="diamond-outline" size={18} color="#60A5FA" />
                <Text style={styles.statText} numberOfLines={1}>{stats.skr} SKR Matchmakers</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.findMatchButton} onPress={() => onFindMatch('sol')} activeOpacity={0.85}>
          <Text style={styles.findMatchText}>FIND MATCH</Text>
          <Text style={styles.findMatchSub}>0.05 SOL wager</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => onFindMatch('skr')} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonTitle}>SKR TOURNAMENT</Text>
          <Text style={styles.bodyText}>100 SKR wager • 1.5x XP</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Daily Quests</Text>
        {dailyQuests.map((quest) => (
          <View key={quest.id} style={styles.questCard}>
            <View style={styles.questHeader}>
              <Text style={styles.cardTitle}>{quest.title}</Text>
              <Text style={styles.bodyText}>+{quest.xpReward} XP</Text>
            </View>
            <View style={styles.questProgressBg}>
              <View
                style={[
                  styles.questProgressFill,
                  {
                    width: `${(quest.progress / quest.target) * 100}%`,
                    backgroundColor: quest.isCompleted ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.bodyText}>{quest.progress}/{quest.target}</Text>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const cardBase = {
  backgroundColor: colors.bgCard,
  borderRadius: 18,
  padding: 20,
  borderWidth: 1,
  borderColor: colors.border,
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1, paddingHorizontal: spacing.md },
  playerCardWrap: { marginTop: spacing.xxl, marginBottom: spacing.sm, position: 'relative' },
  playerCardGlow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 200,
    backgroundColor: '#D0FF80',
    opacity: 0.08,
    top: -80,
    right: -60,
  },
  playerCard: {
    backgroundColor: '#18181B',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    overflow: 'hidden',
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0B0F',
    borderWidth: 2,
    borderColor: '#D0FF80',
    shadowColor: '#D0FF80',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: colors.text },
  profileInfo: { marginLeft: 8, flex: 1 },
  usernameText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  rankText: { fontSize: 14, color: '#A1A1AA' },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  bodyText: { fontSize: 14, color: colors.textSecondary },
  ratingRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  xpBarBackground: {
    height: 8,
    borderRadius: 6,
    backgroundColor: '#27272A',
    overflow: 'hidden',
    marginBottom: 6,
  },
  xpBarProgress: {
    height: 8,
    borderRadius: 6,
    backgroundColor: '#D0FF80',
    shadowColor: '#D0FF80',
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  xpFlameWrap: {
    position: 'absolute',
    top: -4,
    marginLeft: -7,
  },
  xpText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  statsContainer: {
    flexDirection: 'column',
    marginTop: 10,
  },
  statBadge: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
    backgroundColor: '#101014',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statText: { color: '#FFFFFF', fontSize: 12, marginLeft: 6, flexShrink: 1 },
  findMatchButton: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    marginBottom: spacing.md,
  },
  findMatchText: { color: '#000', fontSize: 20, fontWeight: '700' },
  findMatchSub: { fontSize: 14, color: '#000', marginTop: 4 },
  secondaryButton: {
    ...cardBase,
    borderColor: colors.accent,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonTitle: { fontSize: 18, fontWeight: '600', color: colors.accent, marginBottom: 4 },
  questCard: { ...cardBase, marginBottom: spacing.md },
  questHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, alignItems: 'center' },
  questProgressBg: { height: 8, borderRadius: 18, backgroundColor: colors.bgSecondary, overflow: 'hidden', marginBottom: spacing.sm },
  questProgressFill: { height: '100%', borderRadius: 18 },
});
