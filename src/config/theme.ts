export const colors = {
  bg: '#0B0B0F',
  bgCard: '#18181B',
  bgSecondary: '#101014',

  primary: '#D0FF80',
  accent: '#C7B1F0',

  text: '#FFFFFF',
  textSecondary: '#9CA3AF',

  border: '#27272A',

  success: '#22C55E',
  danger: '#EF4444',

  // Compatibility tokens for existing styles
  bgElevated: '#101014',
  bgCardHover: '#1E1E24',
  bgModal: 'rgba(0, 0, 0, 0.85)',
  primaryDim: 'rgba(208, 255, 128, 0.16)',
  primaryGlow: 'rgba(208, 255, 128, 0.35)',
  secondary: '#9CA3AF',
  secondaryDim: 'rgba(156, 163, 175, 0.2)',
  textDim: '#9CA3AF',
  borderLight: '#3F3F46',
  dangerDim: 'rgba(239, 68, 68, 0.16)',
  warning: '#F59E0B',
  warningDim: 'rgba(245, 158, 11, 0.16)',
  gold: '#D0FF80',
  goldDim: 'rgba(208, 255, 128, 0.16)',
  purple: '#C7B1F0',
  purpleDim: 'rgba(199, 177, 240, 0.15)',
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
  sm: 18,
  md: 18,
  lg: 18,
  xl: 18,
  full: 999,
};

export const fontSize = {
  xs: 14,
  sm: 14,
  md: 14,
  lg: 14,
  xl: 18,
  xxl: 18,
  xxxl: 18,
  display: 24,
  hero: 24,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
