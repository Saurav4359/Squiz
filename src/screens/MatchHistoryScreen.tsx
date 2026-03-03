import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { Match } from '../types';
import { getMatchHistory } from '../services/db/neon';

interface MatchHistoryScreenProps {
  playerId: string;
  onNavigate: (screen: string) => void;
}

export default function MatchHistoryScreen({ playerId, onNavigate }: MatchHistoryScreenProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [playerId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const history = await getMatchHistory(playerId);
      setMatches(history as Match[]);
    } catch (e) {
      console.warn('[History] Fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };


  const getMatchResult = (match: Match) => {
    if (!match.winnerId) return 'draw';
    return match.winnerId === playerId ? 'win' : 'loss';
  };

  const getResultColor = (result: string) => {
    if (result === 'win') return colors.primary;
    if (result === 'loss') return colors.danger;
    return colors.textSecondary;
  };

  const getResultLabel = (result: string) => {
    if (result === 'win') return 'WIN';
    if (result === 'loss') return 'LOSS';
    return 'DRAW';
  };

  const getOpponent = (match: Match) => {
    return match.playerA.id === playerId ? match.playerB : match.playerA;
  };

  const getPlayerData = (match: Match) => {
    return match.playerA.id === playerId ? match.playerA : match.playerB;
  };

  const formatDate = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚔️ MATCH HISTORY</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>⚔️</Text>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptyText}>
              Play your first match to see history here
            </Text>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => onNavigate('home')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.playButtonGradient}
              >
                <Text style={styles.playButtonText}>FIND A MATCH</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.matchList}>
            {matches.map((match) => {
              const result = getMatchResult(match);
              const opponent = getOpponent(match);
              const playerData = getPlayerData(match);
              const resultColor = getResultColor(result);
              const correctAnswers = playerData.answers.filter(a => a.isCorrect).length;
              const accuracy = playerData.answers.length > 0
                ? Math.round((correctAnswers / playerData.answers.length) * 100)
                : 0;
              const avgReaction = playerData.answers.length > 0
                ? (playerData.answers.reduce((s, a) => s + a.reactionTimeMs, 0) / playerData.answers.length / 1000).toFixed(1)
                : '—';

              return (
                <View key={match.id} style={styles.matchCard}>
                  {/* Result indicator */}
                  <View style={[styles.resultBar, { backgroundColor: resultColor }]} />

                  <View style={styles.matchContent}>
                    {/* Header row */}
                    <View style={styles.matchHeader}>
                      <Text style={[styles.resultLabel, { color: resultColor }]}>
                        {getResultLabel(result)}
                      </Text>
                      <Text style={styles.matchDate}>{formatDate(match.endedAt)}</Text>
                    </View>

                    {/* Score row */}
                    <View style={styles.scoreRow}>
                      <View style={styles.scoreBox}>
                        <Text style={styles.scoreLabel}>You</Text>
                        <Text style={[styles.scoreNum, { color: resultColor }]}>
                          {playerData.score}
                        </Text>
                      </View>
                      <Text style={styles.scoreSep}>vs</Text>
                      <View style={styles.scoreBox}>
                        <Text style={styles.scoreLabel}>{opponent.username}</Text>
                        <Text style={styles.scoreNum}>{opponent.score}</Text>
                      </View>
                    </View>

                    {/* Stats row */}
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{accuracy}%</Text>
                        <Text style={styles.statLabel}>Accuracy</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{avgReaction}s</Text>
                        <Text style={styles.statLabel}>Avg Speed</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: resultColor }]}>
                          {result === 'win' ? '+' : result === 'loss' ? '-' : ''}
                          {(match.wagerLamports / (match.wagerType === 'skr' ? 1e6 : 1e9)).toFixed(2)} {match.wagerType?.toUpperCase() || 'SOL'}
                        </Text>
                        <Text style={styles.statLabel}>Outcome</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 80 }} />
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
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Text style={[styles.navIcon, styles.navActive]}>⚔️</Text>
          <Text style={[styles.navLabel, styles.navActive]}>History</Text>
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
  scroll: { flex: 1 },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    padding: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.lg,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.lg },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  playButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    width: 200,
  },
  playButtonGradient: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: colors.bg,
    letterSpacing: 2,
  },

  matchList: { padding: spacing.md, gap: spacing.sm },

  matchCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  resultBar: {
    width: 4,
  },
  matchContent: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  resultLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 1,
  },
  matchDate: {
    fontSize: fontSize.xs,
    color: colors.textDim,
  },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xl,
  },
  scoreBox: { alignItems: 'center' },
  scoreLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 2 },
  scoreNum: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  scoreSep: { fontSize: fontSize.sm, color: colors.textDim },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

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
