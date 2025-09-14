import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { AppHeader } from '../components/AppHeader';
import Button from '../components/Button';
import { spacing, radius } from '../theme/tokens';
import { seedFiveMonths, clearAllData } from '../lib/demo';
import { useTheme } from '../theme/ThemeProvider';

export const Settings: React.FC = () => {
  const { mode, setMode, get } = useTheme();
  const primary = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const accent = get('accent.primary') as string;

  const Option = ({ label, value }: { label: string; value: 'system'|'light'|'dark' }) => {
    const selected = mode === value;
    return (
      <Pressable onPress={() => setMode(value)} style={({ pressed }) => ({
        paddingVertical: spacing.s12, paddingHorizontal: spacing.s16, borderRadius: 12,
        borderWidth: 1, borderColor: selected ? accent : border, opacity: pressed ? 0.9 : 1
      })}>
        <Text style={{ color: selected ? accent : primary, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: muted, marginTop: 4 }}>{selected ? 'Selected' : 'Tap to switch'}</Text>
      </Pressable>
    );
  };

  return (
    <Screen>
      <AppHeader title="Settings" />
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <Text style={{ color: primary, fontWeight: '700', fontSize: 18 }}>Theme</Text>
        <Option label="Use device setting" value="system" />
        <Option label="Light" value="light" />
        <Option label="Dark" value="dark" />
      </View>
    
      <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }}>Demo & Tools</Text>
        <Button title="Seed 5 months of demo transactions" onPress={() => seedFiveMonths()} variant="secondary" />
        <Button title="Clear all transactions" onPress={() => clearAllData()} variant="secondary" />
      </View>

    </Screen>
  );
};
