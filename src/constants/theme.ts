/**
 * KEA Verify design tokens — mirrored 1:1 from the approved Stitch design
 * (login.html / dashboard.html tailwind config). Do not redesign; keep in sync.
 */

export const Colors = {
  background: '#f9f9ff',
  surface: '#f9f9ff',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f0f3ff',
  'surface-container': '#e7eefe',
  'surface-container-high': '#e2e8f8',
  'surface-container-highest': '#dce2f3',
  'surface-variant': '#dce2f3',
  'surface-dim': '#d3daea',
  'on-surface': '#151c27',
  'on-surface-variant': '#554337',
  secondary: '#575e70',
  'secondary-container': '#d9dff5',
  'on-secondary-container': '#5c6274',
  primary: '#934b00',
  'on-primary': '#ffffff',
  'primary-container': '#d97b29',
  'on-primary-container': '#482100',
  'primary-fixed': '#ffdcc5',
  'primary-fixed-dim': '#ffb782',
  'on-primary-fixed': '#301400',
  'on-primary-fixed-variant': '#703800',
  tertiary: '#006c4a',
  'on-tertiary': '#ffffff',
  'tertiary-container': '#29a678',
  'on-tertiary-container': '#003321',
  'tertiary-fixed': '#85f8c4',
  'on-tertiary-fixed': '#002114',
  'tertiary-fixed-dim': '#68dba9',
  'on-tertiary-fixed-variant': '#005137',
  error: '#ba1a1a',
  'on-error': '#ffffff',
  'error-container': '#ffdad6',
  'on-error-container': '#93000a',
  outline: '#887365',
  'outline-variant': '#dbc2b2',
  'inverse-surface': '#2a313d',
  'inverse-on-surface': '#ebf1ff',
  'inverse-primary': '#ffb782',
} as const;

export type ColorToken = keyof typeof Colors;

export const c = (token: ColorToken): string => Colors[token];

export const KEA_LOGO_URI =
  'https://cf-images.assettype.com/newindianexpress%2F2026-04-18%2Fa1dsxi7a%2FNew-Project-2025-07-12T130910.505.jpg?rect=130%2C0%2C900%2C675&w=1200&h=900&auto=format%2Ccompress&fit=crop';

/** Type scale from the Stitch config (size, lineHeight, weight, letterSpacing) */
export const Type = {
  headlineXl: { fontSize: 26, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.02 * 26 },
  headlineLg: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: -0.015 * 24 },
  headlineMd: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.01 * 20 },
  headlineSm: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  titleMd: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  titleSm: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.02 * 14 },
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  labelLg: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  labelMd: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.02 * 12 },
  labelSm: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.04 * 11 },
  monoMetric: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.05 * 15 },
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const FONT_FAMILY = 'Inter';
