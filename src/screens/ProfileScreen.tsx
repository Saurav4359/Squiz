import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Linking,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { colors, spacing, borderRadius as radius } from '../config/theme';
import { Player } from '../types';
import { getLeaderboard } from '../services/db/database';
import {
  getRankTitle,
  calculateLevel,
  getXPForNextLevel,
} from '../services/matchmaking/ratingSystem';

interface ProfileScreenProps {
  player: Player;
  onNavigate: (screen: string) => void;
  walletBalance?: { sol: number; skr: number };
  onDisconnect?: () => void;
  onUpdatePlayer?: (data: Partial<Player>) => Promise<void>;
  onUpdatePassword?: (newPassword: string) => Promise<void>;
}

export default function ProfileScreen({
  player,
  onNavigate,
  walletBalance,
  onDisconnect,
  onUpdatePlayer,
  onUpdatePassword,
}: ProfileScreenProps) {
  const XLogo = () => (
    <Svg viewBox="0 0 16 16" width={12} height={12}>
      <Path
        d="M12.6 0.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867 -5.07 -4.425 5.07H0.316l5.733 -6.57L0 0.75h5.063l3.495 4.633L12.601 0.75Zm-0.86 13.028h1.36L4.323 2.145H2.865z"
        fill="#FFFFFF"
      />
    </Svg>
  );

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [arenaRank, setArenaRank] = useState<string>('--');

  const level = calculateLevel(player.xp);
  const xpProgress = getXPForNextLevel(player.xp);
  const rankTitle = getRankTitle(player.rating);
  const winRate = player.matchesPlayed > 0 ? Math.round((player.matchesWon / player.matchesPlayed) * 100) : 0;

  const getRankAccent = (title: string) => {
    if (title === 'Diamond Squiz') return '#EF4444';
    if (title === 'Alpha Ape') return '#A855F7';
    if (title === 'Solana Samurai') return '#FACC15';
    if (title === 'Sol Titan') return '#9BEA3C';
    if (title === 'Chain Challenger') return '#60A5FA';
    return '#9CA3AF';
  };

  const rankAccent = getRankAccent(rankTitle);
  const streakDays = Math.max(1, Number(player.currentStreak || 0));
  const streakLabel = `${streakDays} ${streakDays === 1 ? 'Day' : 'Days'} Streak`;

  useEffect(() => {
    let mounted = true;

    const loadArenaRank = async () => {
      try {
        const leaderboard = await getLeaderboard();
        const me = leaderboard.find((entry: any) => String(entry.playerId) === String(player.id));
        if (mounted) {
          setArenaRank(me?.rank ? `#${me.rank}` : '--');
        }
      } catch {
        if (mounted) setArenaRank('--');
      }
    };

    loadArenaRank();

    return () => {
      mounted = false;
    };
  }, [player.id]);

  const handleShareProfile = async () => {
    const message = [
      `Squiz Arena Card`,
      `${player.username}`,
      `${rankTitle} ⚔`,
      `${Math.round(player.rating)} Rating`,
      `${player.matchesPlayed} Matches`,
      `${winRate}% Win Rate`,
    ].join('\n');

    try {
      await Share.share({ message });
    } catch (err) {
      console.warn('[Profile] Share failed:', err);
    }
  };

  const shareCardRef = React.useRef<ViewShot | null>(null);

  const captureShareCard = async (): Promise<string | null> => {
    if (!shareCardRef.current) return null;
    const uri = await shareCardRef.current.capture?.();
    return uri || null;
  };

  const handleShareCardImage = async () => {
    if (!shareCardRef.current || isSharingImage) return;
    setIsSharingImage(true);
    try {
      const uri = await captureShareCard();
      if (!uri) throw new Error('Capture failed');

      const canShareFile = await Sharing.isAvailableAsync();
      if (canShareFile) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Share Arena Card',
          mimeType: 'image/png',
        });
      } else {
        await Share.share({
          message: `${player.username} • ${rankTitle} • ${Math.round(player.rating)} Rating`,
          url: uri,
        });
      }
    } catch (err) {
      console.warn('[Profile] Share image failed:', err);
      // Fallback to text-only sharing if image capture/share fails.
      await handleShareProfile();
    } finally {
      setIsSharingImage(false);
    }
  };

  const openTwitter = async (handle: string) => {
    const clean = handle.replace(/^@/, '');
    const url = `https://x.com/${clean}`;
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.warn('[Profile] Open twitter failed:', err);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarInner}>
            <Text style={styles.avatarText}>{player.username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.titleText}>{player.username}</Text>
          <View style={styles.rankHeroBadge}>
            <Text style={[styles.rankHeroText, { color: rankAccent }]}>{rankTitle} ⚔</Text>
          </View>
          <Text style={styles.heroRatingText}>{Math.round(player.rating)} Rating</Text>
          {player.twitter && (
            <Pressable style={styles.twitterRow} onPress={() => openTwitter(player.twitter || '')}>
              <XLogo />
              <Text style={styles.twitterHandle}>@{player.twitter.replace(/^@/, '')}</Text>
            </Pressable>
          )}

          <View style={styles.quickStatsRow}>
            <View style={styles.quickPill}><Text style={styles.quickPillText}>🔥 {streakLabel}</Text></View>
            <View style={styles.quickPill}><Text style={styles.quickPillText}>⚔ {player.matchesPlayed} Battles</Text></View>
            <View style={styles.quickPill}><Text style={styles.quickPillText}>🏆 Rank {arenaRank}</Text></View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Level {level}</Text>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xpProgress.progress * 100}%` }]} />
          </View>
          <Text style={styles.bodyText}>{xpProgress.current.toFixed(1)} / {xpProgress.required} XP</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsCol}>
              <Text style={styles.valueText}>{player.matchesPlayed}</Text>
              <Text style={styles.bodyText}>Matches</Text>
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.valueText}>{player.matchesWon}</Text>
              <Text style={styles.bodyText}>Wins</Text>
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.valueText}>{winRate}%</Text>
              <Text style={styles.bodyText}>Win Rate</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rank</Text>
          <Text style={[styles.valueText, { color: rankAccent }]}>{rankTitle} ⚔</Text>
          <Text style={[styles.bodyText, { marginTop: 4 }]}>{Math.round(player.rating)} Rating</Text>
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={() => setIsShareCardOpen(true)} activeOpacity={0.85}>
          <Text style={styles.shareButtonText}>Share Arena Card</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wallet</Text>
          <View style={styles.rowBetween}><Text style={styles.bodyText}>Address</Text><Text style={styles.bodyText}>{player.walletAddress.slice(0, 4)}...{player.walletAddress.slice(-4)}</Text></View>
          {walletBalance && (
            <>
              <View style={styles.rowBetween}><Text style={styles.bodyText}>SOL</Text><Text style={styles.valueText}>◎ {walletBalance.sol}</Text></View>
              {walletBalance.skr > 0 && <View style={styles.rowBetween}><Text style={styles.bodyText}>SKR</Text><Text style={[styles.valueText, { color: colors.accent }]}>💎 {walletBalance.skr.toLocaleString()}</Text></View>}
            </>
          )}
          {onDisconnect && (
            <TouchableOpacity style={styles.secondaryButton} onPress={onDisconnect} activeOpacity={0.8}>
              <Text style={styles.secondaryText}>Disconnect Wallet</Text>
            </TouchableOpacity>
          )}
        </View>

        {onUpdatePassword && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Security</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setIsChangingPassword(true)} activeOpacity={0.8}>
              <Text style={styles.secondaryText}>Change Password</Text>
            </TouchableOpacity>
          </View>
        )}

        {!player.isSkrStaker && walletBalance && walletBalance.skr > 0 && onUpdatePlayer && (
          <TouchableOpacity style={styles.secondaryButtonCard} onPress={() => onUpdatePlayer({ isSkrStaker: true })} activeOpacity={0.8}>
            <Text style={styles.secondaryText}>Join Squiz Champions</Text>
            <Text style={styles.bodyText}>Stake your SKR for 1.5x XP</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={isChangingPassword} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.cardTitle}>Change Password</Text>
            <Text style={styles.bodyText}>Set a new password for account recovery.</Text>
            <TextInput
              style={styles.passwordInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setIsChangingPassword(false); setNewPassword(''); }}>
                <Text style={styles.bodyText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, newPassword.length < 6 && { opacity: 0.5 }]}
                disabled={newPassword.length < 6}
                onPress={async () => {
                  if (onUpdatePassword) {
                    await onUpdatePassword(newPassword);
                    setIsChangingPassword(false);
                    setNewPassword('');
                    Alert.alert('Success', 'Password updated successfully!');
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isShareCardOpen} transparent animationType="fade">
        <View style={styles.shareModalOverlay}>
          <View style={styles.shareModalContent}>
            <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
              <View style={styles.shareCard}>
                <View style={[styles.shareCardGlow, { backgroundColor: rankAccent }]} />
                <Text style={styles.shareCardBrand}>SQUIZ</Text>
                <Text style={styles.shareCardName}>{player.username}</Text>
                <Text style={[styles.shareCardRank, { color: rankAccent }]}>{rankTitle} ⚔</Text>
                <Text style={styles.shareCardRating}>{Math.round(player.rating)} Rating</Text>
                <View style={styles.shareCardStatsRow}>
                  <View style={styles.shareCardStat}>
                    <Text style={styles.shareCardStatValue}>{player.matchesPlayed}</Text>
                    <Text style={styles.shareCardStatLabel}>Matches</Text>
                  </View>
                  <View style={styles.shareCardStat}>
                    <Text style={styles.shareCardStatValue}>{winRate}%</Text>
                    <Text style={styles.shareCardStatLabel}>Win Rate</Text>
                  </View>
                  <View style={styles.shareCardStat}>
                    <Text style={styles.shareCardStatValue}>{streakDays}</Text>
                    <Text style={styles.shareCardStatLabel}>Day Streak</Text>
                  </View>
                </View>
                <View style={styles.shareCardStatsRow}>
                  <View style={styles.shareCardStat}>
                    <Text style={styles.shareCardStatValue}>{player.matchesWon}</Text>
                    <Text style={styles.shareCardStatLabel}>Wins</Text>
                  </View>
                  <View style={styles.shareCardStat}>
                    <Text style={styles.shareCardStatValue}>{arenaRank}</Text>
                    <Text style={styles.shareCardStatLabel}>Arena Rank</Text>
                  </View>
                  <View style={styles.shareCardStat}>
                    <Text style={styles.shareCardStatValue}>{level}</Text>
                    <Text style={styles.shareCardStatLabel}>Level</Text>
                  </View>
                </View>
                <Text style={styles.shareCardFooter}>#Squiz #Solana #Web3Gaming</Text>
              </View>
            </ViewShot>

            <View style={styles.shareModalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setIsShareCardOpen(false)}>
                <Text style={styles.bodyText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleShareCardImage} disabled={isSharingImage}>
                {isSharingImage ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalConfirmText}>Share Image</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollView: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 20 },
  profileHeader: { alignItems: 'center', marginBottom: spacing.lg },
  avatarInner: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: colors.text },
  titleText: { fontSize: 24, fontWeight: '700', color: colors.text },
  rankHeroBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  rankHeroText: { fontSize: 14, fontWeight: '700', color: colors.text },
  heroRatingText: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 8 },
  quickStatsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  quickPill: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickPillText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  twitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  twitterHandle: {
    fontSize: 14,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  bodyText: { fontSize: 14, color: colors.textSecondary },
  valueText: { fontSize: 18, fontWeight: '600', color: colors.text },
  card: { ...cardBase, marginBottom: spacing.lg },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  xpBarBg: { height: 8, backgroundColor: colors.bgSecondary, borderRadius: 18, overflow: 'hidden', marginVertical: spacing.sm },
  xpBarFill: { height: '100%', backgroundColor: '#9FE870' },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsCol: {
    flex: 1,
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  shareButtonText: { color: '#000', fontSize: 16, fontWeight: '700' },
  secondaryButtonCard: { ...cardBase, borderColor: colors.accent, marginBottom: spacing.lg, alignItems: 'center' },
  secondaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.bgCard,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modalContent: { ...cardBase, width: '100%' },
  passwordInput: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 18,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  modalCancel: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  modalConfirm: { flex: 1, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: 18, alignItems: 'center' },
  modalConfirmText: { color: '#000', fontSize: 14, fontWeight: '700' },
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  shareModalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareCard: {
    backgroundColor: '#0F1118',
    borderRadius: 16,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#202534',
  },
  shareCardGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.14,
    top: -90,
    right: -60,
  },
  shareCardBrand: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 10,
  },
  shareCardName: { fontSize: 24, fontWeight: '800', color: '#fff' },
  shareCardRank: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  shareCardRating: { fontSize: 14, color: '#E5E7EB', marginTop: 6 },
  shareCardStatsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  shareCardStat: {
    flex: 1,
    backgroundColor: '#151A24',
    borderWidth: 1,
    borderColor: '#252B3A',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  shareCardStatValue: { fontSize: 18, fontWeight: '700', color: '#fff' },
  shareCardStatLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  shareCardFooter: {
    marginTop: 14,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  shareModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
