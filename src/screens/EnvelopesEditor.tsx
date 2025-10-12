import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import Input from '../components/Input';
import Button from '../components/Button';
import { useEnvelopesStore } from '../store/envelopes';
import { useNavigation } from '@react-navigation/native';

export default function EnvelopesEditor() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { overrides, hydrate, ready, setOverride, resetAll } = useEnvelopesStore();

  useEffect(() => { if (!ready) hydrate(); }, [ready]);

  // Build category list based on history (last 90d)
  const txAll = require('../store/transactions').useTxStore.getState().transactions || [];
  const today = new Date();
  const historyStart = new Date(today.getTime() - 90*24*60*60*1000);
  const hist = txAll.filter((t:any)=> t.type==='expense' && new Date(t.date)>=historyStart && new Date(t.date)<=today);
  const byCat: Record<string, number> = {};
  hist.forEach((t:any)=>{ const c = t.category || 'Other'; byCat[c] = (byCat[c]||0) + (Number(t.amount)||0); });
  const cats = Object.keys(byCat).sort((a,b)=> (byCat[b]-byCat[a]));

  return (
    <ScreenScroll allowBounce>
      <View style={{ padding: spacing.s16 }}>
        <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>Edit envelopes</Text>
      </View>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s8 }}>
          <Text style={{ color: get('text.muted') as string }}>Set a manual cap per category. Leave blank to keep Auto.</Text>
          <Button title="Reset all to Auto" variant="secondary" onPress={resetAll} />
        </View>

        {cats.length === 0 ? (
          <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16 }}>
            <Text style={{ color: get('text.muted') as string }}>No history yet. Add a few expenses to see categories.</Text>
          </View>
        ) : null}

        {cats.map((c) => {
          const manualCap = overrides[c];
          return (
            <View key={c} style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>{c}</Text>
                {manualCap !== undefined ? (
                  <View style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.pill, paddingHorizontal: spacing.s8, paddingVertical: 4 }}>
                    <Text style={{ color: get('text.muted') as string }}>Manual</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.pill, paddingHorizontal: spacing.s8, paddingVertical: 4 }}>
                    <Text style={{ color: get('text.muted') as string }}>Auto</Text>
                  </View>
                )}
              </View>

              <Input
                label="Manual cap (S$) — leave blank for Auto"
                keyboardType="numeric"
                value={manualCap !== undefined ? String(manualCap) : ''}
                onChangeText={(val: string) => {
                  const num = Number(val);
                  if (!val) setOverride(c, null);
                  else if (isFinite(num)) setOverride(c, Math.max(0, Math.round(num)));
                }}
              />
              {manualCap !== undefined ? (
                <Button title="Reset to Auto" variant="secondary" onPress={() => setOverride(c, null)} />
              ) : null}
            </View>
          );
        })}
      </View>
    </ScreenScroll>
  );
}
