import React from 'react';
import { View } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

export const ProgressBar: React.FC<{ value: number }> = ({ value }) => {
  const { get } = useThemeTokens();
  const track = get('surface.level2') as string;
  const fill = get('accent.primary') as string;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${v*100}%`, height: 8, backgroundColor: fill }} />
    </View>
  );
};
