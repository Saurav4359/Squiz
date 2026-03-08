import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius as radius } from '../config/theme';
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
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const level = calculateLevel(player.xp);
  const xpProgress = getXPForNextLevel(player.xp);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarInner}>
            <Text style={styles.avatarText}>{player.username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.titleText}>{player.username}</Text>
          <Text style={styles.bodyText}>Seeker #{player.seekerId}</Text>
          {player.twitter && <Text style={[styles.bodyText, { color: colors.accent }]}>@{player.twitter.replace(/^@/, '')}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Level</Text>
          <Text style={styles.valueText}>{level}</Text>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xpProgress.progress * 100}%` }]} />
          </View>
          <Text style={styles.bodyText}>{xpProgress.current} / {xpProgress.required} XP</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stats</Text>
          <View style={styles.rowBetween}><Text style={styles.bodyText}>Matches</Text><Text style={styles.valueText}>{player.matchesPlayed}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.bodyText}>Wins</Text><Text style={styles.valueText}>{player.matchesWon}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.bodyText}>Win Rate</Text><Text style={styles.valueText}>{player.matchesPlayed > 0 ? Math.round((player.matchesWon / player.matchesPlayed) * 100) : 0}%</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rank</Text>
          <View style={styles.rowBetween}>
            <Text style={[styles.bodyText, { color: getRankColor(player.rating) }]}>{getRankTitle(player.rating)}</Text>
            <Text style={styles.valueText}>{Math.round(player.rating)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wallet</Text>
          <View style={styles.rowBetween}><Text style={styles.bodyText}>Address</Text><Text style={styles.bodyText}>{player.walletAddress.slice(0, 4)}...{player.walletAddress.slice(-4)}</Text></View>
          {walletBalance && (
            <>
              <View style={styles.rowBetween}><Text style={styles.bodyText}>SOL</Text><Text style={styles.valueText}>◎ {walletBalance.sol.toFixed(4)}</Text></View>
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
            <Text style={styles.secondaryText}>Join Seeker Champions</Text>
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
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: colors.text },
  titleText: { fontSize: 24, fontWeight: '700', color: colors.text },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  bodyText: { fontSize: 14, color: colors.textSecondary },
  valueText: { fontSize: 18, fontWeight: '600', color: colors.text },
  card: { ...cardBase, marginBottom: spacing.lg },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  xpBarBg: { height: 8, backgroundColor: colors.bgSecondary, borderRadius: 18, overflow: 'hidden', marginVertical: spacing.sm },
  xpBarFill: { height: '100%', backgroundColor: colors.primary },
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
});
