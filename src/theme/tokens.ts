import { palette } from './palette';

export const spacing = { s0:0, s2:2, s4:4, s6:6, s8:8, s10:10, s12:12, s16:16, s24:24, s32: 32} as const;
export const radius  = { sm:8, md:12, lg:16, xl:24, pill:999 } as const;
export const elevation = {
  level0: { shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  level1: { shadowColor: palette.black, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  level2: { shadowColor: palette.black, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  level3: { shadowColor: palette.black, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
} as const;

export const lightTokens = {
  background: { default: '#f7f8fc' },
  surface: { level1: '#ffffff', level2: '#fafafe' },
  text: { primary: '#1d2433', muted: '#667085', onSurface: '#1d2433', onPrimary: '#ffffff' },
  border: { subtle: '#e5e7ef', strong: '#1d2433' },
  accent: { primary: '#7c5cff', secondary: '#ff6dc0' },
  semantic: { danger: palette.red500, success: palette.green500, warning: palette.yellow500 },
  icon: { default: palette.gray700, onPrimary: palette.white, onSurface: palette.gray900, muted: palette.gray500 },
  component: {
    button: {
      primary:   { bg: '#7c5cff', text: '#ffffff' },
      secondary: { bg: '#ffffff', text: '#7c5cff', border: '#e5e7ef' },
      ghost:     {                      text: palette.blue600 }
    },
    card: { bg: '#ffffff', border: '#e5e7ef' },
    sheet: { bg: '#ffffff' },
    popover: { bg: 'rgba(255,255,255,0.94)' },
    modal: { bg: 'rgba(255,255,255,0.96)' }
  }
} as const;

export const darkTokens = {
  background: { default: '#0a0b12' },
  surface: { level1: 'rgba(255,255,255,0.06)', level2: 'rgba(255,255,255,0.10)' },
  text: { primary: '#eef3ff', muted: '#a7b0c6', onSurface: '#eef3ff', onPrimary: '#0b0b0f' },
  border: { subtle: 'rgba(255,255,255,0.14)', strong: '#0a0b12' },
  accent: { primary: '#45e6d2', secondary: '#9c7bff' },
  semantic: { danger: palette.red500, success: palette.green500, warning: palette.yellow500 },
  icon: { default: palette.gray300, onPrimary: palette.white, onSurface: palette.gray50, muted: palette.gray500 },
  component: {
    button: {
      primary:   { bg: '#45e6d2', text: '#0b0b0f' },
      secondary: { bg: 'rgba(255,255,255,0.06)', text: '#eef3ff', border: 'rgba(255,255,255,0.14)' },
      ghost:     {                      text: palette.blue500 }
    },
    card: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)' },
    sheet: { bg: '#11131a' },
    popover: { bg: 'rgba(9,11,16,0.90)' },
    modal: { bg: 'rgba(9,11,16,0.92)' }
  }
} as const;

export const navThemeLight = {
  dark: false,
  colors: {
    primary: lightTokens.accent.primary,
    background: lightTokens.background.default,
    card: lightTokens.surface.level1,
    text: lightTokens.text.onSurface,
    border: lightTokens.border.subtle,
    notification: lightTokens.accent.primary
  }
};

export const navThemeDark = {
  dark: true,
  colors: {
    primary: darkTokens.accent.primary,
    background: darkTokens.background.default,
    card: darkTokens.surface.level1,
    text: darkTokens.text.onSurface,
    border: darkTokens.border.subtle,
    notification: darkTokens.accent.primary
  }
};
