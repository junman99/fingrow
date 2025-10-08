import React from 'react';
import { View, Text } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

type Props = { title?: string; right?: React.ReactNode; onBack?: () => void; left?: React.ReactNode };

export const AppHeader: React.FC<Props> = ({ title, right, onBack, left }) => {
  const { get } = useThemeTokens();
  const bg = get('surface.level1') as string;
  const text = get('text.onSurface') as string;
  const border = get('border.subtle') as string;
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s12, borderBottomWidth: 1, borderBottomColor: border, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {left}
        <Text style={{ fontSize: 20, fontWeight: '700', color: text }} numberOfLines={1}>{title}</Text>
        {right}
      </View>
    </View>
  );
};

export default AppHeader;
