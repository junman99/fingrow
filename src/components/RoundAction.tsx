import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Icon, { IconName } from './Icon';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';

type Props = { icon?: string; iconName?: IconName; label: string; onPress?: () => void; primary?: boolean };

const RoundAction: React.FC<Props> = ({ icon, iconName, label, onPress, primary }) => {
  const { get } = useThemeTokens();
  const bg = primary ? (get('accent.primary') as string) : (get('surface.level2') as string);
  const fg = primary ? (get('text.onPrimary') as string) : (get('text.primary') as string);
  return (
    <View style={{ alignItems: 'center', width: 72 }}>
      <Pressable accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
          opacity: pressed ? 0.9 : 1
        })}
      >
        {iconName ? <Icon name={iconName} size={24} colorToken={primary ? 'text.onPrimary' : 'icon.onSurface'} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: 18 }}>{icon}</Text>}
      </Pressable>
      <Text style={{ marginTop: spacing.s8, color: get('text.muted') as string }} numberOfLines={1}>{label}</Text>
    </View>
  );
};

export default RoundAction;