import type { TextStyle, ViewStyle } from 'react-native';

/** Light-theme design tokens, hand-ported from docs/design/tokens.json. */
export const colors = {
  red: '#C8102E',
  redDeep: '#8E0A20',
  redSoft: '#FBE4E7',
  gold: '#D4A20B',
  goldPressed: '#BC8F09',
  goldSoft: '#FAF0D2',
  goldDeep: '#7A5A00',
  ink: '#161616',
  inkMuted: '#5A5A5A',
  onRed: '#FFFFFF',
  paper: '#F8F6F2',
  surface: '#FFFFFF',
  line: '#E6E1D8',
  statusReceived: '#3D4A50',
  statusReceivedBg: '#E6EAEC',
  statusAssigned: '#1E4F87',
  statusAssignedBg: '#DCE8F6',
  statusProgress: '#7A5A00',
  statusProgressBg: '#FAF0D2',
  statusResolved: '#1F6B33',
  statusResolvedBg: '#DCF1E1',
  urgent: '#A50E25',
  urgentSoft: '#FBE4E7',
  urgentDeep: '#8E0A20',
  /** Placeholder icon on a photo-less thumbnail. */
  iconMuted: '#C9D1D4',
  /** Ground colour of the static map illustration. */
  mapGround: '#F1EEE8',
  /** Dark translucent chip over a photo (remove-photo button). */
  scrim: 'rgba(22,22,22,0.72)',
} as const;

export const spacing = { s1: 4, s2: 8, s3: 12, s4: 16, s6: 24, s8: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const shadows: Record<'card' | 'float', ViewStyle> = {
  card: {
    shadowColor: '#161616',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  float: {
    shadowColor: '#161616',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

/** Font family names as registered by useFonts in the root layout. */
export const fonts = {
  display500: 'ReadexPro_500Medium',
  display600: 'ReadexPro_600SemiBold',
  display700: 'ReadexPro_700Bold',
  sans400: 'IBMPlexSansArabic_400Regular',
  sans500: 'IBMPlexSansArabic_500Medium',
  sans600: 'IBMPlexSansArabic_600SemiBold',
  sans700: 'IBMPlexSansArabic_700Bold',
  ruqaa: 'ArefRuqaa_700Bold',
} as const;

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'metric'
  | 'slogan'
  | 'sloganSm'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'caption'
  | 'label';

/** Typography presets (display = Readex Pro, text = IBM Plex Sans Arabic, slogan = Aref Ruqaa). */
export const typography: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.display700, fontSize: 40, lineHeight: 48 },
  h1: { fontFamily: fonts.display700, fontSize: 28, lineHeight: 38 },
  h2: { fontFamily: fonts.display600, fontSize: 22, lineHeight: 32 },
  h3: { fontFamily: fonts.display600, fontSize: 18, lineHeight: 28 },
  metric: { fontFamily: fonts.display600, fontSize: 32, lineHeight: 36 },
  slogan: { fontFamily: fonts.ruqaa, fontSize: 30, lineHeight: 46 },
  sloganSm: { fontFamily: fonts.ruqaa, fontSize: 22, lineHeight: 34 },
  body: { fontFamily: fonts.sans400, fontSize: 16, lineHeight: 28 },
  bodyStrong: { fontFamily: fonts.sans600, fontSize: 16, lineHeight: 28 },
  small: { fontFamily: fonts.sans400, fontSize: 14, lineHeight: 22 },
  smallStrong: { fontFamily: fonts.sans600, fontSize: 14, lineHeight: 22 },
  caption: { fontFamily: fonts.sans500, fontSize: 12, lineHeight: 18 },
  label: { fontFamily: fonts.sans600, fontSize: 14, lineHeight: 22 },
};

export const layout = { gutter: 16, tabBarHeight: 76, minTouch: 44 } as const;
