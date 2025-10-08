import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

export default function NetWorthHero() {
  const { get } = useThemeTokens();
  const a = get('accent.primary') as string;
  const b = get('accent.secondary') as string;
  return (
    <LinearGradient colors={[a+'55', b+'55']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ borderRadius: radius.lg, padding: spacing.s16, marginTop: spacing.s8 }}>
      <Text style={{ color: get('text.onSurface') as string, fontWeight: '700', marginBottom: spacing.s8 }}>Net worth</Text>
      <View style={{ height: 140, borderRadius: radius.md, backgroundColor: get('surface.level2') as string }} />
      <Text style={{ color: get('text.onSurface') as string, opacity: 0.8, marginTop: spacing.s8 }}>+12.4% this month · Updated 2m ago</Text>
    </LinearGradient>
  );
}
