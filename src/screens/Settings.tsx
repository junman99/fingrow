import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { useInvestStore } from '../store/invest';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import Button from '../components/Button';
import { spacing, radius } from '../theme/tokens';
import { seedFiveMonths, clearAllData } from '../lib/demo';
import { seedInvestSixMonths, clearInvestDemo } from '../lib/demo_invest';
import { useTheme } from '../theme/ThemeProvider';


const onSeedInvest = async () => {
  try {
    await seedInvestSixMonths();
    // Hard reset quotes so Invest portfolioLine recomputes from fresh data
    const invest = useInvestStore.getState();
    useInvestStore.setState({ quotes: {}, quotesTs: 0 } as any);
    if (typeof invest.refreshQuotes === 'function') {
      await invest.refreshQuotes();
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (e: any) {
    console.error(e);
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    Alert.alert('Failed to generate demo investment data');
  }
};
const onClearInvest = async () => {
  try { const m = await import('../lib/demo_invest'); await m.clearInvestDemo(); await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
  catch (e: any) { console.error(e); Alert.alert('Failed to remove demo investment data', String(e?.message ?? e)); try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {} }
};
export const Settings: React.FC = () => {
  const quoteProvider = useInvestStore(s => (s.profile?.quoteProvider ?? 'auto')) as 'auto'|'yahoo'|'stooq';
  const setQuoteProvider = useInvestStore(s => s.setQuoteProvider);
  const { mode, setMode, get } = useTheme();
  const primary = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const accent = get('accent.primary') as string;

  const Option = ({ label, value }: { label: string; value: 'system'|'light'|'dark' }) => {
    const selected = mode === value;
    return (
      <Pressable accessibilityRole="button" onPress={() => setMode(value)} style={({ pressed }) => ({
        paddingVertical: spacing.s12, paddingHorizontal: spacing.s16, borderRadius: 12,
        borderWidth: 1, borderColor: selected ? accent : border, opacity: pressed ? 0.9 : 1
      })}>
        <Text style={{ color: selected ? accent : primary, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: muted, marginTop: 4 }}>{selected ? 'Selected' : 'Tap to switch'}</Text>
      </Pressable>
    );
  };

  return (
    <Screen inTab>
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

    
      {/* Demo: Investments */}
      <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: primary, fontWeight: '700' }}>Demo (Invest)</Text>
        <Button title="Generate 6 months of demo investment activity" onPress={onSeedInvest} />
        <Button title="Remove demo investment data" variant="secondary" onPress={onClearInvest} />
      </View>


      {/* Data Source */}
      <Card>
        <View style={{ gap: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '800' }}>Market data source</Text>
          <Text style={{ color: get('text.muted') as string }}>Switch between Auto, Yahoo or Stooq.</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s8 }}>
            {(['auto','yahoo','stooq'] as const).map(k => {
              const on = quoteProvider === k;
              return (
                <Pressable
                  key={k}
                  onPress={async () => { try { await setQuoteProvider(k); try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} } catch (e) {} }}
                  style={{
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s6,
                    borderRadius: radius.pill,
                    backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string),
                  }}
                >
                  <Text style={{ color: on ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight:'700', fontSize: 14 }}>
                    {k.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>
</Screen>
  );
};

export default Settings;