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
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, fontWeight, borderRadius as radius } from '../config/theme';
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
  onUpdatePassword?: (newPassword: string) => Promise<void>;
}

export default function ProfileScreen({ 
  player, 
  onNavigate, 
  walletBalance, 
  onDisconnect, 
  onUpdatePlayer,
  onUpdatePassword 
}: ProfileScreenProps) {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  
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
          {player.twitter && (
            <Text style={styles.twitterHandle}>@{player.twitter.replace(/^@/, '')}</Text>
          )}

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
              <Text style={styles.statValue}>
                {player.matchesPlayed > 0 
                  ? Math.round((player.matchesWon / player.matchesPlayed) * 100) 
                  : 0}%
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
          </View>
        </View>

        {/* Rank Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ROLE RANKINGS</Text>
          {sortedRoles.map(({ role, rating }) => (
            <View key={role} style={styles.roleRow}>
              <View>
                <Text style={styles.roleName}>{role}</Text>
                <Text style={[styles.rankTitle, { color: getRankColor(rating) }]}>
                  {getRankTitle(rating)}
                </Text>
              </View>
              <Text style={styles.ratingValue}>{Math.round(rating)}</Text>
            </View>
          ))}
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
        </View>

        {/* Security Section (Only for self) */}
        {onUpdatePassword && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SECURITY</Text>
            <View style={styles.walletRow}>
              <Text style={styles.walletLabel}>Identity</Text>
              <Text style={styles.walletValue}>Protected by Wallet & Password</Text>
            </View>
            <TouchableOpacity
              style={styles.changePasswordButton}
              onPress={() => setIsChangingPassword(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.changePasswordText}>Change Password</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Staking / Missions */}
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
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={isChangingPassword}
        transparent
        animationType="fade"
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>CHANGE PASSWORD</Text>
            <Text style={styles.modalSubtitle}>
              Set a secret password to recover your profile on other devices.
            </Text>

            <TextInput
              style={styles.passwordInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New secret password..."
              placeholderTextColor={colors.textDim}
              secureTextEntry
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancel}
                onPress={() => {
                  setIsChangingPassword(false);
                  setNewPassword('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.modalConfirm,
                  newPassword.length < 6 && { opacity: 0.5 }
                ]}
                disabled={newPassword.length < 6}
                onPress={async () => {
                  if (onUpdatePassword) {
                    await onUpdatePassword(newPassword);
                    setIsChangingPassword(false);
                    setNewPassword('');
                    Alert.alert("Success", "Password updated successfully!");
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
    paddingTop: 60,
    paddingBottom: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    marginBottom: spacing.md,
  },
  avatarInner: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  username: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  seekerId: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  twitterHandle: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    marginTop: 4,
  },
  skrStakerBadge: {
    backgroundColor: colors.purple + '22',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.purple + '44',
  },
  skrStakerText: {
    color: colors.purple,
    fontSize: 12,
    fontWeight: fontWeight.bold,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.textDim,
    letterSpacing: 1.5,
    marginBottom: spacing.lg,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  levelLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  levelValue: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  xpBarBg: {
    height: 10,
    backgroundColor: colors.bg,
    borderRadius: 5,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  xpText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  totalXp: {
    fontSize: 10,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  roleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  roleName: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  rankTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  walletLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  walletValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  disconnectButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#ff444444',
    borderRadius: radius.md,
    alignItems: 'center',
  },
  disconnectText: {
    color: '#ff4444',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  stakeButton: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  stakeGradient: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  stakeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  stakeSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  changePasswordButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + '44',
    borderRadius: radius.md,
    alignItems: 'center',
  },
  changePasswordText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.primary + '22',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  passwordInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textDim,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  modalConfirm: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: colors.bg,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
});
