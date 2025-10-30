import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { detectRecurring, forecastUpcoming } from '../lib/recurrence';
import { useRecurringStore, computeNextDue } from '../store/recurring';
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

function fmtMoney(n: number) {
  try { return new Intl.NumberFormat(undefined, { style:'currency', currency:'SGD', maximumFractionDigits:0 }).format(n); }
  catch { return `S$${n.toFixed(0)}`; }
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

export default function UpcomingBills() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();

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

  const today = new Date();
  const period = cycle === 'monthly'
    ? { start: startOfMonth(today), end: endOfMonth(today) }
    : getBiweeklyPeriod(anchorISO, today);

  // Detect recurring bills
  const allTx = require('../store/transactions').useTxStore.getState().transactions || [];
  const recSeries = detectRecurring(allTx, today);

  // Prefer explicit templates
  const { items: tmpl } = useRecurringStore.getState();
  const tmplItems = (tmpl || []).map((t:any)=>{
    const next = computeNextDue(t, today);
    return next && next <= period.end ? { key: t.id, label: t.label || t.category, category: t.category, amount: t.amount, due: next } : null;
  }).filter(Boolean) as any[];
  const useTemplates = tmplItems.length > 0;
  const holdItems = useTemplates ? tmplItems : forecastUpcoming(recSeries, today, period.end, today);

  const holdAmount = holdItems.reduce((s,it)=> s + (Number(it.amount)||0), 0);
  const holdSummaryLabel = holdItems.length === 0
    ? 'No bills due this cycle'
    : `${holdItems.length} upcoming bill${holdItems.length === 1 ? '' : 's'}`;

  const accentPrimary = get('accent.primary') as string;
  const warningColor = get('semantic.warning') as string;
  const dangerColor = get('semantic.danger') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;

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
              Upcoming Bills
            </Text>
            <Text style={{ color: textMuted, fontSize: 14, marginTop: spacing.s4 }}>
              Due before {endOfDay(period.end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Summary Stats */}
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <View style={{
            flex: 1,
            padding: spacing.s16,
            borderRadius: radius.xl,
            backgroundColor: withAlpha(warningColor, isDark ? 0.15 : 0.08),
            borderWidth: 1,
            borderColor: withAlpha(warningColor, 0.25)
          }}>
            <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Held
            </Text>
            <Text style={{ color: textPrimary, fontWeight: '900', fontSize: 32, letterSpacing: -1 }}>
              {fmtMoney(holdAmount)}
            </Text>
          </View>
          <View style={{
            flex: 1,
            padding: spacing.s16,
            borderRadius: radius.xl,
            backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08),
            borderWidth: 1,
            borderColor: withAlpha(accentPrimary, 0.25)
          }}>
            <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Bills Due
            </Text>
            <Text style={{ color: textPrimary, fontWeight: '900', fontSize: 32, letterSpacing: -1 }}>
              {holdItems.length}
            </Text>
          </View>
        </View>

        {/* Bills List */}
        <View style={{ gap: spacing.s8 }}>
          <Text style={{ color: textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {holdItems.length === 0 ? 'No Bills' : 'Upcoming Bills'}
          </Text>

          {holdItems.length === 0 ? (
            <View style={{
              backgroundColor: surface1,
              borderRadius: radius.xl,
              padding: spacing.s24,
              alignItems: 'center',
              gap: spacing.s12,
              borderWidth: 1,
              borderColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5)
            }}>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: radius.lg,
                backgroundColor: withAlpha(textMuted, isDark ? 0.15 : 0.08),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name="calendar" size={28} color={textMuted} />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>No upcoming bills</Text>
              <Text style={{ color: textMuted, textAlign: 'center', fontSize: 14 }}>
                Log your recurring bills to protect cash and track spending better.
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.s12 }}>
              {holdItems.map((it: any, idx: number) => {
                const daysUntil = Math.ceil((it.due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                const isUrgent = daysUntil <= 3;
                const isClose = daysUntil <= 7;
                const billColor = isUrgent ? dangerColor : warningColor;

                return (
                  <View
                    key={`${it.key}-${idx}`}
                    style={{
                      backgroundColor: surface1,
                      borderRadius: radius.xl,
                      padding: spacing.s16,
                      borderWidth: 1,
                      borderColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5),
                      gap: spacing.s12
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                      {/* Bill Icon */}
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.md,
                        backgroundColor: withAlpha(billColor, isDark ? 0.2 : 0.12),
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Text style={{
                          color: billColor,
                          fontWeight: '700',
                          fontSize: 16
                        }}>
                          {it.label ? it.label.charAt(0).toUpperCase() : 'B'}
                        </Text>
                      </View>

                      {/* Bill Info */}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{
                          color: textPrimary,
                          fontWeight: '700',
                          fontSize: 15
                        }}>
                          {it.label}
                        </Text>
                        <Text numberOfLines={1} style={{
                          color: textMuted,
                          fontSize: 13,
                          marginTop: 2
                        }}>
                          {it.due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {daysUntil === 0 ? ' • Today!' : daysUntil === 1 ? ' • Tomorrow' : ` • ${daysUntil} days`}
                        </Text>
                      </View>

                      {/* Amount */}
                      <Text style={{
                        color: billColor,
                        fontWeight: '700',
                        fontSize: 15,
                        marginLeft: spacing.s8
                      }}>
                        {fmtMoney(it.amount)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Footer Note */}
        <View style={{
          padding: spacing.s12,
          borderRadius: radius.lg,
          backgroundColor: withAlpha(accentPrimary, isDark ? 0.1 : 0.06),
          borderWidth: 1,
          borderColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15)
        }}>
          <Text style={{ color: textMuted, fontSize: 13, textAlign: 'center' }}>
            Add or edit bills on the Money tab
          </Text>
        </View>
      </Animated.View>
    </ScreenScroll>
  );
}
