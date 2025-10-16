import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/Button';
import { useNavigation } from '@react-navigation/native';
import { useRecurringStore, computeNextDue, Freq } from '../store/recurring';
import { detectRecurring, forecastUpcoming } from '../lib/recurrence';
import { useTxStore } from '../store/transactions';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency } from '../lib/format';
import { CYCLE_KEY } from './Budgets';


function startOfDay(d: Date) { const n = new Date(d); n.setHours(0,0,0,0); return n; }
function endOfDay(d: Date) { const n = new Date(d); n.setHours(23,59,59,999); return n; }
function startOfMonth(d: Date) { const n = new Date(d.getFullYear(), d.getMonth(), 1); n.setHours(0,0,0,0); return n; }
function endOfMonth(d: Date) { const n = new Date(d.getFullYear(), d.getMonth()+1, 0); n.setHours(23,59,59,999); return n; }

function withAlpha(color: string, alpha: number) {
  if (!color) return color;
  if (color.startsWith('#')) {
    const value = color.slice(1);
    const bigint = parseInt(value.length === 6 ? value : value.padEnd(6, '0'), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function getBiweeklyPeriod(anchorISO: string | null, today = new Date()): { start: Date; end: Date; anchor: string } {
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

export default function BillsList() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { items, hydrate, ready, add, update, skipOnce, snooze, remove } = useRecurringStore();
  const addTx = useTxStore(s => s.add);
  const transactions = useTxStore(state => state.transactions || []);

  const [cycle, setCycle] = useState<'monthly' | 'biweekly'>('monthly');
  const [anchorISO, setAnchorISO] = useState<string | null>(null);

  useEffect(() => { if (!ready) hydrate(); }, [ready]);
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CYCLE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.cycle) setCycle(parsed.cycle);
          if (parsed?.anchor) setAnchorISO(parsed.anchor);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const today = new Date();
  const period = cycle === 'monthly'
    ? { start: startOfMonth(today), end: endOfMonth(today) }
    : getBiweeklyPeriod(anchorISO, today);

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const warningColor = get('semantic.warning') as string;
  const successColor = get('semantic.success') as string;
  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;

  const now = new Date();
  const enriched = useMemo(() => {
    const stamp = new Date();
    return (items || []).map(item => ({ item, next: computeNextDue(item, stamp) }));
  }, [items]);

  const activeEntries = enriched.filter(entry => entry.item.active !== false);
  const totalActive = activeEntries.length;
  const upcomingEntries = activeEntries.filter(entry => entry.next && entry.next <= period.end);
  const upcomingAmount = upcomingEntries.reduce((sum, entry) => sum + (Number(entry.item.amount) || 0), 0);

  const soonest = activeEntries
    .filter(entry => entry.next)
    .sort((a, b) => (a.next!.getTime() - b.next!.getTime()))[0];

  const nextDueLabel = soonest?.next
    ? (() => {
        const diffMs = soonest.next!.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / 86400000);
        if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`;
        if (diffDays === 0) return 'Due today';
        if (diffDays === 1) return 'Due tomorrow';
        return `Due in ${diffDays}d`;
      })()
    : 'No upcoming due';

  const detectedSeries = useMemo(() => detectRecurring(transactions, today), [transactions, today]);
  const forecastedSuggestions = useMemo(() => forecastUpcoming(detectedSeries, today, period.end, today) || [], [detectedSeries, period.end, today]);
  const managedLabels = useMemo(() => new Set((items || []).map(it => (it.label || it.category || '').toLowerCase())), [items]);
  const suggestions = useMemo(() => forecastedSuggestions.filter(item => !managedLabels.has((item.label || item.category || '').toLowerCase())).slice(0, 5), [forecastedSuggestions, managedLabels]);

  const heroGradient: [string, string] = isDark ? ['#10192c', '#1f2a45'] : [accentPrimary, accentSecondary];
  const heroText = isDark ? '#eef3ff' : (get('text.onPrimary') as string);
  const heroMuted = withAlpha(heroText, isDark ? 0.74 : 0.78);

  const heroChips = useMemo(() => ([
    { label: 'Due this cycle', value: formatCurrency(upcomingAmount) },
    { label: 'Active bills', value: String(totalActive) },
    { label: 'Next up', value: nextDueLabel }
  ]), [nextDueLabel, totalActive, upcomingAmount]);

  const cardPalette = useMemo<[string, string][]>(() => ([
    [withAlpha(accentPrimary, isDark ? 0.18 : 0.14), withAlpha(accentSecondary, isDark ? 0.22 : 0.16)] as [string, string],
    [withAlpha(successColor, isDark ? 0.2 : 0.12), withAlpha('#2f8ee6', isDark ? 0.2 : 0.14)] as [string, string],
    [withAlpha('#f97316', isDark ? 0.25 : 0.16), withAlpha('#fb7185', isDark ? 0.22 : 0.14)] as [string, string]
  ]), [accentPrimary, accentSecondary, isDark, successColor]);

  const emptyCardStyle = useMemo(() => ({
    backgroundColor: withAlpha(isDark ? '#141b2c' : '#ffffff', isDark ? 0.88 : 1),
    borderRadius: radius.xl,
    padding: spacing.s16,
    borderWidth: 1,
    borderColor: withAlpha(textMuted, isDark ? 0.38 : 0.18)
  }), [isDark, textMuted]);

  const handleCaptureSuggestion = useCallback(async (suggestion: any) => {
    const payload = {
      label: suggestion.label || suggestion.category || 'Bill',
      category: suggestion.category || 'bills',
      amount: Math.max(0, Math.round(Number(suggestion.amount) || 0)),
      freq: 'monthly' as Freq,
      anchorISO: suggestion.due ? new Date(suggestion.due).toISOString() : new Date().toISOString(),
      autoPost: false,
      remind: true,
      active: true,
      autoMatch: true
    };
    await add(payload as any);
  }, [add]);

  const fmtDiff = (next?: Date | null) => {
    if (!next) return { label: 'No schedule', tone: textMuted };
    const diffMs = next.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / 86400000);
    if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)}d`, tone: warningColor };
    if (diffDays === 0) return { label: 'Due today', tone: successColor };
    if (diffDays === 1) return { label: 'Due tomorrow', tone: successColor };
    return { label: `Due in ${diffDays}d`, tone: heroMuted };
  };

  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s16 }}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.xl, padding: spacing.s16, gap: spacing.s12 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: spacing.s4 }}>
              <Text style={{ color: heroText, fontSize: 24, fontWeight: '800' }}>Bill rhythm studio</Text>
              <Text style={{ color: heroMuted }}>Keep recurring costs vibing with your plan.</Text>
            </View>
            <Pressable onPress={() => nav.goBack()} hitSlop={8}>
              <Text style={{ color: heroMuted, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {heroChips.map((chip, idx) => (
              <View
                key={idx}
                style={{
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(heroText, isDark ? 0.14 : 0.25),
                  borderWidth: 1,
                  borderColor: withAlpha(heroText, isDark ? 0.38 : 0.3)
                }}
              >
                <Text style={{ color: heroText, fontWeight: '600' }}>{chip.label}: {chip.value}</Text>
              </View>
            ))}
          </View>
          <Button title="Add bill" variant="primary" onPress={() => nav.navigate('BillEditor')} />
        </LinearGradient>

        {suggestions.length ? (
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s12,
            borderWidth: 1,
            borderColor: borderSubtle
          }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Smart suggestions</Text>
            <Text style={{ color: textMuted }}>Based on your recent transactions, these look like bills worth capturing.</Text>
            {suggestions.map((suggestion, idx) => (
              <View key={idx} style={{
                borderRadius: radius.lg,
                padding: spacing.s12,
                backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.12),
                borderWidth: 1,
                borderColor: withAlpha(accentSecondary, isDark ? 0.35 : 0.18),
                gap: spacing.s6
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: textPrimary, fontWeight: '700' }}>{suggestion.label || suggestion.category || 'Bill suggestion'}</Text>
                  <Text style={{ color: textPrimary, fontWeight: '700' }}>{formatCurrency(Number(suggestion.amount) || 0)}</Text>
                </View>
                <Text style={{ color: textMuted }}>Due around {suggestion.due ? new Date(suggestion.due).toDateString() : 'upcoming'} • {suggestion.category || 'Uncategorised'}</Text>
                <Button
                  title="Add to bills"
                  size="sm"
                  variant="secondary"
                  onPress={() => handleCaptureSuggestion(suggestion)}
                />
              </View>
            ))}
          </View>
        ) : null}

        {(!items || items.length === 0) ? (
          <View style={emptyCardStyle}>
            <Text style={{ color: textMuted }}>No bills yet. Tap “Add bill” to create your first recurring item.</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.s16 }}>
            {enriched.map((entry, idx) => {
              const { item, next } = entry;
              const palette = cardPalette[idx % cardPalette.length];
              const amount = Number(item.amount || 0);
              const dueMeta = fmtDiff(next);
              const inactive = item.active === false;

              return (
                <LinearGradient
                  key={item.id}
                  colors={palette}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: radius.xl, padding: spacing.s16, gap: spacing.s12, opacity: inactive ? 0.7 : 1 }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: spacing.s4 }}>
                      <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>{item.label || item.category}</Text>
                      <Text style={{ color: textMuted }}>{item.freq} • {item.category}</Text>
                    </View>
                    <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 20 }}>{formatCurrency(amount)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: dueMeta.tone, fontWeight: '600' }}>{dueMeta.label}</Text>
                    <Text style={{ color: textMuted }}>{next ? next.toDateString() : 'No anchor'}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s6 }}>
                    <View style={{ paddingHorizontal: spacing.s8, paddingVertical: spacing.s4, borderRadius: radius.pill, backgroundColor: withAlpha(textMuted, isDark ? 0.25 : 0.18) }}>
                      <Text style={{ color: textPrimary, fontWeight: '600' }}>{inactive ? 'Paused' : 'Active'}</Text>
                    </View>
                    <View style={{ paddingHorizontal: spacing.s8, paddingVertical: spacing.s4, borderRadius: radius.pill, backgroundColor: withAlpha(successColor, isDark ? 0.24 : 0.18) }}>
                      <Text style={{ color: textPrimary, fontWeight: '600' }}>{item.autoMatch === false ? 'Auto-match off' : 'Auto-match on'}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                    <Button title="Edit" size="sm" variant="secondary" onPress={() => nav.navigate('BillEditor', { id: item.id })} />
                    <Button
                      title="Mark paid"
                      size="sm"
                      variant="primary"
                      onPress={async () => {
                        await addTx({ type: 'expense', amount: item.amount, category: item.category, note: item.label });
                        const nextDue = computeNextDue(item, new Date(Date.now() + 1000));
                        if (nextDue) await update(item.id, { anchorISO: nextDue.toISOString() });
                      }}
                    />
                    <Button
                      title={expandedId === item.id ? 'Hide actions' : 'More actions'}
                      size="sm"
                      variant="secondary"
                      onPress={() => setExpandedId(prev => (prev === item.id ? null : item.id))}
                    />
                  </View>

                  {expandedId === item.id ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                      <Button
                        title={inactive ? 'Enable' : 'Disable'}
                        size="sm"
                        variant="secondary"
                        onPress={() => update(item.id, { active: inactive })}
                      />
                      <Button title="Skip once" size="sm" variant="secondary" onPress={() => skipOnce(item.id)} />
                      <Button title="Snooze +3d" size="sm" variant="secondary" onPress={() => snooze(item.id, 3)} />
                      <Button title="Snooze +7d" size="sm" variant="secondary" onPress={() => snooze(item.id, 7)} />
                      <Button
                        title={item.autoMatch === false ? 'Auto-match off' : 'Auto-match on'}
                        size="sm"
                        variant="secondary"
                        onPress={() => update(item.id, { autoMatch: !(item.autoMatch !== false) })}
                      />
                      <Button
                        title="Delete"
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          Alert.alert('Delete bill', 'Are you sure you want to delete this recurring item?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => remove(item.id) }
                          ]);
                        }}
                      />
                    </View>
                  ) : null}
                </LinearGradient>
              );
            })}
          </View>
        )}
      </View>
    </ScreenScroll>
  );
}
