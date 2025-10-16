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
  background: { default: '#FAF7F0' },
  surface: { level1: '#FFFBF5', level2: '#F5F1E8' },
  text: { primary: '#2D2424', muted: '#7A6F6F', onSurface: '#2D2424', onPrimary: '#FAF7F0' },
  border: { subtle: '#E8DFD4', strong: '#2D2424' },
  accent: { primary: '#5B9A8B', secondary: '#D4735E' },
  semantic: { danger: '#C85C3D', success: '#88AB8E', warning: '#E8B86D' },
  icon: { default: '#7A6F6F', onPrimary: '#FAF7F0', onSurface: '#2D2424', muted: '#A39B95' },
  component: {
    button: {
      primary:   { bg: '#5B9A8B', text: '#FAF7F0' },
      secondary: { bg: '#F5F1E8', text: '#2D2424', border: '#E8DFD4' },
      ghost:     {                      text: '#5B9A8B' }
    },
    card: { bg: '#FFFBF5', border: '#E8DFD4' },
    sheet: { bg: '#FFFBF5' },
    popover: { bg: 'rgba(255,251,245,0.96)' },
    modal: { bg: 'rgba(255,251,245,0.98)' }
  }
} as const;

export const darkTokens = {
  background: { default: '#1A1614' },
  surface: { level1: '#2A2624', level2: '#36312E' },
  text: { primary: '#F5EFE7', muted: '#B8AFA7', onSurface: '#F5EFE7', onPrimary: '#1A1614' },
  border: { subtle: '#3E3734', strong: '#F5EFE7' },
  accent: { primary: '#7FE7CC', secondary: '#FF9B71' },
  semantic: { danger: '#FF9B71', success: '#A4BE7B', warning: '#E8B86D' },
  icon: { default: '#B8AFA7', onPrimary: '#1A1614', onSurface: '#F5EFE7', muted: '#8A7F77' },
  component: {
    button: {
      primary:   { bg: '#7FE7CC', text: '#1A1614' },
      secondary: { bg: '#2A2624', text: '#F5EFE7', border: '#3E3734' },
      ghost:     {                      text: '#7FE7CC' }
    },
    card: { bg: '#2A2624', border: '#3E3734' },
    sheet: { bg: '#2A2624' },
    popover: { bg: 'rgba(42,38,36,0.96)' },
    modal: { bg: 'rgba(42,38,36,0.98)' }
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
