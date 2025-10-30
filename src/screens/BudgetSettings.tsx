import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Switch, Alert, Share, Pressable, Animated } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../components/ScreenScroll';
import { toggleWeeklyDigest } from '../lib/budgetAlerts';
import Button from '../components/Button';
import Input from '../components/Input';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useBudgetsStore } from '../store/budgets';
import { CYCLE_KEY } from './Budgets';

type Cycle = 'monthly' | 'biweekly';

function startOfDay(d: Date) { const n = new Date(d); n.setHours(0,0,0,0); return n; }
function endOfDay(d: Date) { const n = new Date(d); n.setHours(23,59,59,999); return n; }
function startOfMonth(d: Date) { const n = new Date(d.getFullYear(), d.getMonth(), 1); n.setHours(0,0,0,0); return n; }
function endOfMonth(d: Date) { const n = new Date(d.getFullYear(), d.getMonth()+1, 0); n.setHours(23,59,59,999); return n; }

function getBiweeklyPeriod(anchorISO: string | null, today = new Date()): {start: Date, end: Date, anchor: string} {
  const anchor = anchorISO ? new Date(anchorISO) : startOfDay(today);
  const a0 = startOfDay(anchor);
  const ms14 = 14 * 24 * 60 * 60 * 1000;
  const t = startOfDay(today).getTime();
  const diff = t - a0.getTime();
  const k = Math.floor(diff / ms14);
  const pStart = new Date(a0.getTime() + k * ms14);
  const pEnd = new Date(pStart.getTime() + ms14 - 1);
  return { start: pStart, end: pEnd, anchor: a0.toISOString() };
}

