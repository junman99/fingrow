import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Linking, ScrollView, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { useBudgetsStore } from '../store/budgets';
import Icon from '../components/Icon';

type Tx = ReturnType<typeof useTxStore.getState>['transactions'][number];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function sameMonth(d: Date, y: number, m: number) { return d.getFullYear() === y && d.getMonth() === m; }

function withAlpha(hex: string, alpha: number) {
  if (!hex) return hex;
  const raw = hex.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toCSV(rows: Tx[]) {
  const header = 'id,type,amount,category,date,note';
  const lines = rows.map(r => [r.id, r.type, r.amount, (r.category||'').replace(/,/g,' '), r.date, (r.note||'').replace(/,/g,' ')].join(','));
  return [header, ...lines].join('\n');
}

// Animated pressable for cards
const AnimatedPressable: React.FC<{
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
}> = ({ onPress, children, style, disabled }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled || !onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || !onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || !onPress}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export const Insights: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { get, isDark } = useThemeTokens();
  const { transactions, hydrate } = useTxStore();
  const { monthlyBudget } = useBudgetsStore();
  const [offset, setOffset] = useState(0); // 0 = current month
  const [granularity, setGranularity] = useState<'daily' | 'monthly'>('monthly');

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => { hydrate(); }, []);

  const now = new Date();
  const ref = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const Y = ref.getFullYear();
  const M = ref.getMonth();
  const prevRef = new Date(Y, M - 1, 1);
  const pY = prevRef.getFullYear();
  const pM = prevRef.getMonth();

  const monthTx = useMemo(() => transactions.filter(t => sameMonth(new Date(t.date), Y, M)), [transactions, Y, M]);
  const prevTx = useMemo(() => transactions.filter(t => sameMonth(new Date(t.date), pY, pM)), [transactions, pY, pM]);

  const totals = useMemo(() => {
    let spend = 0, income = 0;
    for (const t of monthTx) {
      if (t.type === 'expense') spend += Math.abs(Number(t.amount)||0);
      else income += Math.abs(Number(t.amount)||0);
    }
    return { spend, income, net: income - spend };
  }, [monthTx]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTx) {
      if (t.type !== 'expense') continue;
      const key = t.category || 'General';
      map[key] = (map[key] || 0) + Math.abs(Number(t.amount)||0);
    }
    const arr = Object.entries(map).map(([k,v]) => ({ name: k, value: v, pct: totals.spend > 0 ? (v/totals.spend)*100 : 0 }));
    arr.sort((a,b)=>b.value-a.value);
    return arr;
  }, [monthTx, totals.spend]);

  const days = daysInMonth(Y, M);
  const byDay = useMemo(() => {
    const arr = Array.from({ length: days }, () => 0);
    for (const t of monthTx) {
      if (t.type !== 'expense') continue;
      const d = new Date(t.date).getDate();
      arr[d-1] += Math.abs(Number(t.amount)||0);
    }
    return arr;
  }, [monthTx, days]);

  const byWeekday = useMemo(() => {
    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const t of monthTx) {
      if (t.type !== 'expense') continue;
      const day = new Date(t.date).getDay();
      weekdayTotals[day] += Math.abs(Number(t.amount)||0);
      weekdayCounts[day]++;
    }
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return weekdayNames.map((name, idx) => ({
      name,
      total: weekdayTotals[idx],
      count: weekdayCounts[idx],
      avg: weekdayCounts[idx] > 0 ? weekdayTotals[idx] / weekdayCounts[idx] : 0
    }));
  }, [monthTx]);

  const topTransactions = useMemo(() => {
    return monthTx
      .filter(t => t.type === 'expense')
      .map(t => ({ ...t, amount: Math.abs(Number(t.amount)||0) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [monthTx]);

  const biggestDayIdx = byDay.reduce((imax, v, i, a) => v > a[imax] ? i : imax, 0);
  const biggestDayAmt = byDay[biggestDayIdx] || 0;
  const avgPerDay = totals.spend / Math.max(1, days);

  const prevSpend = useMemo(()=> {
    let s=0;
    for(const t of prevTx) if (t.type==='expense') s += Math.abs(Number(t.amount)||0);
    return s;
  }, [prevTx]);

  const deltaAbs = totals.spend - prevSpend;
  const deltaPct = prevSpend > 0 ? (deltaAbs / prevSpend) * 100 : 0;

  // Calculate days passed in current month
  const daysPassed = offset === 0 ? Math.min(now.getDate(), days) : days;
  const daysLeft = days - daysPassed;

  // Budget tracking
  const budgetData = useMemo(() => {
    if (!monthlyBudget || monthlyBudget <= 0) return null;
    const usedPct = (totals.spend / monthlyBudget) * 100;
    const remaining = Math.max(0, monthlyBudget - totals.spend);
    const expectedByNow = monthlyBudget * (daysPassed / days);
    const paceStatus = totals.spend <= expectedByNow ? 'on-track' : 'over-pace';
    const projectedTotal = offset === 0 && daysPassed > 0
      ? (totals.spend / daysPassed) * days
      : totals.spend;
    const projectedOver = Math.max(0, projectedTotal - monthlyBudget);

    return {
      budget: monthlyBudget,
      spent: totals.spend,
      usedPct,
      remaining,
      expectedByNow,
      paceStatus,
      projectedTotal,
      projectedOver
    };
  }, [monthlyBudget, totals.spend, daysPassed, days, offset]);

  const handleEmailCSV = () => {
    const subject = encodeURIComponent(`FinGrow ${ref.toLocaleString(undefined, { month: 'short', year: 'numeric' })} Transactions CSV`);
    const body = encodeURIComponent(toCSV(monthTx));
    const url = `mailto:?subject=${subject}&body=${body}`;
    Linking.openURL(url);
  };

  // Theme colors
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const warningColor = get('semantic.warning') as string;
  const dangerColor = get('semantic.danger') as string;
  const successColor = get('semantic.success') as string;

  const monthLabel = new Date(Y, M, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <ScreenScroll inTab>
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s16 }}>
          {/* Header with back button */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12, marginBottom: spacing.s8 }}>
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
              <Text style={{
                color: textPrimary,
                fontSize: 28,
                fontWeight: '800',
                letterSpacing: -0.5,
                marginTop: spacing.s2
              }}>
                Insights
              </Text>
            </View>
          </View>

          {/* Month selector */}
          <View style={{ gap: spacing.s12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: textMuted,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  fontWeight: '700'
                }}>
                  Deep Dive
                </Text>
                <Text style={{
                  color: textPrimary,
                fontSize: 32,
                fontWeight: '800',
                letterSpacing: -0.5,
                marginTop: spacing.s4
              }}>
                {monthLabel}
              </Text>
            </View>
            <Pressable onPress={handleEmailCSV} hitSlop={12} style={{ paddingTop: spacing.s4 }}>
              <Icon name="share" size={20} colorToken="text.primary" />
            </Pressable>
          </View>

          {/* Navigation Buttons */}
          <View style={{ flexDirection: 'row', gap: spacing.s6 }}>
            <Pressable
              onPress={() => setOffset(offset - 1)}
              hitSlop={12}
              style={{
                paddingVertical: spacing.s8,
                paddingHorizontal: spacing.s16,
                borderRadius: radius.pill,
                backgroundColor: surface2,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s6
              }}
            >
              <Icon name="chevron-left" size={16} colorToken="text.primary" />
              <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 13 }}>Previous</Text>
            </Pressable>
            <Pressable
              onPress={() => { if (offset < 0) setOffset(offset + 1); }}
              disabled={offset === 0}
              hitSlop={12}
              style={{
                paddingVertical: spacing.s8,
                paddingHorizontal: spacing.s16,
                borderRadius: radius.pill,
                backgroundColor: surface2,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s6,
                opacity: offset === 0 ? 0.5 : 1
              }}
            >
              <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 13 }}>Next</Text>
              <Icon name="chevron-right" size={16} colorToken="text.primary" />
            </Pressable>
          </View>
        </View>

        {/* Key Stats - No Cards */}
        <View style={{ gap: spacing.s16, marginTop: spacing.s8 }}>
          {/* Spending */}
          <View>
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s6 }}>
              TOTAL SPENDING
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s8 }}>
              <Text style={{ color: textPrimary, fontSize: 48, fontWeight: '800', letterSpacing: -1.5 }}>
                ${totals.spend.toFixed(0)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4 }}>
                <Icon
                  name={deltaAbs >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={16}
                  color={deltaAbs >= 0 ? dangerColor : successColor}
                />
                <Text style={{
                  color: deltaAbs >= 0 ? dangerColor : successColor,
                  fontSize: 16,
                  fontWeight: '700'
                }}>
                  {Math.abs(deltaPct).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>

          {/* Income & Net Row */}
          <View style={{ flexDirection: 'row', gap: spacing.s20 }}>
            <View>
              <Text style={{ color: textMuted, fontSize: 11, fontWeight: '600', marginBottom: spacing.s4 }}>
                INCOME
              </Text>
              <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800' }}>
                ${totals.income.toFixed(0)}
              </Text>
            </View>
            <View>
              <Text style={{ color: textMuted, fontSize: 11, fontWeight: '600', marginBottom: spacing.s4 }}>
                NET
              </Text>
              <Text style={{
                color: totals.net >= 0 ? successColor : dangerColor,
                fontSize: 24,
                fontWeight: '800'
              }}>
                {totals.net >= 0 ? '+' : ''}${totals.net.toFixed(0)}
              </Text>
            </View>
            {budgetData && (
              <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                <View style={{
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: budgetData.paceStatus === 'on-track'
                    ? withAlpha(successColor, isDark ? 0.25 : 0.15)
                    : withAlpha(warningColor, isDark ? 0.25 : 0.15),
                  borderWidth: 1,
                  borderColor: budgetData.paceStatus === 'on-track'
                    ? withAlpha(successColor, 0.4)
                    : withAlpha(warningColor, 0.4)
                }}>
                  <Text style={{
                    color: budgetData.paceStatus === 'on-track' ? successColor : warningColor,
                    fontSize: 11,
                    fontWeight: '700'
                  }}>
                    {budgetData.paceStatus === 'on-track' ? '✓ On Track' : '⚠ Over Pace'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Section: View Toggle */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s12 }}>
            <Icon name="bar-chart-2" size={18} color={accentPrimary} />
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15, letterSpacing: -0.3 }}>
              View Mode
            </Text>
          </View>
          <View style={{
            flexDirection: 'row',
            backgroundColor: surface2,
            borderRadius: radius.pill,
            padding: spacing.s4,
            gap: spacing.s4
          }}>
            {(['daily', 'monthly'] as const).map(g => (
              <Pressable
                key={g}
                onPress={() => setGranularity(g)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.s10,
                  borderRadius: radius.pill,
                  backgroundColor: granularity === g ? accentPrimary : 'transparent',
                  alignItems: 'center'
                }}
              >
                <Text style={{
                  color: granularity === g ? get('text.onPrimary') as string : textMuted,
                  fontWeight: '700',
                  fontSize: 14
                }}>
                  {g === 'daily' ? 'Daily' : 'Monthly'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Section: Key Metrics */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s12 }}>
            <Icon name="activity" size={18} color={accentPrimary} />
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15, letterSpacing: -0.3 }}>
              Key Metrics
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.s12 }}
          >
          {/* Total Spending Card */}
          <View style={{
            width: 180,
            backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: withAlpha(accentPrimary, 0.3)
          }}>
            <Icon name="trending-up" size={24} color={accentPrimary} />
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginTop: spacing.s12 }}>
              Total Spent
            </Text>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
              ${totals.spend.toFixed(0)}
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.s4,
              marginTop: spacing.s6
            }}>
              <Icon
                name={deltaAbs >= 0 ? 'arrow-up' : 'arrow-down'}
                size={14}
                color={deltaAbs >= 0 ? dangerColor : successColor}
              />
              <Text style={{ color: deltaAbs >= 0 ? dangerColor : successColor, fontSize: 12, fontWeight: '600' }}>
                {Math.abs(deltaPct).toFixed(1)}% vs last
              </Text>
            </View>
          </View>

          {/* Income Card */}
          <View style={{
            width: 180,
            backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.15),
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: withAlpha(successColor, 0.3)
          }}>
            <Icon name="trending-down" size={24} color={successColor} />
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginTop: spacing.s12 }}>
              Income
            </Text>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
              ${totals.income.toFixed(0)}
            </Text>
            <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s6 }}>
              Net: {totals.net >= 0 ? '+' : ''}${totals.net.toFixed(0)}
            </Text>
          </View>

          {/* Average Per Day Card */}
          <View style={{
            width: 180,
            backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.15),
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: withAlpha(accentSecondary, 0.3)
          }}>
            <Icon name="calendar" size={24} color={accentSecondary} />
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginTop: spacing.s12 }}>
              Avg per day
            </Text>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
              ${avgPerDay.toFixed(0)}
            </Text>
            <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s6 }}>
              {daysPassed} of {days} days
            </Text>
          </View>

          {/* Transaction Count Card */}
          <View style={{
            width: 180,
            backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.15),
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: withAlpha(warningColor, 0.3)
          }}>
            <Icon name="receipt" size={24} color={warningColor} />
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginTop: spacing.s12 }}>
              Transactions
            </Text>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
              {monthTx.filter(t => t.type === 'expense').length}
            </Text>
            <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s6 }}>
              expenses logged
            </Text>
          </View>
        </ScrollView>
        </View>

        {/* Section: Budget Tracker (if budget exists) */}
        {budgetData && (
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s14,
            borderWidth: 1,
            borderColor: borderSubtle
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.15),
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name="target" size={16} color={warningColor} />
                </View>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }}>
                  Budget Tracker
                </Text>
              </View>
              <View style={{
                paddingHorizontal: spacing.s10,
                paddingVertical: spacing.s4,
                borderRadius: radius.pill,
                backgroundColor: budgetData.paceStatus === 'on-track'
                  ? withAlpha(successColor, isDark ? 0.2 : 0.15)
                  : withAlpha(warningColor, isDark ? 0.2 : 0.15)
              }}>
                <Text style={{
                  color: budgetData.paceStatus === 'on-track' ? successColor : warningColor,
                  fontSize: 11,
                  fontWeight: '700'
                }}>
                  {budgetData.paceStatus === 'on-track' ? 'On Track' : 'Over Pace'}
                </Text>
              </View>
            </View>

            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.s6 }}>
                <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>
                  ${budgetData.spent.toFixed(0)} / ${budgetData.budget.toFixed(0)}
                </Text>
                <Text style={{ color: textMuted, fontSize: 14 }}>
                  {budgetData.usedPct.toFixed(1)}% used
                </Text>
              </View>
              <View style={{
                height: 12,
                borderRadius: radius.lg,
                backgroundColor: surface2,
                overflow: 'hidden'
              }}>
                <View style={{
                  width: `${Math.min(100, budgetData.usedPct)}%`,
                  height: '100%',
                  backgroundColor: budgetData.usedPct >= 100 ? dangerColor : budgetData.usedPct >= 80 ? warningColor : accentPrimary,
                  borderRadius: radius.lg
                }} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textMuted, fontSize: 12 }}>Remaining</Text>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, marginTop: spacing.s2 }}>
                  ${budgetData.remaining.toFixed(0)}
                </Text>
              </View>
              {offset === 0 && budgetData.projectedOver > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textMuted, fontSize: 12 }}>Projected Over</Text>
                  <Text style={{ color: dangerColor, fontWeight: '700', fontSize: 16, marginTop: spacing.s2 }}>
                    ${budgetData.projectedOver.toFixed(0)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Section: Daily Breakdown (if daily granularity selected) */}
        {granularity === 'daily' && (
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s14,
            borderWidth: 1,
            borderColor: borderSubtle
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name="calendar" size={16} color={accentPrimary} />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }}>
                Daily Breakdown
              </Text>
            </View>
            <View style={{ gap: spacing.s8 }}>
              {byDay.map((amt, idx) => {
                const date = new Date(Y, M, idx + 1);
                const dayName = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
                const isToday = offset === 0 && idx + 1 === now.getDate();
                const pct = totals.spend > 0 ? (amt / totals.spend) * 100 : 0;

                if (amt === 0) return null;

                return (
                  <View key={idx} style={{ gap: spacing.s4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                        <Text style={{ color: isToday ? accentPrimary : textPrimary, fontWeight: isToday ? '700' : '600' }}>
                          {dayName}
                        </Text>
                        {isToday && (
                          <View style={{
                            paddingHorizontal: spacing.s6,
                            paddingVertical: spacing.s2,
                            borderRadius: radius.sm,
                            backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15)
                          }}>
                            <Text style={{ color: accentPrimary, fontSize: 9, fontWeight: '700' }}>TODAY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: textMuted, fontSize: 14 }}>${amt.toFixed(0)}</Text>
                    </View>
                    <View style={{ height: 6, borderRadius: radius.sm, backgroundColor: surface2, overflow: 'hidden' }}>
                      <View style={{
                        width: `${Math.min(100, pct)}%`,
                        height: '100%',
                        backgroundColor: isToday ? accentPrimary : withAlpha(accentPrimary, 0.6),
                        borderRadius: radius.sm
                      }} />
                    </View>
                  </View>
                );
              }).filter(Boolean)}
            </View>

            {/* Biggest Day Highlight */}
            <View style={{
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.15 : 0.1),
              borderRadius: radius.lg,
              padding: spacing.s12,
              marginTop: spacing.s4
            }}>
              <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>Biggest spending day</Text>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                {new Date(Y, M, biggestDayIdx + 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {' '} • ${biggestDayAmt.toFixed(0)}
              </Text>
            </View>
          </View>
        )}

        {/* Section: Category Breakdown */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s14,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name="pie-chart" size={16} color={accentPrimary} />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }}>
                Top Categories
              </Text>
            </View>
            <View style={{
              paddingHorizontal: spacing.s8,
              paddingVertical: spacing.s4,
              borderRadius: radius.pill,
              backgroundColor: surface2
            }}>
              <Text style={{ color: textMuted, fontSize: 11, fontWeight: '600' }}>
                {byCategory.length} total
              </Text>
            </View>
          </View>

          {byCategory.length === 0 ? (
            <Text style={{ color: textMuted, textAlign: 'center', paddingVertical: spacing.s16 }}>
              No spending yet this month
            </Text>
          ) : (
            byCategory.slice(0, 8).map((c, idx) => {
              const colors = [accentPrimary, accentSecondary, successColor, warningColor];
              const color = colors[idx % colors.length];

              return (
                <View key={c.name} style={{ gap: spacing.s6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, flex: 1 }}>
                      <View style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: color
                      }} />
                      <Text style={{ color: textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                        {c.name}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: spacing.s8 }}>
                      <Text style={{ color: textPrimary, fontWeight: '700' }}>${c.value.toFixed(0)}</Text>
                      <Text style={{ color: textMuted, fontSize: 11 }}>{c.pct.toFixed(1)}%</Text>
                    </View>
                  </View>
                  <View style={{ height: 8, borderRadius: radius.lg, backgroundColor: surface2, overflow: 'hidden' }}>
                    <View style={{
                      height: 8,
                      width: `${Math.min(100, c.pct)}%`,
                      borderRadius: radius.lg,
                      backgroundColor: color
                    }} />
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Section: Weekday Analysis */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s14,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="calendar" size={16} color={accentSecondary} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }}>
              Day of Week Patterns
            </Text>
          </View>
          <View style={{ gap: spacing.s8 }}>
            {byWeekday.map((wd, idx) => {
              const maxTotal = Math.max(...byWeekday.map(w => w.total), 1);
              const pct = (wd.total / maxTotal) * 100;
              const isWeekend = idx === 0 || idx === 6;

              return (
                <View key={wd.name} style={{ gap: spacing.s4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <Text style={{
                        color: isWeekend ? accentSecondary : textPrimary,
                        fontWeight: '600',
                        width: 36
                      }}>
                        {wd.name}
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 12 }}>
                        {wd.count} tx
                      </Text>
                    </View>
                    <Text style={{ color: textMuted, fontSize: 14 }}>${wd.total.toFixed(0)}</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: radius.sm, backgroundColor: surface2, overflow: 'hidden' }}>
                    <View style={{
                      width: `${Math.min(100, pct)}%`,
                      height: '100%',
                      backgroundColor: isWeekend ? accentSecondary : accentPrimary,
                      borderRadius: radius.sm
                    }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Section: Top Transactions */}
        {topTransactions.length > 0 && (
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s14,
            borderWidth: 1,
            borderColor: borderSubtle
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: withAlpha(dangerColor, isDark ? 0.2 : 0.15),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name="trending-up" size={16} color={dangerColor} />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }}>
                Biggest Spends
              </Text>
            </View>
            {topTransactions.map((tx, idx) => (
              <View
                key={tx.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.s8,
                  borderBottomWidth: idx < topTransactions.length - 1 ? 1 : 0,
                  borderBottomColor: borderSubtle
                }}
              >
                <View style={{ flex: 1, gap: spacing.s2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: withAlpha(dangerColor, isDark ? 0.2 : 0.15),
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Text style={{ color: dangerColor, fontSize: 12, fontWeight: '800' }}>
                        {idx + 1}
                      </Text>
                    </View>
                    <Text style={{ color: textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                      {tx.note || tx.category || 'Expense'}
                    </Text>
                  </View>
                  <Text style={{ color: textMuted, fontSize: 12, marginLeft: 32 }}>
                    {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {tx.category && ` • ${tx.category}`}
                  </Text>
                </View>
                <Text style={{ color: dangerColor, fontWeight: '800', fontSize: 16, marginLeft: spacing.s12 }}>
                  ${tx.amount.toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Section: Summary Stats */}
        <View style={{
          backgroundColor: withAlpha(isDark ? accentPrimary : accentSecondary, isDark ? 0.15 : 0.1),
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s14,
          borderWidth: 1,
          borderColor: withAlpha(isDark ? accentPrimary : accentSecondary, 0.2)
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: withAlpha(isDark ? accentPrimary : accentSecondary, isDark ? 0.3 : 0.25),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="info" size={16} color={isDark ? accentPrimary : accentSecondary} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }}>
              Monthly Summary
            </Text>
          </View>
          <View style={{ gap: spacing.s10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: textMuted }}>Days in month</Text>
              <Text style={{ color: textPrimary, fontWeight: '600' }}>{days} days</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: textMuted }}>Days elapsed</Text>
              <Text style={{ color: textPrimary, fontWeight: '600' }}>{daysPassed} days</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: textMuted }}>Average daily spend</Text>
              <Text style={{ color: textPrimary, fontWeight: '600' }}>${avgPerDay.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: textMuted }}>Total categories</Text>
              <Text style={{ color: textPrimary, fontWeight: '600' }}>{byCategory.length}</Text>
            </View>
            {offset === 0 && daysLeft > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: textMuted }}>Days remaining</Text>
                <Text style={{ color: textPrimary, fontWeight: '600' }}>{daysLeft} days</Text>
              </View>
            )}
          </View>
        </View>
        </View>
      </Animated.View>
    </ScreenScroll>
  );
};

export default Insights;
