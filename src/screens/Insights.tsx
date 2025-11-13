import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Linking, ScrollView, Animated, Modal, TouchableWithoutFeedback } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { useBudgetsStore } from '../store/budgets';
import Icon from '../components/Icon';
import AnimatedReanimated, { useAnimatedStyle, useSharedValue, useAnimatedScrollHandler, interpolate, Extrapolate } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Main Tab Title Animation
  const scrollY = useSharedValue(0);

  // Main Tab Title Animation - Animated Styles
  const originalTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );
    return {
      opacity: 1 - progress,
    };
  });

  const floatingTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );
    const fontSize = interpolate(progress, [0, 1], [28, 20]);
    const fontWeight = interpolate(progress, [0, 1], [800, 700]);
    return {
      fontSize,
      fontWeight: fontWeight.toString() as any,
      opacity: progress >= 1 ? 1 : progress,
    };
  });

  const gradientAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );
    return {
      opacity: progress >= 1 ? 1 : progress,
    };
  });

  const combinedScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

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
  const bgDefault = get('background.default') as string;

  const monthLabel = new Date(Y, M, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <>
      {/* Main Tab Title Animation - Floating Gradient Header (Fixed at top, outside scroll) */}
      <AnimatedReanimated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            pointerEvents: 'none',
          },
          gradientAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={[
            bgDefault,
            bgDefault,
            withAlpha(bgDefault, 0.95),
            withAlpha(bgDefault, 0.8),
            withAlpha(bgDefault, 0.5),
            withAlpha(bgDefault, 0)
          ]}
          style={{
            paddingTop: insets.top + spacing.s16,
            paddingBottom: spacing.s32 + spacing.s20,
            paddingHorizontal: spacing.s16,
          }}
        >
          <AnimatedReanimated.Text
            style={[
              {
                color: textPrimary,
                fontSize: 20,
                fontWeight: '700',
                letterSpacing: -0.5,
                textAlign: 'center',
              },
              floatingTitleAnimatedStyle,
            ]}
          >
            Insights
          </AnimatedReanimated.Text>
        </LinearGradient>
      </AnimatedReanimated.View>

      <ScreenScroll
        inTab
        fullScreen
        onScroll={combinedScrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
          <View style={{ paddingHorizontal: spacing.s16, paddingTop: insets.top + spacing.s24, paddingBottom: spacing.s24, gap: spacing.s16 }}>
            {/* Header with back button */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8, marginBottom: spacing.s8 }}>
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
                <AnimatedReanimated.Text style={[{
                  color: textPrimary,
                  fontSize: 28,
                  fontWeight: '800',
                  letterSpacing: -0.5,
                  marginTop: spacing.s2
                }, originalTitleAnimatedStyle]}>
                  Insights
                </AnimatedReanimated.Text>
              </View>

            <Pressable
              onPress={handleEmailCSV}
              style={({ pressed }) => ({
                padding: spacing.s8,
                marginRight: -spacing.s8,
                marginTop: -spacing.s4,
                borderRadius: radius.md,
                backgroundColor: pressed ? surface1 : 'transparent',
              })}
              hitSlop={8}
            >
              <Icon name="share" size={24} color={textPrimary} />
            </Pressable>
          </View>


        {/* Overview Section */}
        <View style={{ gap: spacing.s16 }}>
          {/* Spending */}
          <View>
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s6 }}>
              TOTAL SPENDING
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s6 }}>
                <Text style={{ color: textPrimary, fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>
                  ${totals.spend.toFixed(2)}
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

              {/* Month Selector Pill */}
              <Pressable
                onPress={() => {
                  setPickerYear(selectedMonth.getFullYear());
                  setMonthPickerOpen(true);
                }}
                hitSlop={8}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s10,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: surface2,
                  opacity: pressed ? 0.85 : 1
                })}
              >
                <Text style={{
                  color: textPrimary,
                  fontWeight: '700'
                }}>
                  {selectedMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Income, Net & Budget Status Row */}
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <View style={{ flex: 1, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: surface1, borderWidth: 1, borderColor: borderSubtle }}>
              <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>
                Income
              </Text>
              <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800' }}>
                ${totals.income.toFixed(2)}
              </Text>
            </View>
            <View style={{ flex: 1, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: surface1, borderWidth: 1, borderColor: borderSubtle }}>
              <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>
                Net
              </Text>
              <Text style={{
                color: totals.net >= 0 ? successColor : dangerColor,
                fontSize: 18,
                fontWeight: '800'
              }}>
                {totals.net >= 0 ? '+' : ''}${totals.net.toFixed(2)}
              </Text>
            </View>
            {budgetData && (
              <View style={{ flex: 1, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: surface1, borderWidth: 1, borderColor: borderSubtle, justifyContent: 'space-between' }}>
                <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>
                  Budget
                </Text>
                <View style={{
                  paddingHorizontal: spacing.s10,
                  paddingVertical: spacing.s4,
                  borderRadius: radius.pill,
                  backgroundColor: budgetData.paceStatus === 'on-track'
                    ? withAlpha(successColor, isDark ? 0.25 : 0.15)
                    : withAlpha(warningColor, isDark ? 0.25 : 0.15),
                  borderWidth: 1,
                  borderColor: budgetData.paceStatus === 'on-track'
                    ? withAlpha(successColor, 0.4)
                    : withAlpha(warningColor, 0.4),
                  alignSelf: 'flex-start'
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

          {/* Average Per Day Card */}
          <View style={{
            width: 168,
            backgroundColor: surface1,
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: borderSubtle,
            gap: spacing.s8
          }}>
            <View style={{
              alignSelf: 'flex-start',
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.14),
              paddingHorizontal: spacing.s10,
              paddingVertical: spacing.s4,
              borderRadius: radius.pill
            }}>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 12 }}>Avg per day</Text>
            </View>
            <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800' }}>
              ${avgPerDay.toFixed(2)}
            </Text>
            <Text style={{ color: textMuted, fontSize: 12 }}>
              {daysPassed} of {days} days
            </Text>
          </View>

          {/* Transaction Count Card */}
          <View style={{
            width: 168,
            backgroundColor: surface1,
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: borderSubtle,
            gap: spacing.s8
          }}>
            <View style={{
              alignSelf: 'flex-start',
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.14),
              paddingHorizontal: spacing.s10,
              paddingVertical: spacing.s4,
              borderRadius: radius.pill
            }}>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 12 }}>Transactions</Text>
            </View>
            <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800' }}>
              {monthTx.filter(t => t.type === 'expense').length}
            </Text>
            <Text style={{ color: textMuted, fontSize: 12 }}>
              expenses logged
            </Text>
          </View>

          {/* Top Category Card */}
          {byCategory.length > 0 && (
            <View style={{
              width: 168,
              backgroundColor: surface1,
              borderRadius: radius.xl,
              padding: spacing.s16,
              borderWidth: 1,
              borderColor: borderSubtle,
              gap: spacing.s8
            }}>
              <View style={{
                alignSelf: 'flex-start',
                backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.14),
                paddingHorizontal: spacing.s10,
                paddingVertical: spacing.s4,
                borderRadius: radius.pill
              }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 12 }}>Top category</Text>
              </View>
              <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800' }}>
                ${byCategory[0].value.toFixed(2)}
              </Text>
              <Text style={{ color: textMuted, fontSize: 12 }}>
                {byCategory[0].name} • {byCategory[0].pct.toFixed(2)}%
              </Text>
            </View>
          )}
        </ScrollView>
        </View>

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
                      <Text style={{ color: textPrimary, fontWeight: '700' }}>${c.value.toFixed(2)}</Text>
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
                    <Text style={{ color: textMuted, fontSize: 14 }}>${wd.total.toFixed(2)}</Text>
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
                  ${tx.amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
          </View>
        </Animated.View>
      </ScreenScroll>

      {/* Month Picker Modal */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setMonthPickerOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(8,10,18,0.72)', justifyContent: 'center', alignItems: 'center', padding: spacing.s16 }}>
            <TouchableWithoutFeedback>
              <View style={{
                width: '100%',
                maxWidth: 360,
                backgroundColor: surface1,
                borderRadius: radius.xl,
                padding: spacing.s16,
                shadowColor: '#000',
                shadowOpacity: 0.18,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 10 },
                elevation: 10
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Select month</Text>
                  <Pressable onPress={() => setMonthPickerOpen(false)} hitSlop={8}>
                    <Text style={{ color: textMuted, fontSize: 16 }}>Close</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                  <Pressable
                    onPress={() => setPickerYear(prev => prev - 1)}
                    hitSlop={8}
                    style={{ padding: spacing.s8 }}
                  >
                    <Text style={{ color: textPrimary, fontSize: 20 }}>‹</Text>
                  </Pressable>
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18 }}>{pickerYear}</Text>
                  <Pressable
                    onPress={() => setPickerYear(prev => (prev >= now.getFullYear() ? prev : prev + 1))}
                    hitSlop={8}
                    style={{ padding: spacing.s8, opacity: pickerYear >= now.getFullYear() ? 0.4 : 1 }}
                    disabled={pickerYear >= now.getFullYear()}
                  >
                    <Text style={{ color: textPrimary, fontSize: 20 }}>›</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((lbl, idx) => {
                    const afterNow = (pickerYear > now.getFullYear()) || (pickerYear === now.getFullYear() && idx > now.getMonth());
                    const disabled = afterNow;
                    const isSelected = (pickerYear === selectedMonth.getFullYear() && idx === selectedMonth.getMonth());
                    return (
                      <Pressable
                        key={lbl}
                        onPress={() => {
                          if (!disabled) {
                            const newDate = new Date(pickerYear, idx, 1);
                            setSelectedMonth(newDate);
                            // Calculate offset from current month
                            const currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
                            const monthsDiff = (newDate.getFullYear() - currentDate.getFullYear()) * 12 + (newDate.getMonth() - currentDate.getMonth());
                            setOffset(monthsDiff);
                            setMonthPickerOpen(false);
                          }
                        }}
                        disabled={disabled}
                        style={{
                          width: '23%',
                          paddingVertical: spacing.s10,
                          borderRadius: radius.lg,
                          alignItems: 'center',
                          backgroundColor: isSelected ? surface2 : surface1,
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? accentPrimary : borderSubtle,
                          opacity: disabled ? 0.35 : 1
                        }}
                      >
                        <Text style={{ color: textPrimary, fontWeight: isSelected ? '700' : '500' }}>{lbl}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

export default Insights;
