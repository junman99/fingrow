import React from 'react';
import { View } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';

export default function Progress({ pct=0, color }: { pct: number; color?: string }) {
  const { get } = useThemeTokens();
  const c = color ?? (get('accent.primary') as string);
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: (get('text.muted') as string)+'22', overflow: 'hidden', marginTop: 8 }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c }} />
    </View>
  );
}