function withAlpha(hex: string, alpha: number) {
  if (!hex) return hex;
  const raw = hex.replace('#', '');
  const bigint = parseInt(raw.length === 3 ? raw.repeat(2) : raw, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function BudgetSettings() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { monthlyBudget, setMonthlyBudget, warnThreshold, setWarnThreshold, hydrate, ready } = useBudgetsStore();

  // Alert toggles
  const ALERTS_KEY = 'fingrow/budget/alert-prefs';
  const [alertsOn, setAlertsOn] = useState(true);
  const [paceOn, setPaceOn] = useState(true);
  const [digestOn, setDigestOn] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ALERTS_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          setAlertsOn(!!p.alertsOn);
          setPaceOn(!!p.paceOn);
          setDigestOn(!!p.digestOn);
        }
      } catch {}
    })();
  }, []);

  const savePrefs = async (next?: Partial<{alertsOn:boolean; paceOn:boolean; digestOn:boolean;}>) => {
    const payload = { alertsOn, paceOn, digestOn, ...(next||{}) };
    setAlertsOn(payload.alertsOn);
    setPaceOn(payload.paceOn);
    setDigestOn(payload.digestOn);
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(payload));
    toggleWeeklyDigest(payload.digestOn);
  };

  // Cycle settings
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [anchorISO, setAnchorISO] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CYCLE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.cycle) setCycle(parsed.cycle);
          if (parsed?.anchor) setAnchorISO(parsed.anchor);
        }
      } catch {}
    })();
  }, []);

  const saveCycle = async (c: Cycle) => {
    const payload = { cycle: c, anchor: c === 'biweekly' ? (anchorISO || new Date().toISOString()) : null };
    setCycle(c);
    if (c === 'biweekly' && !anchorISO) setAnchorISO(payload.anchor);
    await AsyncStorage.setItem(CYCLE_KEY, JSON.stringify(payload));
  };

  const today = new Date();
  const period = cycle === 'monthly'
    ? { start: startOfMonth(today), end: endOfMonth(today) }
    : getBiweeklyPeriod(anchorISO, today);

  const [budgetText, setBudgetText] = useState(monthlyBudget != null ? String(monthlyBudget) : '');
  const [thresholdText, setThresholdText] = useState(String(Math.round(warnThreshold * 100)));

  useEffect(() => { hydrate(); }, []);
  useEffect(() => {
    if (ready) setBudgetText(monthlyBudget != null ? String(monthlyBudget) : '');
  }, [ready, monthlyBudget]);
  useEffect(() => {
    if (ready) setThresholdText(String(Math.round(warnThreshold * 100)));
  }, [ready, warnThreshold]);

  const onSave = async () => {
    const val = budgetText.trim() === '' ? null : Number(budgetText);
    await setMonthlyBudget(val && !Number.isNaN(val) ? val : null);
    const thr = Math.min(100, Math.max(1, Number(thresholdText) || 80));
    await setWarnThreshold(thr / 100);
    Alert.alert('Saved', 'Budget settings updated');
  };

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;

  const heroText = isDark ? textPrimary : textOnPrimary;
  const heroMuted = withAlpha(heroText, isDark ? 0.72 : 0.78);

  const cycleOptions: Array<{ key: Cycle; label: string }> = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'biweekly', label: 'Bi-weekly' }
  ];

  const cadenceLabel = cycle === 'monthly' ? 'Monthly cycle' : 'Bi-weekly cycle';

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s24 }}>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        paddingHorizontal: spacing.s16,
        paddingTop: spacing.s12,
        gap: spacing.s20
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? surface1 : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={28} color={textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.s2 }}>
              Budget Settings
            </Text>
          </View>
        </View>

        {/* Budget settings */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s16,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5)
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.12),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="dollar-sign" size={18} color={accentPrimary} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Budget settings</Text>
          </View>
          <View style={{ gap: spacing.s12 }}>
            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: textMuted, fontSize: 14, fontWeight: '600' }}>Monthly budget</Text>
              <Input value={budgetText} onChangeText={setBudgetText} placeholder="e.g. 1200" keyboardType="numeric" />
            </View>
            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: textMuted, fontSize: 14, fontWeight: '600' }}>Alert threshold (%)</Text>
              <Input value={thresholdText} onChangeText={setThresholdText} placeholder="80" keyboardType="numeric" />
            </View>
          </View>
          <Text style={{ color: textMuted, fontSize: 13 }}>Leave empty to remove the budget or fine-tune alert triggers.</Text>
          <Button title="Save changes" onPress={onSave} />
        </View>

        {/* Alerts & automations */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s16,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5)
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.12),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="bell" size={18} color={accentSecondary} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Alerts & automations</Text>
          </View>
          <View style={{ gap: spacing.s14 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: spacing.s8
            }}>
              <View style={{ flex: 1, paddingRight: spacing.s12 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>Budget thresholds</Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>Ping at 80/100/110% of plan.</Text>
              </View>
              <Switch value={alertsOn} onValueChange={(v) => savePrefs({ alertsOn: v })} />
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: spacing.s8,
              borderTopWidth: 1,
              borderTopColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5)
            }}>
              <View style={{ flex: 1, paddingRight: spacing.s12 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>Pace alerts</Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>Flag when you sprint ahead by 10%.</Text>
              </View>
              <Switch value={paceOn} onValueChange={(v) => savePrefs({ paceOn: v })} />
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: spacing.s8,
              borderTopWidth: 1,
              borderTopColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5)
            }}>
              <View style={{ flex: 1, paddingRight: spacing.s12 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>Weekly digest</Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>Monday 9am snapshot in your inbox.</Text>
              </View>
              <Switch value={digestOn} onValueChange={(v) => savePrefs({ digestOn: v })} />
            </View>
          </View>
        </View>

        {/* Pay cycle rhythm */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s16,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5)
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.12),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="calendar" size={18} color={accentPrimary} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Pay cycle rhythm</Text>
          </View>
          <View style={{ gap: spacing.s12 }}>
            <Text style={{ color: textMuted, fontSize: 14 }}>{cadenceLabel}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
              {cycleOptions.map(option => {
                const active = cycle === option.key;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => saveCycle(option.key)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: spacing.s10,
                      paddingHorizontal: spacing.s16,
                      borderRadius: radius.lg,
                      backgroundColor: active
                        ? accentPrimary
                        : withAlpha(borderSubtle, isDark ? 0.2 : 0.25),
                      borderWidth: 1,
                      borderColor: active
                        ? accentPrimary
                        : withAlpha(borderSubtle, isDark ? 0.3 : 0.4),
                      opacity: pressed ? 0.85 : 1,
                      alignItems: 'center'
                    })}
                  >
                    <Text style={{
                      color: active ? textOnPrimary : textPrimary,
                      fontWeight: '700',
                      fontSize: 14
                    }}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {cycle === 'biweekly' ? (
              <View style={{
                gap: spacing.s10,
                padding: spacing.s12,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.1 : 0.06),
                borderWidth: 1,
                borderColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15)
              }}>
                <Text style={{ color: textMuted, fontSize: 13 }}>
                  Anchor: {anchorISO ? new Date(anchorISO).toDateString() : 'Not set (uses today)'}
                </Text>
                <Button
                  title="Anchor to today"
                  variant="secondary"
                  size="sm"
                  onPress={async () => {
                    const now = new Date().toISOString();
                    setAnchorISO(now);
                    await AsyncStorage.setItem(CYCLE_KEY, JSON.stringify({ cycle, anchor: now }));
                  }}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* Export */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s16,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5)
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.12),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="download" size={18} color={accentSecondary} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Export data</Text>
          </View>
          <Text style={{ color: textMuted, fontSize: 14 }}>
            Export this period's ledger to review it offline or keep a backup.
          </Text>
          <Button
            title="Export CSV (this period)"
            variant="secondary"
            onPress={() => exportPeriodCsv(startOfDay(period.start), endOfDay(period.end))}
          />
        </View>
      </Animated.View>
    </ScreenScroll>
  );
}

async function exportPeriodCsv(start: Date, end: Date) {
  try {
    const txAll = require('../store/transactions').useTxStore.getState().transactions || [];
    const rows = txAll
      .filter((t:any)=> {
        const d = new Date(t.date);
        return d >= start && d <= end;
      })
      .map((t:any)=> {
        const dateISO = new Date(t.date).toISOString().slice(0,10);
        const type = t.type || '';
        const amt = Number(t.amount||0).toFixed(2);
        const cat = (t.category||'').replace(/[,\n]/g,' ');
        const note = (t.note||'').replace(/[,\n]/g,' ').trim();
        return `${dateISO},${type},${amt},${cat},${note}`;
      });
    const header = 'date,type,amount,category,note';
    const csv = [header, ...rows].join('\n');
    const name = `fingrow_${start.toISOString().slice(0,10)}__${end.toISOString().slice(0,10)}.csv`;
    const fileUri = ((FileSystem as any)?.documentDirectory || (FileSystem as any)?.cacheDirectory || '') + name;
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' as any });
    await Share.share({ url: fileUri, message: 'FinGrow CSV', title: 'Share FinGrow CSV' })
      .catch(()=> Alert.alert('CSV saved', `Saved to: ${fileUri}`));
  } catch (e) {
    Alert.alert('Export failed', 'Sorry, could not create the CSV.');
  }
}
