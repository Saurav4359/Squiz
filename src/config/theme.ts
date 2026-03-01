export const colors = {
  // Backgrounds
  bg: '#0A0A1A',
  bgCard: 'rgba(255, 255, 255, 0.05)',
  bgCardHover: 'rgba(255, 255, 255, 0.08)',
  bgElevated: '#121228',
  bgModal: 'rgba(0, 0, 0, 0.85)',

  // Primary - Neon Green (win, success, CTA)
  primary: '#00F5A0',
  primaryDim: 'rgba(0, 245, 160, 0.15)',
  primaryGlow: 'rgba(0, 245, 160, 0.3)',

  // Secondary - Cyan (info, ratings)
  secondary: '#00D9FF',
  secondaryDim: 'rgba(0, 217, 255, 0.15)',

  // Danger - Red (loss, timer warning)
  danger: '#FF4757',
  dangerDim: 'rgba(255, 71, 87, 0.15)',

  // Warning - Orange
  warning: '#FFA502',
  warningDim: 'rgba(255, 165, 2, 0.15)',

  // Gold (ranks, badges, special)
  gold: '#FFD700',
  goldDim: 'rgba(255, 215, 0, 0.15)',

  // Purple (SKR, premium)
  purple: '#A855F7',
  purpleDim: 'rgba(168, 85, 247, 0.15)',

  // Text
  text: '#FFFFFF',
  textSecondary: '#8B8B9E',
  textDim: '#5A5A6E',

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.15)',

  // Gradients
  gradientPrimary: ['#00F5A0', '#00D9FF'] as const,
  gradientDanger: ['#FF4757', '#FF6B81'] as const,
  gradientGold: ['#FFD700', '#FFA502'] as const,
  gradientPurple: ['#A855F7', '#6366F1'] as const,
  gradientBg: ['#0A0A1A', '#1A1A3E'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  display: 36,
  hero: 48,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
