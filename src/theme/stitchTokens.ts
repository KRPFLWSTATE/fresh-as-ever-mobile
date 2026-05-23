import type { TextStyle } from 'react-native';

/**
 * Linked TTF family names (react-native-asset). Use these instead of
 * `fontWeight` for reliable custom-font rendering on Android.
 */
export const stitchFonts = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semiBold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
} as const;

/** Human-readable default; prefer `stitchFonts.*` in text styles. */
export const STITCH_FONT_FAMILY = stitchFonts.regular;

/**
 * Light palette — from Stitch `login_authentication/code.html` `theme.extend.colors`.
 * Single canonical source: all 95 Stitch HTML files share this set.
 */
export const stitchColorsLight = {
  surfaceContainer: '#ebeeee',
  surfaceContainerHighest: '#e0e3e3',
  errorContainer: '#ffdad6',
  primaryFixed: '#a1f0f6',
  darkBackground: '#141412',
  accentHover: '#c55700',
  darkPrimary: '#4f98a3',
  primaryActive: '#0f3638',
  darkSurface2: '#252420',
  text: '#1a1a1a',
  background: '#f7f6f2',
  divider: '#e2dfd9',
  secondaryFixed: '#ffdcc5',
  surfaceBright: '#f7fafa',
  surfaceContainerLow: '#f1f4f4',
  surface: '#ffffff',
  onTertiaryFixedVariant: '#6e3815',
  onError: '#ffffff',
  tertiaryFixed: '#ffdbc9',
  textFaint: '#b5b2ad',
  onSurface: '#181c1d',
  onSecondaryContainer: '#633000',
  onErrorContainer: '#93000a',
  darkAccent: '#fdab43',
  onSurfaceVariant: '#3f4949',
  onPrimaryFixedVariant: '#004f54',
  inverseOnSurface: '#eef1f1',
  tertiaryFixedDim: '#ffb68d',
  secondary: '#944b00',
  textMuted: '#6b6762',
  onBackground: '#181c1d',
  secondaryContainer: '#fc8b27',
  onTertiaryFixed: '#331200',
  onPrimaryContainer: '#97e6ec',
  onTertiaryContainer: '#ffceb5',
  surfaceTint: '#01696f',
  surfaceContainerLowest: '#ffffff',
  primaryHover: '#0c4e54',
  surfaceDim: '#d7dbda',
  accent: '#da7101',
  outline: '#6f797a',
  inverseSurface: '#2d3131',
  accentHighlight: '#fde8cc',
  onSecondaryFixed: '#301400',
  primaryHighlight: '#d0e8e6',
  primaryFixedDim: '#85d3da',
  outlineVariant: '#bec8c9',
  onTertiary: '#ffffff',
  darkSurface: '#1c1b18',
  onPrimary: '#ffffff',
  surface2: '#f3f0ec',
  primary: '#004f54',
  onSecondaryFixedVariant: '#703700',
  onPrimaryFixed: '#002022',
  success: '#437a22',
  secondaryFixedDim: '#ffb783',
  surfaceVariant: '#e0e3e3',
  tertiary: '#6e3815',
  tertiaryContainer: '#8b4f2a',
  error: '#c0392b',
  surfaceContainerHigh: '#e6e9e9',
  primaryContainer: '#01696f',
  onSecondary: '#ffffff',
  inversePrimary: '#85d3da',
  /**
   * Header / hairline-divider color used by docked top bars (Order detail, Order review,
   * Checkout, Onboarding). Light scheme matches Stitch's `stone-200`.
   */
  headerBorder: '#e7e5e4',
  /**
   * Ambient shadow color used by elevated cards and `.ambient-shadow`-style chrome.
   * Centralised so we never accidentally diverge from Stitch's warm-black umber tone.
   */
  shadow: '#1e1b14',
  /**
   * Full-screen scrim / overlay backdrop. Used by lightboxes and modal pressed-state
   * overlays (e.g. fullscreen photo viewer in admin merchant review).
   */
  scrim: 'rgba(0,0,0,0.6)',
  /**
   * QR code foreground / background. Intentionally stark black-on-white for scanner
   * reliability regardless of theme — documented here so we never accidentally
   * theme them.
   */
  qrForeground: '#1a1a1a',
  qrBackground: '#ffffff',
} as const;

/**
 * Dark mode — content areas follow `discover_dark_mode` body + card tokens
 * (header may stay light in Stitch; we expose both `headerBar` and `headerBarAlt`).
 */
