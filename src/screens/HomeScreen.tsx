import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { colors, spacing, borderRadius } from '../config/theme';
import { Player, DailyQuest } from '../types';
import { getRankTitle, getRankColor, calculateLevel, getXPForNextLevel } from '../services/matchmaking/ratingSystem';
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
  const rankColor = getRankColor(rating);
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
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{player.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.screenTitle}>{player.username}</Text>
              <View style={styles.ratingRow}>
                <Text style={[styles.bodyText, { color: rankColor }]}>{rankTitle}</Text>
                <Text style={styles.cardTitle}>{rating}</Text>
              </View>
            </View>
          </View>

          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xpProgress.progress * 100}%` }]} />
          </View>
          <Text style={styles.bodyText}>{xpProgress.current} / {xpProgress.required} XP • Level {level}</Text>

          <View style={styles.statsBar}>
            <View style={styles.statCard}><Text style={styles.bodyText}>🟢 {stats.active} Online</Text></View>
            <View style={styles.statCard}><Text style={styles.bodyText}>⚡ {stats.sol} SOL Battles</Text></View>
            <View style={styles.statCard}><Text style={styles.bodyText}>💎 {stats.skr} SKR Battles</Text></View>
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

        <Text style={styles.screenTitle}>Daily Quests</Text>
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
  scrollView: { flex: 1, paddingHorizontal: spacing.lg },
  profileCard: { ...cardBase, marginTop: spacing.xxl + 20, marginBottom: spacing.md },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: colors.text },
  profileInfo: { marginLeft: spacing.md, flex: 1 },
  screenTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  bodyText: { fontSize: 14, color: colors.textSecondary },
  ratingRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  xpBarBg: {
    height: 8,
    borderRadius: 18,
    backgroundColor: colors.bgSecondary,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  xpBarFill: { height: '100%', backgroundColor: colors.primary },
  statsBar: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: 18,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
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
