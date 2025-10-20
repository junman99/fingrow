import AsyncStorage from '@react-native-async-storage/async-storage';

import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Switch, Alert, Share, Pressable, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../components/ScreenScroll';
import { detectRecurring, forecastUpcoming } from '../lib/recurrence';
import { useEnvelopesStore } from '../store/envelopes';
import { useRecurringStore, computeNextDue } from '../store/recurring';
import { ensureWeeklyDigest, maybeFirePaceAlert, maybeFireThresholdAlerts, toggleWeeklyDigest } from '../lib/budgetAlerts';
import Button from '../components/Button';
import Input from '../components/Input';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useBudgetsStore } from '../store/budgets';

export const CYCLE_KEY = 'fingrow/budget/cycle';
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

export const Budgets: React.FC = () => {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { monthlyBudget, setMonthlyBudget, warnThreshold, setWarnThreshold, hydrate, ready } = useBudgetsStore();
  const { overrides, hydrate: hydrateEnv, ready: readyEnv } = useEnvelopesStore();
  useEffect(()=>{ if(!readyEnv) hydrateEnv(); }, [readyEnv]);
  // Alert toggles (persisted)
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
    setAlertsOn(payload.alertsOn); setPaceOn(payload.paceOn); setDigestOn(payload.digestOn);
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(payload));
    // manage digest schedule live
    toggleWeeklyDigest(payload.digestOn);
  };

  const { transactions } = require('../store/transactions').useTxStore.getState();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [anchorISO, setAnchorISO] = useState<string | null>(null);
  useEffect(() => { (async () => { try { const raw = await AsyncStorage.getItem(CYCLE_KEY); if (raw) { const parsed = JSON.parse(raw); if (parsed?.cycle) setCycle(parsed.cycle); if (parsed?.anchor) setAnchorISO(parsed.anchor); } } catch {} })(); }, []);
  const saveCycle = async (c: Cycle) => { const payload = { cycle: c, anchor: c === 'biweekly' ? (anchorISO || new Date().toISOString()) : null }; setCycle(c); if (c==='biweekly' && !anchorISO) setAnchorISO(payload.anchor); await AsyncStorage.setItem(CYCLE_KEY, JSON.stringify(payload)); };
  const today = new Date();
  const period = cycle === 'monthly' ? { start: startOfMonth(today), end: endOfMonth(today) } : getBiweeklyPeriod(anchorISO, today);
  const totalDays = Math.max(1, Math.round((endOfDay(period.end).getTime() - startOfDay(period.start).getTime()) / 86400000));
  const daysPassed = Math.min(totalDays, Math.max(0, Math.round((endOfDay(today).getTime() - startOfDay(period.start).getTime()) / 86400000)));
  const daysLeft = Math.max(0, totalDays - daysPassed);
  const spent = (transactions || []).filter((t: any) => t.type==='expense' && new Date(t.date) >= period.start && new Date(t.date) <= period.end).reduce((s: number, t: any) => s + (Number(t.amount)||0), 0);
  const budget = monthlyBudget || 0;
  const usedRatio = budget>0 ? spent/budget : 0;
  const expectedByToday = budget * (daysPassed/totalDays);
  const paceDelta = spent - expectedByToday;
  const recentStart = new Date(today.getTime() - 14*86400000);
  const recentSpent = (transactions||[]).filter((t:any)=>t.type==='expense' && new Date(t.date)>=recentStart && new Date(t.date)<=today).reduce((s:number,t:any)=>s+(Number(t.amount)||0),0);
  const recentDays = Math.max(1, Math.round((endOfDay(today).getTime() - startOfDay(recentStart).getTime())/86400000));
  const avgDaily = recentSpent/recentDays;
  const projected = spent + avgDaily*daysLeft;
  const projectedOver = budget>0 ? (projected - budget) : 0;
  let overrunEta: Date | null = null;
  // Upcoming bills hold (detect recurring from last 6+ months data)
  const allTx = require('../store/transactions').useTxStore.getState().transactions || [];
  const recSeries = detectRecurring(allTx, today);

  // Prefer explicit templates (user-managed bills); fall back to detection if none
  const { items: tmpl } = require('../store/recurring').useRecurringStore.getState();
  const tmplItems = (tmpl || []).map((t:any)=>{
    const next = computeNextDue(t, today);
    return next && next <= period.end ? { key: t.id, label: t.label || t.category, category: t.category, amount: t.amount, due: next } : null;
  }).filter(Boolean) as any[];
  const useTemplates = tmplItems.length > 0;
  const holdItems = useTemplates ? tmplItems : forecastUpcoming(recSeries, today, period.end, today);

  const holdAmount = holdItems.reduce((s,it)=> s + (Number(it.amount)||0), 0);

  // Adjust safe-to-spend using holds
  const remainingAfterHolds = Math.max(0, budget - spent - holdAmount);
  const safePerDayAdj = daysLeft > 0 ? remainingAfterHolds / daysLeft : 0;

  // Category envelopes (auto from history)
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
  }).sort((a,b)=> (b.spent - a.spent)).slice(0,5);

  if (budget>0 && avgDaily>0) { const need = budget - spent; if (need<0) overrunEta = today; else { const d = Math.ceil(need/avgDaily); overrunEta = new Date(today.getTime()+d*86400000); if (overrunEta>period.end) overrunEta=null; } }

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;
  const warningColor = get('semantic.warning') as string;
  const dangerColor = get('semantic.danger') as string;
  const successColor = get('semantic.success') as string;

  const heroGradient: [string, string] = isDark ? ['#0b1026', '#1a163a'] : [accentPrimary, accentSecondary];
  const heroText = isDark ? textPrimary : textOnPrimary;
  const heroMuted = withAlpha(heroText, isDark ? 0.72 : 0.78);
  const heroBorder = withAlpha('#ffffff', isDark ? 0.18 : 0.35);

  const usedPct = budget > 0 ? Math.round(Math.min(999, usedRatio * 100)) : 0;
  const progressColor = usedRatio >= 1 ? dangerColor : usedRatio >= warnThreshold ? warningColor : accentPrimary;
  const riskLabel = usedRatio >= 1 ? 'Over budget' : usedRatio >= warnThreshold ? 'Watch pacing' : 'On track';
  const riskColor = usedRatio >= 1 ? dangerColor : usedRatio >= warnThreshold ? warningColor : successColor;
  const riskBg = withAlpha(riskColor, isDark ? 0.25 : 0.16);
  const paceChipColor = paceDelta <= 0 ? successColor : warningColor;
  const paceChipBg = withAlpha(paceChipColor, isDark ? 0.24 : 0.18);
  const paceChipLabel = paceDelta <= 0
    ? `On pace · ${fmtMoney(Math.abs(paceDelta))} under plan`
    : `Over pace by ${fmtMoney(paceDelta)}`;

  const safePerDayLabel = fmtMoney(Math.max(0, Math.floor(safePerDayAdj)));
  const remainingAfterHoldsLabel = fmtMoney(Math.max(0, remainingAfterHolds));
  const holdSummaryLabel = holdItems.length === 0
    ? 'No bills due this cycle'
    : `${holdItems.length} upcoming bill${holdItems.length === 1 ? '' : 's'}`;
  const periodRangeLabel = `${startOfDay(period.start).toLocaleDateString()} – ${endOfDay(period.end).toLocaleDateString()}`;
  const daysLeftLabel = daysLeft <= 0 ? 'Cycle ending' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
  const cadenceLabel = cycle === 'monthly' ? 'Monthly cycle' : 'Bi-weekly cycle';

  const topCategory = cats[0];

  const heroInsight = useMemo(() => {
    if (!budget) return 'Set a monthly budget to unlock pacing and envelope coaching.';
    if (usedRatio >= 1) return 'You are beyond the plan—press pause on variable spends or adjust envelopes.';
    if (paceDelta > 0) return `Trim ${fmtMoney(paceDelta)} to glide back on track.`;
    if (topCategory) return `Most spend flows into ${topCategory.name}. Give it a fresh cap or audit recent transactions.`;
    return 'Nice balance so far—keep routing spending through envelopes you trust.';
  }, [budget, paceDelta, topCategory, usedRatio]);

  const statCards = useMemo(() => ([
    {
      key: 'spent',
      label: 'Spent so far',
      value: fmtMoney(spent),
      caption: budget > 0 ? `${usedPct}% of plan` : 'No budget set',
      accent: withAlpha(progressColor, isDark ? 0.18 : 0.12)
    },
    {
      key: 'remaining',
      label: 'Remaining budget',
      value: fmtMoney(budget - spent),
      caption: budget > 0 ? daysLeftLabel : 'Set a budget to unlock pacing',
      accent: withAlpha(successColor, isDark ? 0.18 : 0.1)
    },
    {
      key: 'holds',
      label: 'Held for bills',
      value: fmtMoney(holdAmount),
      caption: holdSummaryLabel,
      accent: withAlpha(warningColor, isDark ? 0.2 : 0.14)
    }
  ]), [budget, daysLeftLabel, holdAmount, holdSummaryLabel, isDark, progressColor, spent, successColor, usedPct, warningColor]);

  const nudges = useMemo(() => {
    const items: string[] = [];
    if (budget && paceDelta > 0) items.push(`Freeze ${fmtMoney(paceDelta)} to stay on pace`);
    if (holdItems.length === 0) items.push('Log upcoming bills to protect cash');
    if (cats.some(c => c.cap === 0)) items.push('Assign targets to categories without a cap');
    if (!alertsOn) items.push('Re-enable budget alerts to catch overspend early');
    return items.slice(0, 3);
  }, [alertsOn, budget, cats, holdItems.length, paceDelta]);

  const trackedCategorySpend = cats.reduce((sum, c) => sum + c.spent, 0);
  const totalCategoryCap = cats.reduce((sum, c) => sum + (c.cap || 0), 0);
  const categoryCoveragePct = totalCategoryCap > 0 ? Math.min(999, Math.round((trackedCategorySpend / totalCategoryCap) * 100)) : null;
  const categoryRemainingTotal = Math.max(0, totalCategoryCap - trackedCategorySpend);
  const focusToggleLabel = showCategoryInsights ? 'Hide insights' : 'See insights';

  const cycleOptions: Array<{ key: Cycle; label: string }> = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'biweekly', label: 'Bi-weekly' }
  ];

  const [showCategoryInsights, setShowCategoryInsights] = useState(false);
  const [budgetText, setBudgetText] = useState(monthlyBudget != null ? String(monthlyBudget) : '');
  const [thresholdText, setThresholdText] = useState(String(Math.round(warnThreshold * 100)));

  useEffect(() => { hydrate(); }, []);
  useEffect(() => { if (ready) setBudgetText(monthlyBudget != null ? String(monthlyBudget) : ''); }, [ready, monthlyBudget]);
  useEffect(() => { if (ready) setThresholdText(String(Math.round(warnThreshold * 100))); }, [ready, warnThreshold]);

  const onSave = async () => {
    const val = budgetText.trim() === '' ? null : Number(budgetText);
    await setMonthlyBudget(val && !Number.isNaN(val) ? val : null);
    const thr = Math.min(100, Math.max(1, Number(thresholdText) || 80));
    await setWarnThreshold(thr / 100);
    nav.goBack();
  };

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s24 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => nav.goBack()} hitSlop={8}>
            <Text style={{ color: textMuted, fontWeight: '600' }}>Close</Text>
          </Pressable>
          <Text style={{ color: textPrimary, fontSize: 22, fontWeight: '800' }}>Budget studio</Text>
          <Pressable onPress={onSave} hitSlop={8}>
            <Text style={{ color: accentPrimary, fontWeight: '700' }}>Save</Text>
          </Pressable>
        </View>

        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.s16,
            paddingBottom: spacing.s16 + spacing.s8,
            gap: spacing.s12
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: spacing.s12, gap: spacing.s6 }}>
              <Text style={{ color: heroMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Budget pulse</Text>
              <Text style={{ color: heroText, fontSize: 32, fontWeight: '800' }}>{safePerDayLabel} / day</Text>
              <Text style={{ color: heroMuted }}>{daysLeftLabel} • {cadenceLabel}</Text>
              <Text style={{ color: heroMuted }}>{periodRangeLabel}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.s8 }}>
              <View style={{
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s6,
                borderRadius: radius.pill,
                backgroundColor: riskBg,
                borderWidth: 1,
                borderColor: withAlpha(riskColor, 0.3)
              }}>
                <Text style={{ color: riskColor, fontWeight: '700' }}>{riskLabel}</Text>
              </View>
              <View style={{
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s6,
                borderRadius: radius.pill,
                backgroundColor: paceChipBg,
                borderWidth: 1,
                borderColor: withAlpha(paceChipColor, 0.3)
              }}>
                <Text style={{ color: paceChipColor, fontWeight: '600' }}>{paceChipLabel}</Text>
              </View>
            </View>
          </View>

          <View style={{ height: 12, borderRadius: 6, backgroundColor: withAlpha(heroText, isDark ? 0.16 : 0.22), overflow: 'hidden' }}>
            <View style={{
              width: `${Math.min(100, Math.max(0, usedRatio * 100))}%`,
              height: '100%',
              backgroundColor: progressColor,
              borderRadius: 6
            }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: heroText, fontWeight: '700' }}>{fmtMoney(spent)} / {fmtMoney(budget)}</Text>
            <Text style={{ color: heroMuted }}>{remainingAfterHoldsLabel} safe after holds</Text>
          </View>

          <View style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: heroBorder,
            padding: spacing.s12,
            backgroundColor: withAlpha('#000000', isDark ? 0.18 : 0.08),
            gap: spacing.s6
          }}>
            <Text style={{ color: heroText, fontWeight: '700' }}>Coach note</Text>
            <Text style={{ color: heroMuted }}>{heroInsight}</Text>
          </View>
        </LinearGradient>

        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Cycle highlights</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: spacing.s16 }}
          >
            {statCards.map((card, idx) => (
              <View
                key={card.key}
                style={{
                  width: 168,
                  padding: spacing.s16,
                  borderRadius: radius.xl,
                  backgroundColor: surface1,
                  borderWidth: 1,
                  borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1),
                  gap: spacing.s8,
                  marginRight: idx === statCards.length - 1 ? 0 : spacing.s12
                }}
              >
                <View style={{
                  alignSelf: 'flex-start',
                  backgroundColor: card.accent,
                  paddingHorizontal: spacing.s10,
                  paddingVertical: spacing.s4,
                  borderRadius: radius.pill
                }}>
                  <Text style={{ color: isDark ? heroText : textPrimary, fontWeight: '700', fontSize: 12 }}>{card.label}</Text>
                </View>
                <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800' }}>{card.value}</Text>
                <Text style={{ color: textMuted }}>{card.caption}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {nudges.length ? (
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s12,
            borderWidth: 1,
            borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1)
          }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Smart nudges</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
              {nudges.map((item, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: withAlpha(accentSecondary, isDark ? 0.32 : 0.18),
                    borderRadius: radius.pill,
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s6
                  }}
                >
                  <Text style={{ color: accentSecondary, fontWeight: '600' }}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1)
        }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Projection & pace</Text>
          <View style={{ gap: spacing.s6 }}>
            <Text style={{ color: textMuted }}>Projected end of cycle</Text>
            <Text style={{ color: textPrimary, fontSize: 22, fontWeight: '800' }}>
              {fmtMoney(projected)}{budget > 0 ? ` / ${fmtMoney(budget)}` : ''}
            </Text>
            {projectedOver > 0 ? (
              <Text style={{ color: warningColor }}>Over by {fmtMoney(projectedOver)} if trends continue.</Text>
            ) : (
              <Text style={{ color: successColor }}>Tracking within plan.</Text>
            )}
            {overrunEta ? (
              <Text style={{ color: warningColor }}>Estimated overrun on {overrunEta.toDateString()}.</Text>
            ) : null}
          </View>
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: textMuted }}>Cash shielded for bills</Text>
            <Text style={{ color: textPrimary, fontWeight: '700' }}>{fmtMoney(holdAmount)} • {holdSummaryLabel}</Text>
          </View>
          <Button title="Review recent transactions" variant="secondary" onPress={() => nav.navigate('TransactionsModal')} />
        </View>

        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1)
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Category spotlight</Text>
            <Button title="Edit envelopes" variant="secondary" onPress={() => nav.navigate('Envelopes')} size="sm" />
          </View>
          {budget <= 0 ? (
            <Text style={{ color: textMuted }}>Set a monthly budget to unlock adaptive envelopes.</Text>
          ) : (
            <>
              <View style={{
                backgroundColor: withAlpha(accentSecondary, isDark ? 0.28 : 0.16),
                borderRadius: radius.lg,
                padding: spacing.s12,
                gap: spacing.s6,
                borderWidth: 1,
                borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 0.9)
              }}>
                <Text style={{ color: accentSecondary, fontWeight: '700' }}>Overview</Text>
                <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800' }}>
                  {topCategory ? topCategory.name : 'Keep categorising your spend'}
                </Text>
                <Text style={{ color: textMuted }}>
                  {topCategory
                    ? `${fmtMoney(topCategory.spent)} spent · ${topCategory.cap > 0 ? `${Math.round(Math.min(100, topCategory.ratio * 100))}% of cap` : 'No cap yet'}`
                    : `We'll surface your most active envelope once you have more data.`}
                </Text>
                {categoryCoveragePct != null ? (
                  <Text style={{ color: textMuted }}>
                    {categoryCoveragePct}% of tracked caps used · {fmtMoney(categoryRemainingTotal)} remaining
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: textMuted }}>
                    {cats.length ? `${cats.length} tracked categories` : 'No categories tracked yet'}
                  </Text>
                  <Button
                    title={focusToggleLabel}
                    variant="secondary"
                    size="sm"
                    onPress={() => setShowCategoryInsights(v => !v)}
                  />
                </View>
              </View>

              {showCategoryInsights ? (
                <>
                  {topCategory ? (
                    <View style={{
                      backgroundColor: withAlpha(accentPrimary, isDark ? 0.22 : 0.12),
                      borderRadius: radius.lg,
                      padding: spacing.s12,
                      gap: spacing.s6
                    }}>
                      <Text style={{ color: accentPrimary, fontWeight: '700' }}>Focus category</Text>
                      <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800' }}>{topCategory.name}</Text>
                      <Text style={{ color: textMuted }}>{fmtMoney(topCategory.spent)} spent · {topCategory.cap > 0 ? `${Math.round(Math.min(100, topCategory.ratio * 100))}% of cap` : 'No cap yet'}</Text>
                      {topCategory.cap > 0 ? (
                        <Text style={{ color: textMuted }}>Daily runway {fmtMoney(Math.max(0, Math.floor((topCategory.cap - topCategory.spent) / Math.max(1, daysLeft))))}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={{ gap: spacing.s10 }}>
                    {cats.map((c, idx) => {
                      const pct = c.cap > 0 ? Math.round(Math.min(100, (c.spent / c.cap) * 100)) : 0;
                      const barColor = idx % 2 === 0 ? accentPrimary : accentSecondary;
                      return (
                        <View
                          key={`${c.name}-${idx}`}
                          style={{
                            borderRadius: radius.lg,
                            backgroundColor: withAlpha(barColor, isDark ? 0.22 : 0.1),
                            padding: spacing.s12,
                            gap: spacing.s6
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: textPrimary, fontWeight: '700' }}>{c.name}</Text>
                            <Text style={{ color: textMuted }}>{fmtMoney(c.spent)} / {fmtMoney(c.cap || 0)}</Text>
                          </View>
                          <View style={{ height: 8, borderRadius: 4, backgroundColor: withAlpha('#ffffff', isDark ? 0.18 : 0.22), overflow: 'hidden' }}>
                            <View style={{
                              height: '100%',
                              width: `${Math.min(100, c.cap > 0 ? (c.spent / c.cap) * 100 : 0)}%`,
                              backgroundColor: barColor
                            }} />
                          </View>
                          <Text style={{ color: textMuted }}>
                            {c.cap > 0
                              ? (c.spent <= c.cap ? `${fmtMoney(c.cap - c.spent)} remaining · ${pct}% used` : `Over by ${fmtMoney(c.spent - c.cap)}`)
                              : 'Learning spend profile'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </>
          )}
        </View>

        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1)
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Upcoming bills hold</Text>
            <Button title="Manage bills" variant="secondary" onPress={() => nav.navigate('Bills')} size="sm" />
          </View>
          <Text style={{ color: textMuted }}>Holding {fmtMoney(holdAmount)} for bills due before {endOfDay(period.end).toDateString()}.</Text>
          {holdItems.length === 0 ? (
            <Text style={{ color: textMuted }}>No upcoming bills logged this cycle.</Text>
          ) : (
            holdItems.slice(0, 5).map((it: any, idx: number) => (
              <View
                key={`${it.key}-${idx}`}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.s4 }}
              >
                <Text style={{ color: textPrimary, flex: 1, marginRight: spacing.s8 }} numberOfLines={1}>{it.label}</Text>
                <Text style={{ color: textMuted }}>{fmtMoney(it.amount)} · {it.due.toDateString()}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1)
        }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Alerts & automations</Text>
          <View style={{ gap: spacing.s10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: spacing.s12 }}>
                <Text style={{ color: textPrimary, fontWeight: '600' }}>Budget thresholds</Text>
                <Text style={{ color: textMuted }}>Ping at 80/100/110% of plan.</Text>
              </View>
              <Switch value={alertsOn} onValueChange={(v) => savePrefs({ alertsOn: v })} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: spacing.s12 }}>
                <Text style={{ color: textPrimary, fontWeight: '600' }}>Pace alerts</Text>
                <Text style={{ color: textMuted }}>Flag when you sprint ahead by 10%.</Text>
              </View>
              <Switch value={paceOn} onValueChange={(v) => savePrefs({ paceOn: v })} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: spacing.s12 }}>
                <Text style={{ color: textPrimary, fontWeight: '600' }}>Weekly digest</Text>
                <Text style={{ color: textMuted }}>Monday 9am snapshot in your inbox.</Text>
              </View>
              <Switch value={digestOn} onValueChange={(v) => savePrefs({ digestOn: v })} />
            </View>
          </View>
        </View>

        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1)
        }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Pay cycle rhythm</Text>
          <Text style={{ color: textMuted }}>{cadenceLabel}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            {cycleOptions.map(option => {
              const active = cycle === option.key;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  onPress={() => saveCycle(option.key)}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.s8,
                    paddingHorizontal: spacing.s16,
                    borderRadius: radius.pill,
                    backgroundColor: active ? accentPrimary : withAlpha(borderSubtle, isDark ? 0.35 : 0.45),
                    borderWidth: active ? 0 : 1,
                    borderColor: withAlpha(borderSubtle, isDark ? 0.45 : 0.6),
                    opacity: pressed ? 0.9 : 1
                  })}
                >
                  <Text style={{ color: active ? textOnPrimary : textPrimary, fontWeight: '700' }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {cycle === 'biweekly' ? (
            <View style={{ gap: spacing.s6 }}>
              <Text style={{ color: textMuted }}>Anchor: {anchorISO ? new Date(anchorISO).toDateString() : 'Not set (uses today)'}</Text>
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

        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1)
        }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Budget settings</Text>
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: textMuted }}>Monthly budget</Text>
            <Input value={budgetText} onChangeText={setBudgetText} placeholder="e.g. 1200" keyboardType="numeric" />
          </View>
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: textMuted }}>Alert threshold (%)</Text>
            <Input value={thresholdText} onChangeText={setThresholdText} placeholder="80" keyboardType="numeric" />
          </View>
          <Text style={{ color: textMuted }}>Leave empty to remove the budget or fine-tune alert triggers.</Text>
          <Button title="Save changes" onPress={onSave} />
        </View>

        <LinearGradient
          colors={isDark ? [withAlpha(accentSecondary, 0.36), withAlpha(accentPrimary, 0.28)] : [withAlpha(accentSecondary, 0.32), withAlpha(accentPrimary, 0.24)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.xl, padding: spacing.s16, gap: spacing.s12 }}
        >
          <Text style={{ color: heroText, fontWeight: '700', fontSize: 16 }}>Need a backup?</Text>
          <Text style={{ color: heroMuted }}>Tap below to export this period's ledger and review it offline.</Text>
          <Button title="Export CSV (this period)" variant="secondary" onPress={() => exportPeriodCsv(startOfDay(period.start), endOfDay(period.end))} />
        </LinearGradient>
      </View>
    </ScreenScroll>
  );
};

export default Budgets;


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
    await Share.share({ url: fileUri, message: 'FinGrow CSV', title: 'Share FinGrow CSV' }).catch(()=> Alert.alert('CSV saved', `Saved to: ${fileUri}`));
  } catch (e) {
    Alert.alert('Export failed', 'Sorry, could not create the CSV.');
  }
}
