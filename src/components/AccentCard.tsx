import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

export default function AccentCard({ accent='primary', style, children, ...rest }: ViewProps & { accent?: 'primary'|'secondary' }) {
  const { get } = useThemeTokens();
  const color = get(accent === 'primary' ? 'accent.primary' : 'accent.secondary') as string;
  const bg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  return (
    <View {...rest} style={[styles.base, { backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: radius.lg }, style]}>
      <View style={[styles.stripe, { backgroundColor: color }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { padding: 16, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, opacity: 0.95 },
});