export const stitchColorsDark = {
  ...stitchColorsLight,
  background: '#141412',
  text: '#ffffff',
  onBackground: '#ffffff',
  onSurface: '#ffffff',
  surface: '#1c1b18',
  surface2: '#252420',
  /** Cards / inputs on discover dark */
  darkSurface: '#1c1b18',
  darkSurface2: '#252420',
  textMuted: '#b5b2ad',
  textFaint: '#6b6762',
  /** Discover dark header (stone-950–like) */
  headerBarDark: '#0c0a09',
  brandCyan: '#02b3be',
  /** Chip selected ring uses primary-active etc. */
  screenMuted: '#252420',
  /** Dark-mode hairline divider — matches Stitch `stone-800`. */
  headerBorder: '#292524',
  /** M3-style dark surfaces — do not inherit light `#fff` containers (Orders pickup slab, chips). */
  surfaceContainerLowest: '#252420',
  surfaceContainerLow: '#2a2824',
  surfaceContainer: '#2f2e29',
  surfaceContainerHigh: '#35332f',
  surfaceContainerHighest: '#3c3a35',
  surfaceBright: '#2d2b27',
  surfaceVariant: '#3a3833',
  surfaceDim: '#1a1916',
  divider: '#3f3c36',
  outline: '#7a736b',
  outlineVariant: '#4a4742',
  inverseSurface: '#e7e5e4',
  inverseOnSurface: '#1c1b18',
  inversePrimary: '#004f54',
  primaryHighlight: '#1a3f42',
  accentHighlight: '#4a3520',
  onSurfaceVariant: '#c4bfb6',
  primaryFixed: '#1a3f42',
  primaryFixedDim: '#163538',
  errorContainer: '#5c2320',
  onErrorContainer: '#ffdad4',
  secondaryFixed: '#4a3520',
  tertiaryFixed: '#4a3028',
} as const;

export type StitchColorMap = typeof stitchColorsLight;
export type StitchColorKey = keyof StitchColorMap;

export const stitchSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  pageMarginMobile: 16,
  pageMarginDesktop: 32,
} as const;

export const stitchRadii = {
  default: 4,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

export type StitchTextRole =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body-lg'
  | 'body-md'
  | 'body-sm'
  | 'label'
  | 'label-caps'
  | 'price'
  | 'price-original';

const px = (rem: number) => Math.round(rem * 16);

export function stitchTextRoleStyle(role: StitchTextRole): TextStyle {
  switch (role) {
    case 'display':
      return {
        fontSize: px(2),
        lineHeight: Math.round(px(2) * 1.2),
        fontFamily: stitchFonts.bold,
      };
    case 'h1':
      return {
        fontSize: px(1.5),
        lineHeight: Math.round(px(1.5) * 1.3),
        fontFamily: stitchFonts.bold,
      };
    case 'h2':
      return {
        fontSize: px(1.25),
        lineHeight: Math.round(px(1.25) * 1.35),
        fontFamily: stitchFonts.semiBold,
      };
    case 'h3':
      return {
        fontSize: px(1.125),
        lineHeight: Math.round(px(1.125) * 1.4),
        fontFamily: stitchFonts.semiBold,
      };
    case 'body-lg':
      return {
        fontSize: px(1),
        lineHeight: Math.round(px(1) * 1.6),
        fontFamily: stitchFonts.regular,
      };
    case 'body-md':
      return {
        fontSize: px(0.9375),
        lineHeight: Math.round(px(0.9375) * 1.6),
        fontFamily: stitchFonts.regular,
      };
    case 'body-sm':
      return {
        fontSize: px(0.875),
        lineHeight: Math.round(px(0.875) * 1.5),
        fontFamily: stitchFonts.regular,
      };
    case 'label':
      return {
        fontSize: px(0.875),
        lineHeight: Math.round(px(0.875) * 1.4),
        fontFamily: stitchFonts.medium,
      };
    case 'label-caps': {
      const fontSize = px(0.75);
      return {
        fontSize,
        lineHeight: Math.round(fontSize * 1.4),
        letterSpacing: fontSize * 0.05,
        textTransform: 'uppercase',
        fontFamily: stitchFonts.semiBold,
      };
    }
    case 'price':
      return {
        fontSize: px(1.375),
        lineHeight: Math.round(px(1.375) * 1.2),
        fontFamily: stitchFonts.bold,
      };
    case 'price-original':
      return {
        fontSize: px(0.9375),
        lineHeight: Math.round(px(0.9375) * 1.4),
        textDecorationLine: 'line-through',
        fontFamily: stitchFonts.regular,
      };
    default:
      return { fontFamily: stitchFonts.regular };
  }
}

/** Ambient card shadow from Stitch login `.ambient-shadow`. */
export const stitchAmbientShadow = {
  shadowColor: stitchColorsLight.shadow,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 30,
  elevation: 8,
};
