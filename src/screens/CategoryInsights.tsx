import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useBudgetsStore } from '../store/budgets';
import { useEnvelopesStore } from '../store/envelopes';

function startOfMonth(d: Date) { const n = new Date(d.getFullYear(), d.getMonth(), 1); n.setHours(0,0,0,0); return n; }
function endOfMonth(d: Date) { const n = new Date(d.getFullYear(), d.getMonth()+1, 0); n.setHours(23,59,59,999); return n; }

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

export default function CategoryInsights() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { monthlyBudget } = useBudgetsStore();
  const { overrides, hydrate: hydrateEnv, ready: readyEnv } = useEnvelopesStore();

  useEffect(()=>{ if(!readyEnv) hydrateEnv(); }, [readyEnv]);

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

  const budget = monthlyBudget || 0;
  const today = new Date();
  const period = { start: startOfMonth(today), end: endOfMonth(today) };
  const totalDays = Math.max(1, Math.round((period.end.getTime() - period.start.getTime()) / 86400000));
  const daysPassed = Math.min(totalDays, Math.max(0, Math.round((today.getTime() - period.start.getTime()) / 86400000)));
  const daysLeft = Math.max(0, totalDays - daysPassed);

  // Category envelopes
  type CatStat = { name: string; spent: number; cap: number; remaining: number; ratio: number };
  const txAll = require('../store/transactions').useTxStore.getState().transactions || [];
  const historyStart = new Date(today.getTime() - 90*86400000);
  const hist = txAll.filter((t:any)=> t.type==='expense' && new Date(t.date) >= historyStart && new Date(t.date) <= today);
  const byCatHist: Record<string, number> = {};
  hist.forEach((t:any)=>{ const c = t.category || 'Other'; byCatHist[c] = (byCatHist[c]||0) + (Number(t.amount)||0); });
  const histTotal = Object.values(byCatHist).reduce((s,n)=>s+n,0) || 1;
  const shares = Object.fromEntries(Object.entries(byCatHist).map(([k,v])=>[k, v/histTotal])) as Record<string, number>;

  const periodTx = txAll.filter((t:any)=> t.type==='expense' && new Date(t.date) >= period.start && new Date(t.date) <= period.end);
  const byCatPeriod: Record<string, number> = {};
  periodTx.forEach((t:any)=>{ const c = t.category || 'Other'; byCatPeriod[c] = (byCatPeriod[c]||0) + (Number(t.amount)||0); });

  const catList = Object.keys({ ...byCatHist, ...byCatPeriod });
  const cats: CatStat[] = catList.map((name)=>{
    const used = byCatPeriod[name] || 0;
    const share = shares[name] || 0;
    const autoCap = budget * share;
    const manual = overrides[name];
    const cap = (manual !== undefined ? manual : autoCap);
    const remaining = Math.max(0, cap - used);
    const ratio = cap>0 ? used/cap : 0;
    return { name, spent: used, cap, remaining, ratio };
  }).sort((a,b)=> (b.spent - a.spent));

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;
  const dangerColor = get('semantic.danger') as string;

  const topCategory = cats[0];
  const trackedCategorySpend = cats.reduce((sum, c) => sum + c.spent, 0);
  const totalCategoryCap = cats.reduce((sum, c) => sum + (c.cap || 0), 0);
  const categoryCoveragePct = totalCategoryCap > 0 ? Math.min(999, Math.round((trackedCategorySpend / totalCategoryCap) * 100)) : null;
  const categoryRemainingTotal = Math.max(0, totalCategoryCap - trackedCategorySpend);

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
              Categories
            </Text>
          </View>
        </View>

        {budget <= 0 ? (
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1)
          }}>
            <Text style={{ color: textMuted }}>Set a monthly budget to unlock adaptive envelopes.</Text>
          </View>
        ) : (
          <>
            {/* Top Summary - No Card */}
            {topCategory && (
              <View style={{ gap: spacing.s8 }}>
                <Text style={{ color: textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Top Spending
                </Text>
                <Text style={{ color: textPrimary, fontSize: 36, fontWeight: '900', letterSpacing: -1.2 }}>
                  {topCategory.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.s16, marginTop: spacing.s4 }}>
                  <View>
                    <Text style={{ color: textMuted, fontSize: 13 }}>Spent</Text>
                    <Text style={{ color: textPrimary, fontSize: 22, fontWeight: '800', marginTop: spacing.s2 }}>
                      {fmtMoney(topCategory.spent)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: textMuted, fontSize: 13 }}>Cap</Text>
                    <Text style={{ color: textPrimary, fontSize: 22, fontWeight: '800', marginTop: spacing.s2 }}>
                      {topCategory.cap > 0 ? fmtMoney(topCategory.cap) : 'Auto'}
                    </Text>
                  </View>
                  {topCategory.cap > 0 && (
                    <View>
                      <Text style={{ color: textMuted, fontSize: 13 }}>Used</Text>
                      <Text style={{ color: textPrimary, fontSize: 22, fontWeight: '800', marginTop: spacing.s2 }}>
                        {Math.round(Math.min(100, topCategory.ratio * 100))}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* All Categories - Visual Bars */}
            <View style={{ gap: spacing.s6 }}>
              {/* Hint */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.s2 }}>
                <Text style={{ color: textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  All Categories
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                  <Text style={{ color: textMuted, fontSize: 12, fontStyle: 'italic' }}>
                    Tap to view transactions
                  </Text>
                  <Pressable
                    onPress={() => nav.navigate('Envelopes')}
                    style={({ pressed }) => ({
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: pressed ? withAlpha(accentPrimary, 0.2) : withAlpha(accentPrimary, 0.15),
                      borderWidth: 1,
                      borderColor: withAlpha(accentPrimary, 0.3),
                      alignItems: 'center',
                      justifyContent: 'center'
                    })}
                    hitSlop={8}
                  >
                    <Icon name="edit" size={16} color={accentPrimary} />
                  </Pressable>
                </View>
              </View>

              {cats.map((c, idx) => {
                const pct = c.cap > 0 ? Math.round(Math.min(100, (c.spent / c.cap) * 100)) : 0;
                const barColor = pct >= 100 ? dangerColor : pct >= 80 ? warningColor : successColor;

                // Animated progress width
                const progressAnim = useRef(new Animated.Value(0)).current;
                useEffect(() => {
                  Animated.timing(progressAnim, {
                    toValue: c.cap > 0 ? Math.min(100, (c.spent / c.cap) * 100) : 0,
                    duration: 800,
                    delay: idx * 100,
                    useNativeDriver: false,
                  }).start();
                }, []);

                return (
                  <Pressable
                    key={`${c.name}-${idx}`}
                    onPress={() => nav.navigate('CategoryTransactions', { category: c.name })}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s2,
                      gap: spacing.s8,
                      opacity: pressed ? 0.6 : 1
                    })}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>{c.name}</Text>
                      <Text style={{ color: textMuted, fontSize: 14, fontWeight: '600' }}>
                        {fmtMoney(c.spent)}{c.cap > 0 ? ` / ${fmtMoney(c.cap)}` : ''}
                      </Text>
                    </View>

                    {/* Animated Progress Bar */}
                    <View style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: withAlpha(barColor, isDark ? 0.15 : 0.1),
                      overflow: 'hidden'
                    }}>
                      <Animated.View style={{
                        height: '100%',
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%']
                        }),
                        backgroundColor: barColor,
                        borderRadius: 4
                      }} />
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: textMuted, fontSize: 12 }}>
                        {c.cap > 0
                          ? (c.spent <= c.cap ? `${fmtMoney(c.cap - c.spent)} left` : `Over by ${fmtMoney(c.spent - c.cap)}`)
                          : 'Learning pattern'}
                      </Text>
                      {c.cap > 0 && (
                        <Text style={{
                          color: barColor,
                          fontSize: 13,
                          fontWeight: '700'
                        }}>
                          {pct}%
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </Animated.View>
    </ScreenScroll>
  );
}
