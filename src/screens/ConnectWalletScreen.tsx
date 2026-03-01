import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { ROLES, UserRole } from '../config/constants';

const { width } = Dimensions.get('window');

interface ConnectWalletScreenProps {
  onConnect: () => Promise<void>;
  onDevConnect: () => Promise<void>;
  onCreateProfile: (username: string, role: UserRole) => Promise<void>;
  connecting: boolean;
  isNewUser: boolean;
  walletAddress: string | null;
  shortAddress: string;
  error: string | null;
  loading: boolean;
}

export default function ConnectWalletScreen({
  onConnect,
  onDevConnect,
  onCreateProfile,
  connecting,
  isNewUser,
  walletAddress,
  shortAddress,
  error,
  loading,
}: ConnectWalletScreenProps) {
  const [username, setUsername] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Trader');
  const [devPressCount, setDevPressCount] = useState(0);

  // Animations
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Logo entrance
    Animated.sequence([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing rings
    const pulseRing = (ring: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(ring, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    pulseRing(ring1, 0);
    pulseRing(ring2, 700);
    pulseRing(ring3, 1400);
  }, []);

  // Slide in form when isNewUser
  useEffect(() => {
    if (isNewUser) {
      Animated.spring(formSlide, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }
  }, [isNewUser]);

  const handleLogoLongPress = () => {
    const next = devPressCount + 1;
    setDevPressCount(next);
    if (next >= 3) {
      setDevPressCount(0);
      onDevConnect();
    }
  };

  const handleCreateProfile = () => {
    const trimmed = username.trim();
    if (trimmed.length < 3) return;
    if (trimmed.length > 16) return;
    onCreateProfile(trimmed, selectedRole);
  };

  const renderPulseRing = (ring: Animated.Value, size: number) => {
    const scale = ring.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.8],
    });
    const opacity = ring.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0],
    });

    return (
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    );
  };

  // ─── Onboarding (new user) ─────────────────────────────
  if (isNewUser && walletAddress) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[styles.formContainer, { transform: [{ translateY: formSlide }] }]}
          >
            {/* Connected badge */}
            <View style={styles.connectedBadge}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>{shortAddress}</Text>
            </View>

            <Text style={styles.onboardTitle}>CREATE YOUR PROFILE</Text>
            <Text style={styles.onboardSubtitle}>
              Choose your identity on SeekerRank
            </Text>

            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username..."
                placeholderTextColor={colors.textDim}
                maxLength={16}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.charCount}>{username.length}/16</Text>
            </View>

            {/* Role Selection */}
            <Text style={styles.inputLabel}>PRIMARY ROLE</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    selectedRole === role && styles.roleOptionActive,
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      selectedRole === role && styles.roleOptionTextActive,
                    ]}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[
                styles.createButton,
                username.trim().length < 3 && styles.createButtonDisabled,
              ]}
              onPress={handleCreateProfile}
              disabled={username.trim().length < 3 || loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={
                  username.trim().length >= 3
                    ? colors.gradientPrimary
                    : (['#333', '#333'] as const)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color={colors.bg} size="small" />
                ) : (
                  <Text style={styles.createButtonText}>
                    ENTER THE ARENA
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Connect Wallet Screen ─────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo with pulse rings */}
        <View style={styles.logoArea}>
          {renderPulseRing(ring1, 180)}
          {renderPulseRing(ring2, 180)}
          {renderPulseRing(ring3, 180)}
          <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
            <TouchableOpacity
              onLongPress={handleLogoLongPress}
              delayLongPress={500}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={colors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Text style={styles.logoText}>SR</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Animated.View style={[styles.textArea, { opacity: contentOpacity }]}>
          <Text style={styles.title}>SEEKER RANK</Text>
          <Text style={styles.subtitle}>
            1v1 Quiz Battles{'\n'}Powered by Solana
          </Text>

          {/* Feature pills */}
          <View style={styles.featureRow}>
            <View style={styles.featurePill}>
              <Text style={styles.featureText}>⚡ Real-time</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featureText}>🧠 AI Questions</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featureText}>💰 SOL Wagers</Text>
            </View>
          </View>

          {/* Connect Button */}
          <TouchableOpacity
            style={styles.connectButton}
            onPress={onConnect}
            disabled={connecting}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={colors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectGradient}
            >
              {connecting ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <>
                  <Text style={styles.connectIcon}>👻</Text>
                  <Text style={styles.connectText}>CONNECT WALLET</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.walletHint}>
            Phantom • Solflare • Any Solana Wallet
          </Text>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Security note */}
          <View style={styles.securityNote}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={styles.securityText}>
              We never access your private keys.{'\n'}
              Secured by Solana Mobile Wallet Adapter.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Version tag */}
      <Text style={styles.versionText}>SeekerRank v1.0.0 • Devnet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.huge,
  },

  // Logo
  logoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginBottom: spacing.xxxl,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  logoContainer: {
    position: 'absolute',
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  logoText: {
    fontSize: 36,
    fontWeight: fontWeight.extrabold,
    color: colors.bg,
    letterSpacing: 2,
  },

  // Text
  textArea: {
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 24,
  },

  // Feature pills
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    marginBottom: spacing.xxxl,
  },
  featurePill: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Connect button
  connectButton: {
    width: '100%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  connectGradient: {
    paddingVertical: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  connectIcon: {
    fontSize: 24,
  },
  connectText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.bg,
    letterSpacing: 2,
  },
  walletHint: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Error
  errorContainer: {
    backgroundColor: colors.dangerDim,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    textAlign: 'center',
  },

  // Security note
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  securityIcon: {
    fontSize: 16,
  },
  securityText: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    lineHeight: 16,
    flex: 1,
  },

  // Version
  versionText: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    textAlign: 'center',
    paddingBottom: spacing.xl,
  },

  // ─── Onboarding Form ─────────────────────────────────
  formContainer: {
    alignItems: 'center',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryDim,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  connectedText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },

  onboardTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold,
    color: colors.text,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  onboardSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },

  // Input
  inputContainer: {
    width: '100%',
    marginBottom: spacing.xxl,
  },
  inputLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  // Role grid
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.xxxl,
    marginTop: spacing.sm,
  },
  roleOption: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: (width - spacing.xxl * 2 - spacing.sm * 2) / 3 - 1,
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  roleOptionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  roleOptionTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },

  // Create button
  createButton: {
    width: '100%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  createButtonDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
  createButtonGradient: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  createButtonText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.bg,
    letterSpacing: 2,
  },
});
