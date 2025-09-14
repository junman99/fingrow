import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { lightTokens, darkTokens, navThemeLight, navThemeDark } from './tokens';

type ThemeMode = 'system' | 'light' | 'dark';
type ThemeContextType = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
  tokens: Record<string, any>;
  navTheme: any;
  get: (path: string) => any;
};
const ThemeContext = createContext<ThemeContextType | null>(null);

function getFromPath(obj: any, path: string) {
  return path.split('.').reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [system, setSystem] = useState<'light'|'dark'>(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const resolved = mode === 'system' ? system : mode;
  const isDark = resolved === 'dark';
  const tokens = isDark ? darkTokens : lightTokens;
  const navTheme = isDark ? navThemeDark : navThemeLight;
  const get = useCallback((path: string) => getFromPath(tokens, path), [tokens]);
  const value = useMemo(() => ({ mode, setMode, isDark, tokens, navTheme, get }), [mode, isDark, tokens, navTheme, get]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme() { const ctx = useContext(ThemeContext); if (!ctx) throw new Error('useTheme must be used within ThemeProvider'); return ctx; }
export function useThemeTokens() { const { get, isDark } = useTheme(); return { get, isDark }; }
