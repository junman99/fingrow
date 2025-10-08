import React from 'react';
import { View, Text } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';

export default function Signup() {
  const { get } = useThemeTokens();
  return (
    <ScreenScroll contentStyle={{ padding: spacing.s16 }}>
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: get('text.primary') as string, fontSize: 20, fontWeight: '700' }}>Create account</Text>
        <Text style={{ color: get('text.muted') as string }}>Stub screen. Hook your flow here.</Text>
      </View>
    </ScreenScroll>
  );
}