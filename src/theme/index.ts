export const LightColors = {
  // Brand & Backgrounds
  primary: '#090D16',
  primaryLight: '#172033',
  accent: '#0284C7',
  accentLight: '#E0F2FE',
  accentDark: '#0369A1',

  // Financial status colors
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#047857',

  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#B45309',

  danger: '#F43F5E',
  dangerLight: '#FFE4E6',
  dangerDark: '#BE123C',

  // Surfaces & Layout
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',

  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderDark: '#CBD5E1',

  // Typography
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textLight: '#F8FAFC',

  // Header & Tab bar
  headerBackground: '#090D16',
  headerText: '#F8FAFC',
  headerBorder: '#1E293B',
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E2E8F0',

  // Inputs
  inputBackground: '#F8FAFC',
  inputBorder: '#E2E8F0',

  // High-contrast stopwatch
  timerBackground: '#06090E',
  timerCard: '#0E1526',
  timerText: '#38BDF8',
  timerAccent: '#10B981',
};

export const DarkColors = {
  // Brand & Backgrounds
  primary: '#38BDF8',
  primaryLight: '#0E1726',
  accent: '#38BDF8',
  accentLight: '#0C2A4A',
  accentDark: '#7DD3FC',

  // Financial status colors
  success: '#34D399',
  successLight: '#064E3B',
  successDark: '#A7F3D0',

  warning: '#FBBF24',
  warningLight: '#451A03',
  warningDark: '#FDE68A',

  danger: '#FB7185',
  dangerLight: '#4C0519',
  dangerDark: '#FECDD3',

  // Surfaces & Layout
  background: '#070B14',
  surface: '#0F172A',
  surfaceElevated: '#17223B',
  surfaceSubtle: '#141D30',

  border: '#1E293B',
  borderLight: '#17223B',
  borderDark: '#334155',

  // Typography
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textLight: '#FFFFFF',

  // Header & Tab bar
  headerBackground: '#04070D',
  headerText: '#F8FAFC',
  headerBorder: '#1E293B',
  tabBarBackground: '#0B1120',
  tabBarBorder: '#1E293B',

  // Inputs
  inputBackground: '#141D30',
  inputBorder: '#334155',

  // High-contrast stopwatch
  timerBackground: '#030508',
  timerCard: '#0B1120',
  timerText: '#38BDF8',
  timerAccent: '#34D399',
};

export type ThemeColors = typeof LightColors;

export function getThemeColors(mode: 'light' | 'dark'): ThemeColors {
  return mode === 'dark' ? DarkColors : LightColors;
}

// Backward-compatible default colors
export const Colors = LightColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  full: 9999,
};

export const Shadows = {
  card: {
    shadowColor: '#090D16',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#090D16',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  glowGreen: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  glowBlue: {
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
};
