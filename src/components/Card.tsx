import React from 'react';
import { View } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { radius, elevation, spacing } from '../theme/tokens';

export const Card: React.FC<{ children: React.ReactNode; style?: any; padding?: number }> = ({ children, style, padding = spacing.s16 }) => {
  const { get } = useThemeTokens();
  const bg = get('component.card.bg') as string;
  const border = get('component.card.border') as string;
  return (
    <View style={[
      { backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: radius.lg, padding, ...elevation.level1 },
      style
    ]}>
      {children}
    </View>
  );
};
