import { palette } from './palette';

export const spacing = { s0:0, s4:4, s8:8, s12:12, s16:16, s24:24 } as const;
export const radius  = { sm:8, md:12, lg:16, xl:24, pill:999 } as const;
export const elevation = {
  level0: { shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  level1: { shadowColor: palette.black, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  level2: { shadowColor: palette.black, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  level3: { shadowColor: palette.black, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
} as const;

export const lightTokens = {
  background: { default: palette.gray50 },
  surface: { level1: palette.white, level2: palette.gray100 },
  text: { primary: palette.gray900, muted: palette.gray600, onSurface: palette.gray900, onPrimary: palette.white },
  border: { subtle: palette.gray200, strong: palette.gray800 },
  accent: { primary: palette.blue600 },
  semantic: { danger: palette.red500, success: palette.green500, warning: palette.yellow500 },
  icon: { default: palette.gray700, onPrimary: palette.white, onSurface: palette.gray900, muted: palette.gray500 },
  component: {
    button: {
      primary:   { bg: palette.blue600, text: palette.white },
      secondary: { bg: palette.white,   text: palette.gray900, border: palette.gray200 },
      ghost:     {                      text: palette.blue600 }
    },
    card: { bg: palette.white, border: palette.gray200 }
  }
} as const;

export const darkTokens = {
  background: { default: palette.gray900 },
  surface: { level1: palette.gray800, level2: palette.gray700 },
  text: { primary: palette.gray50, muted: palette.gray400, onSurface: palette.gray50, onPrimary: palette.white },
  border: { subtle: palette.gray700, strong: palette.gray800 },
  accent: { primary: palette.blue500 },
  semantic: { danger: palette.red500, success: palette.green500, warning: palette.yellow500 },
  icon: { default: palette.gray300, onPrimary: palette.white, onSurface: palette.gray50, muted: palette.gray500 },
  component: {
    button: {
      primary:   { bg: palette.blue500, text: palette.white },
      secondary: { bg: palette.gray800, text: palette.gray50, border: palette.gray700 },
      ghost:     {                      text: palette.blue500 }
    },
    card: { bg: palette.gray800, border: palette.gray700 }
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
