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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../config/theme';
import { checkUsernameUnique } from '../services/db/database';

const { width } = Dimensions.get('window');

interface ConnectWalletScreenProps {
  onConnect: () => Promise<void>;
  onDevConnect?: () => Promise<void>;
  onCreateProfile: (username: string, password?: string, twitter?: string) => Promise<void>;
  onLogin: (username: string, password: string) => Promise<void>;
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
  onLogin,
  connecting,
  isNewUser,
  walletAddress,
  shortAddress,
  error,
  loading,
}: ConnectWalletScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twitter, setTwitter] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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


  const handleAuthAction = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 3) return;
    
    if (password.trim().length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    setCheckingUsername(true);
    setLocalError(null);
    try {
      if (isLoginMode) {
        await onLogin(trimmed, password.trim());
      } else {
        const isUnique = await checkUsernameUnique(trimmed);
        if (!isUnique) {
          setLocalError('Username is already taken. Use "Login" if you already have an account.');
          setCheckingUsername(false);
          return;
        }
        await onCreateProfile(trimmed, password.trim(), twitter.trim() || undefined);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed');
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleShowRecoveryHelp = () => {
    Alert.alert(
      "Account Recovery Help",
      "1. FORGOT USERNAME?\nConnect your ORIGINAL wallet address. Squiz will recognize you and log you in automatically.\n\n" +
      "2. FORGOT PASSWORD?\nIf you have your original wallet connected, you can reset your password in Profile Settings.\n\n" +
      "3. NEW WALLET?\nIf you are using a new wallet address, you MUST remember your old Username and Password to link your profile to this new device.",
      [{ text: "OK", style: "default" }]
    );
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

  // ─── Loading Profile (returning user) ──────────────────
  if (walletAddress && !isNewUser && (loading || !shortAddress)) {
    return (
      <View style={styles.container}>
        <View style={styles.logoArea}>
          {renderPulseRing(ring1, 180)}
          {renderPulseRing(ring2, 180)}
          {renderPulseRing(ring3, 180)}
          <View style={styles.logoContainer}>
            <View>
              <ActivityIndicator color={colors.bg} size="large" />
            </View>
          </View>
        </View>
        <View style={styles.textArea}>
          <Text style={styles.title}>AUTHENTICATING</Text>
          <Text style={styles.subtitle}>
            Fetching your Seeker profile...
          </Text>
          <View style={styles.connectedBadge}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>{shortAddress || 'Connected'}</Text>
          </View>
        </View>
      </View>
    );
  }

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
            <Text style={styles.onboardTitle}>
              {isLoginMode ? 'WELCOME BACK' : 'CREATE YOUR PROFILE'}
            </Text>
            <Text style={styles.onboardSubtitle}>
              {isLoginMode 
                ? 'Enter your credentials to continue'
                : 'Choose your identity on Squiz'
              }
            </Text>

            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setLocalError(null);
                }}
                placeholder="Your unique alias..."
                placeholderTextColor={colors.textDim}
                maxLength={16}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!isLoginMode && <Text style={styles.charCount}>{username.length}/16</Text>}
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setLocalError(null);
                }}
                placeholder="Your secure password..."
                placeholderTextColor={colors.textDim}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {!isLoginMode && (
              <>
                {/* Twitter Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>X (TWITTER) USERNAME (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={twitter}
                    onChangeText={setTwitter}
                    placeholder="@username"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

              </>
            )}

            {/* Recovery Help Button */}
            <TouchableOpacity 
              style={styles.recoveryHelpButton} 
              onPress={handleShowRecoveryHelp}
            >
              <Text style={styles.recoveryHelpText}>Forgot credentials or need help?</Text>
            </TouchableOpacity>

            {/* Toggle Login/Signup */}
            <TouchableOpacity 
              style={styles.toggleModeButton} 
              onPress={() => {
                setIsLoginMode(!isLoginMode);
                setLocalError(null);
              }}
            >
              <Text style={styles.toggleModeText}>
                {isLoginMode 
                  ? "Don't have a profile? Create one" 
                  : "Already have a profile? Login here"}
              </Text>
            </TouchableOpacity>

            {/* Local Error */}
            {(localError || error) && (
              <View style={[styles.errorContainer, { width: '100%', marginBottom: spacing.lg }]}>
                <Text style={styles.errorText}>{localError || error}</Text>
              </View>
            )}

            {/* Create Button */}
            <TouchableOpacity
              style={[
                styles.createButton,
                (username.trim().length < 3 || password.trim().length < 6) && styles.createButtonDisabled,
              ]}
              onPress={() => {
                const trimmed = username.trim();
                if (trimmed.length === 0) {
                  setLocalError('Please enter a username');
                  return;
                }
                if (trimmed.length < 3) {
                  setLocalError('Username must be at least 3 characters');
                  return;
                }
                if (password.trim().length === 0) {
                  setLocalError('Please enter a password');
                  return;
                }
                if (password.trim().length < 6) {
                  setLocalError('Password must be at least 6 characters');
                  return;
                }
                handleAuthAction();
              }}
              disabled={loading || checkingUsername}
              activeOpacity={0.8}
            >
              <View>
                {loading || checkingUsername ? (
                  <ActivityIndicator color={colors.bg} size="small" />
                ) : (
                  <Text style={styles.createButtonText}>
                    {isLoginMode ? 'LOGIN' : 'ENTER THE ARENA'}
                  </Text>
                )}
              </View>
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
            <View>
              <Text style={styles.logoText}>SR</Text>
            </View>
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
              <Ionicons name="flash-outline" size={16} color={colors.primary} style={styles.featureIcon} />
              <Text style={styles.featureText}>Real-time</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="sparkles-outline" size={16} color={colors.primary} style={styles.featureIcon} />
              <Text style={styles.featureText}>Solana Questions</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="cash-outline" size={16} color={colors.primary} style={styles.featureIcon} />
              <Text style={styles.featureText}>SOL Wagers</Text>
            </View>
          </View>

          {/* Connect Button */}
          <TouchableOpacity
            style={styles.connectButton}
            onPress={onConnect}
            disabled={connecting}
            activeOpacity={0.8}
          >
            {connecting ? (
              <View style={styles.connectButtonInner}>
                <ActivityIndicator color={colors.bg} size="small" />
              </View>
            ) : (
              <View style={styles.connectButtonInner}>
                <Ionicons name="wallet-outline" size={24} color={colors.bg} />
                <Text style={styles.connectText}>CONNECT WALLET</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.walletHint}>
            Android MWA Supported
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
      <Text style={styles.versionText}>Squiz v1.0.0 • Devnet</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    marginRight: spacing.xs,
  },
  featureText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Connect button
  connectButton: {
    width: '100%',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  connectButtonInner: {
    minHeight: 64,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    gap: spacing.md,
    backgroundColor: colors.primary,
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
    marginBottom: spacing.sm,
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
  toggleModeButton: {
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  toggleModeText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  recoveryHelpButton: {
    marginBottom: spacing.xl,
    paddingVertical: spacing.xs,
  },
  recoveryHelpText: {
    fontSize: fontSize.xs,
    color: colors.textDim,
    textDecorationLine: 'underline',
    textAlign: 'center',
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
    backgroundColor: colors.primary,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  createButtonDisabled: {
    backgroundColor: colors.bgElevated,
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
