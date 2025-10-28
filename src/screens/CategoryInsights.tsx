import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
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
  const borderSubtle = get('border.subtle') as string;

  const topCategory = cats[0];
  const trackedCategorySpend = cats.reduce((sum, c) => sum + c.spent, 0);
  const totalCategoryCap = cats.reduce((sum, c) => sum + (c.cap || 0), 0);
  const categoryCoveragePct = totalCategoryCap > 0 ? Math.min(999, Math.round((trackedCategorySpend / totalCategoryCap) * 100)) : null;
  const categoryRemainingTotal = Math.max(0, totalCategoryCap - trackedCategorySpend);

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s24 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s16 }}>
        {/* Header */}
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
            <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.s2 }}>
              Category Spotlight
            </Text>
          </View>
          <Pressable
            onPress={() => nav.navigate('Envelopes')}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginRight: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? surface1 : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="edit" size={24} color={accentPrimary} />
          </Pressable>
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
            {/* Overview Card */}
            <View style={{
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.28 : 0.16),
              borderRadius: radius.xl,
              padding: spacing.s16,
              gap: spacing.s12,
              borderWidth: 1,
              borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 0.9)
            }}>
              <Text style={{ color: accentSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Overview
              </Text>
              <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800' }}>
                {topCategory ? topCategory.name : 'Keep categorizing your spend'}
              </Text>
              <Text style={{ color: textMuted, fontSize: 15 }}>
                {topCategory
                  ? `${fmtMoney(topCategory.spent)} spent · ${topCategory.cap > 0 ? `${Math.round(Math.min(100, topCategory.ratio * 100))}% of cap` : 'No cap yet'}`
                  : `We'll surface your most active envelope once you have more data.`}
              </Text>
              {categoryCoveragePct != null ? (
                <Text style={{ color: textMuted, fontSize: 14 }}>
                  {categoryCoveragePct}% of tracked caps used · {fmtMoney(categoryRemainingTotal)} remaining
                </Text>
              ) : null}
              <Text style={{ color: textMuted, fontSize: 14 }}>
                {cats.length ? `${cats.length} tracked categories` : 'No categories tracked yet'}
              </Text>
            </View>

            {/* Focus Category */}
            {topCategory ? (
              <View style={{
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.22 : 0.12),
                borderRadius: radius.xl,
                padding: spacing.s16,
                gap: spacing.s8,
                borderWidth: 1,
                borderColor: withAlpha(accentPrimary, isDark ? 0.3 : 0.2)
              }}>
                <Text style={{ color: accentPrimary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Focus category
                </Text>
                <Text style={{ color: textPrimary, fontSize: 22, fontWeight: '800' }}>{topCategory.name}</Text>
                <Text style={{ color: textMuted }}>
                  {fmtMoney(topCategory.spent)} spent · {topCategory.cap > 0 ? `${Math.round(Math.min(100, topCategory.ratio * 100))}% of cap` : 'No cap yet'}
                </Text>
                {topCategory.cap > 0 ? (
                  <Text style={{ color: textMuted }}>
                    Daily runway: {fmtMoney(Math.max(0, Math.floor((topCategory.cap - topCategory.spent) / Math.max(1, daysLeft))))}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* All Categories */}
            <View style={{ gap: spacing.s10 }}>
              {cats.map((c, idx) => {
                const pct = c.cap > 0 ? Math.round(Math.min(100, (c.spent / c.cap) * 100)) : 0;
                const barColor = idx % 2 === 0 ? accentPrimary : accentSecondary;
                return (
                  <View
                    key={`${c.name}-${idx}`}
                    style={{
                      borderRadius: radius.xl,
                      backgroundColor: surface1,
                      borderWidth: 1,
                      borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1),
                      padding: spacing.s16,
                      gap: spacing.s10
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>{c.name}</Text>
                      <Text style={{ color: textMuted, fontSize: 14 }}>{fmtMoney(c.spent)} / {fmtMoney(c.cap || 0)}</Text>
                    </View>
                    <View style={{
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: withAlpha(barColor, isDark ? 0.15 : 0.12),
                      overflow: 'hidden'
                    }}>
                      <View style={{
                        height: '100%',
                        width: `${Math.min(100, c.cap > 0 ? (c.spent / c.cap) * 100 : 0)}%`,
                        backgroundColor: barColor,
                        borderRadius: 5
                      }} />
                    </View>
                    <Text style={{ color: textMuted, fontSize: 14 }}>
                      {c.cap > 0
                        ? (c.spent <= c.cap ? `${fmtMoney(c.cap - c.spent)} remaining · ${pct}% used` : `Over by ${fmtMoney(c.spent - c.cap)}`)
                        : 'Learning spend profile'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Edit Button */}
            <Button title="Edit envelope caps" onPress={() => nav.navigate('Envelopes')} />
          </>
        )}
      </View>
    </ScreenScroll>
  );
}
