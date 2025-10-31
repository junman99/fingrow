import AsyncStorage from '@react-native-async-storage/async-storage';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, Switch, Alert, Share, Pressable, ScrollView, Animated, Modal, TouchableWithoutFeedback } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../components/ScreenScroll';
import { detectRecurring, forecastUpcoming } from '../lib/recurrence';
import { useEnvelopesStore } from '../store/envelopes';
import { useRecurringStore, computeNextDue } from '../store/recurring';
import { ensureWeeklyDigest, maybeFirePaceAlert, maybeFireThresholdAlerts, toggleWeeklyDigest } from '../lib/budgetAlerts';
import Button from '../components/Button';
import Input from '../components/Input';
import Icon from '../components/Icon';
import ProjectionChart from '../components/ProjectionChart';
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

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Tip tooltip state
  const [showTip, setShowTip] = useState(false);
  const tipOpacity = useRef(new Animated.Value(0)).current;
  const tipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleTip = () => {
    if (showTip) {
      // Hide immediately
      Animated.timing(tipOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowTip(false));
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
    } else {
      // Show and auto-hide after 5 seconds
      setShowTip(true);
      Animated.timing(tipOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      tipTimeoutRef.current = setTimeout(() => {
        Animated.timing(tipOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowTip(false));
      }, 5000);
    }
  };

  useEffect(() => {
    return () => {
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
    };
  }, []);
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
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  useEffect(() => { (async () => { try { const raw = await AsyncStorage.getItem(CYCLE_KEY); if (raw) { const parsed = JSON.parse(raw); if (parsed?.cycle) setCycle(parsed.cycle); if (parsed?.anchor) setAnchorISO(parsed.anchor); } } catch {} })(); }, []);
  const saveCycle = async (c: Cycle) => { const payload = { cycle: c, anchor: c === 'biweekly' ? (anchorISO || new Date().toISOString()) : null }; setCycle(c); if (c==='biweekly' && !anchorISO) setAnchorISO(payload.anchor); await AsyncStorage.setItem(CYCLE_KEY, JSON.stringify(payload)); };

  const today = new Date();
  const period = cycle === 'monthly' ? { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) } : getBiweeklyPeriod(anchorISO, selectedMonth);

  const openMonthPicker = () => {
    setPickerYear(selectedMonth.getFullYear());
    setMonthPickerOpen(true);
  };

  const selectMonth = (year: number, month: number) => {
    const now = new Date();
    // Don't allow future months
    if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth())) return;
    setSelectedMonth(new Date(year, month, 1));
    setMonthPickerOpen(false);
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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

  // Chart data: actual cumulative spending only
  const actualChartData = useMemo(() => {
    const periodTxs = allTx.filter((t: any) =>
      t.type === 'expense' &&
      new Date(t.date) >= period.start &&
      new Date(t.date) <= period.end
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Build cumulative spending by day
    const dailySpending: { t: number; v: number }[] = [];
    let cumulative = 0;
    const startTime = period.start.getTime();

    for (let day = 0; day <= daysPassed; day++) {
      const dayStart = new Date(startTime + day * 24*60*60*1000);
      const dayEnd = new Date(dayStart.getTime() + 24*60*60*1000 - 1);

      const dayTxs = periodTxs.filter((t: any) => {
        const txDate = new Date(t.date);
        return txDate >= dayStart && txDate <= dayEnd;
      });

      cumulative += dayTxs.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
      dailySpending.push({ t: dayStart.getTime(), v: cumulative });
    }

    return dailySpending;
  }, [allTx, period, daysPassed]);

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
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

  const statCards = useMemo(() => {
    // Top category this cycle
    const topCat = cats.length > 0 ? cats[0] : null;
    const topCatPct = topCat && budget > 0 ? Math.round((topCat.spent / budget) * 100) : 0;

    // Biggest single expense
    const periodTxList = (transactions || []).filter((t: any) =>
      t.type === 'expense' &&
      new Date(t.date) >= period.start &&
      new Date(t.date) <= period.end
    );
    const biggestTx = periodTxList.length > 0
      ? periodTxList.reduce((max: any, t: any) => (Number(t.amount) > Number(max.amount) ? t : max), periodTxList[0])
      : null;

    // Spending trend - compare to last cycle
    const lastCycleStart = new Date(period.start);
    const lastCycleEnd = new Date(period.end);
    const cycleDuration = period.end.getTime() - period.start.getTime();
    lastCycleStart.setTime(lastCycleStart.getTime() - cycleDuration);
    lastCycleEnd.setTime(lastCycleEnd.getTime() - cycleDuration);

    const lastCycleSpent = (transactions || [])
      .filter((t: any) => t.type === 'expense' && new Date(t.date) >= lastCycleStart && new Date(t.date) <= lastCycleEnd)
      .reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

    const trendDiff = spent - lastCycleSpent;
    const trendPct = lastCycleSpent > 0 ? Math.round((trendDiff / lastCycleSpent) * 100) : 0;
    const trendLabel = trendDiff > 0
      ? `Up ${Math.abs(trendPct)}% vs last cycle`
      : trendDiff < 0
        ? `Down ${Math.abs(trendPct)}% vs last cycle`
        : 'Same as last cycle';

    return [
      {
        key: 'top-category',
        label: 'Top category',
        value: topCat ? fmtMoney(topCat.spent) : '$0',
        caption: topCat ? `${topCat.name} (${topCatPct}%)` : 'No spending yet',
        accent: withAlpha(accentPrimary, isDark ? 0.2 : 0.14)
      },
      {
        key: 'trend',
        label: 'Spending trend',
        value: trendDiff !== 0 ? fmtMoney(Math.abs(trendDiff)) : '$0',
        caption: trendLabel,
        accent: withAlpha(trendDiff > 0 ? warningColor : successColor, isDark ? 0.2 : 0.14)
      },
      {
        key: 'biggest',
        label: 'Biggest expense',
        value: biggestTx ? fmtMoney(Number(biggestTx.amount)) : '$0',
        caption: biggestTx ? `${biggestTx.category || 'Uncategorized'}` : 'No expenses yet',
        accent: withAlpha(dangerColor, isDark ? 0.2 : 0.14)
      }
    ];
  }, [budget, cats, isDark, spent, successColor, warningColor, accentPrimary, dangerColor, transactions, period]);

  const nudges = useMemo(() => {
    const items: string[] = [];
    if (budget && paceDelta > 0) items.push(`Freeze ${fmtMoney(paceDelta)} to stay on pace`);
    if (holdItems.length === 0) items.push('Log upcoming bills to protect cash');
    if (cats.some(c => c.cap === 0)) items.push('Assign targets to categories without a cap');
    if (!alertsOn) items.push('Re-enable budget alerts to catch overspend early');
    return items.slice(0, 3);
  }, [alertsOn, budget, cats, holdItems.length, paceDelta]);

  const [showCategoryInsights, setShowCategoryInsights] = useState(false);

  const trackedCategorySpend = cats.reduce((sum, c) => sum + c.spent, 0);
  const totalCategoryCap = cats.reduce((sum, c) => sum + (c.cap || 0), 0);
  const categoryCoveragePct = totalCategoryCap > 0 ? Math.min(999, Math.round((trackedCategorySpend / totalCategoryCap) * 100)) : null;
  const categoryRemainingTotal = Math.max(0, totalCategoryCap - trackedCategorySpend);
  const focusToggleLabel = showCategoryInsights ? 'Hide insights' : 'See insights';

  const cycleOptions: Array<{ key: Cycle; label: string }> = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'biweekly', label: 'Bi-weekly' }
  ];
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
  };

  return (
    <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s24 }}>
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
              <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.s2 }}>Budget</Text>
            </View>

            <Pressable
              onPress={() => nav.navigate('BudgetSettings')}
              style={({ pressed }) => ({
                padding: spacing.s8,
                marginRight: -spacing.s8,
                marginTop: -spacing.s4,
                borderRadius: radius.md,
                backgroundColor: pressed ? surface1 : 'transparent',
              })}
              hitSlop={8}
            >
              <Icon name="settings" size={24} color={textPrimary} />
            </Pressable>
          </View>

        {/* Budget Overview - Cleaner, More Visual */}
        <View style={{ gap: spacing.s16 }}>
          {/* Main Budget Display with Progress */}
          <View style={{ gap: spacing.s12 }}>
            {/* Amount Display */}
            <View>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s6 }}>
                AMOUNT SPENT
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s6 }}>
                  <Text style={{ color: textPrimary, fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>
                    {fmtMoney(spent)}
                  </Text>
                  <Text style={{ color: textMuted, fontSize: 20, fontWeight: '600' }}>
                    / {fmtMoney(budget)}
                  </Text>
                </View>

                {/* Month Selector Pill */}
                <Pressable
                  onPress={openMonthPicker}
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

            {/* Progress Bar - Dynamic Color */}
            <View style={{ height: 14, borderRadius: 7, backgroundColor: withAlpha(textMuted, 0.12), overflow: 'hidden' }}>
              <View style={{
                width: `${Math.min(100, Math.max(0, usedRatio * 100))}%`,
                height: '100%',
                backgroundColor: progressColor,
                borderRadius: 7
              }} />
            </View>

            {/* Compact Status Row - Icons + Minimal Text */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.s4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                <Icon name="calendar" size={16} color={textMuted} />
                <Text style={{ color: textMuted, fontSize: 14, fontWeight: '600' }}>{daysLeft}d left</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                <Icon name="clock" size={16} color={textMuted} />
                <Text style={{ color: textMuted, fontSize: 14, fontWeight: '600' }}>{cycle === 'monthly' ? 'Monthly' : 'Bi-weekly'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: riskColor
                }} />
                <Text style={{ color: riskColor, fontSize: 14, fontWeight: '700' }}>{riskLabel} {usedPct}%</Text>
              </View>
            </View>
          </View>

          {/* Pace Info with Tip */}
          {budget > 0 && (
            <View style={{ position: 'relative' }}>
              <View style={{
                padding: spacing.s12,
                paddingRight: spacing.s48,
                borderRadius: radius.lg,
                backgroundColor: paceChipBg,
                borderWidth: 1,
                borderColor: withAlpha(paceChipColor, 0.3),
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <Text style={{ color: paceChipColor, fontWeight: '600', fontSize: 14, flex: 1 }}>
                  {paceDelta <= 0 ? 'On pace' : 'Over pace'} · {safePerDayLabel} safe daily
                </Text>
                <Pressable
                  onPress={toggleTip}
                  style={({ pressed }) => ({
                    position: 'absolute',
                    right: spacing.s12,
                    padding: spacing.s6,
                    borderRadius: radius.pill,
                    backgroundColor: pressed ? withAlpha(paceChipColor, 0.15) : 'transparent',
                  })}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 18 }}>💡</Text>
                </Pressable>
              </View>

              {/* Floating tip bubble */}
              {showTip && (
                <>
                  {/* Backdrop to dismiss */}
                  <Pressable
                    style={{
                      position: 'absolute',
                      top: -1000,
                      left: -spacing.s16,
                      right: -spacing.s16,
                      bottom: 0,
                      height: 2000,
                      zIndex: 10
                    }}
                    onPress={toggleTip}
                  />
                  <Animated.View style={{
                    position: 'absolute',
                    bottom: '100%',
                    marginBottom: spacing.s8,
                    right: 0,
                    left: 0,
                    opacity: tipOpacity,
                    transform: [{
                      translateY: tipOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0]
                      })
                    }],
                    padding: spacing.s14,
                    borderRadius: radius.xl,
                    backgroundColor: isDark ? surface1 : '#ffffff',
                    borderWidth: 2,
                    borderColor: withAlpha(accentPrimary, 0.4),
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: isDark ? 0.5 : 0.15,
                    shadowRadius: 16,
                    elevation: 8,
                    zIndex: 20
                  }}>
                    <Text style={{ color: textPrimary, fontSize: 13, lineHeight: 18 }}>{heroInsight}</Text>
                    {/* Pointer arrow pointing down */}
                    <View style={{
                      position: 'absolute',
                      top: '100%',
                      right: spacing.s20,
                      width: 0,
                      height: 0,
                      borderLeftWidth: 8,
                      borderRightWidth: 8,
                      borderTopWidth: 8,
                      borderLeftColor: 'transparent',
                      borderRightColor: 'transparent',
                      borderTopColor: withAlpha(accentPrimary, 0.4)
                    }} />
                    <View style={{
                      position: 'absolute',
                      top: '100%',
                      marginTop: -2,
                      right: spacing.s20 + 1,
                      width: 0,
                      height: 0,
                      borderLeftWidth: 7,
                      borderRightWidth: 7,
                      borderTopWidth: 7,
                      borderLeftColor: 'transparent',
                      borderRightColor: 'transparent',
                      borderTopColor: isDark ? surface1 : '#ffffff'
                    }} />
                  </Animated.View>
                </>
              )}
            </View>
          )}

          {/* Additional Info */}
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <View style={{ flex: 1, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: surface1, borderWidth: 1, borderColor: borderSubtle }}>
              <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>Held for bills</Text>
              <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18 }}>{fmtMoney(holdAmount)}</Text>
              <Text style={{ color: textMuted, fontSize: 11, marginTop: spacing.s2 }}>{holdSummaryLabel}</Text>
            </View>
            <View style={{ flex: 1, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: surface1, borderWidth: 1, borderColor: borderSubtle }}>
              <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>Safe after holds</Text>
              <Text style={{ color: successColor, fontWeight: '800', fontSize: 18 }}>{remainingAfterHoldsLabel}</Text>
              <Text style={{ color: textMuted, fontSize: 11, marginTop: spacing.s2 }}>{periodRangeLabel}</Text>
            </View>
          </View>
        </View>

        {/* Quick Access Cards */}
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Quick access</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s10 }}>
            <Pressable
              onPress={() => nav.navigate('CategoryInsights')}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.12),
                borderRadius: radius.lg,
                padding: spacing.s12,
                gap: spacing.s6,
                borderWidth: 1.5,
                borderColor: withAlpha(accentPrimary, 0.35),
                opacity: pressed ? 0.7 : 1
              })}
            >
              <Icon name="pie-chart" size={22} color={accentPrimary} />
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>Categories</Text>
              <Text style={{ color: textMuted, fontSize: 12 }}>View breakdown</Text>
            </Pressable>

            <Pressable
              onPress={() => nav.navigate('UpcomingBills')}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.12),
                borderRadius: radius.lg,
                padding: spacing.s12,
                gap: spacing.s6,
                borderWidth: 1.5,
                borderColor: withAlpha(warningColor, 0.35),
                opacity: pressed ? 0.7 : 1
              })}
            >
              <Icon name="calendar" size={22} color={warningColor} />
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>Bills</Text>
              <Text style={{ color: textMuted, fontSize: 12 }}>{holdSummaryLabel}</Text>
            </Pressable>
          </View>
        </View>

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
          gap: spacing.s10,
          borderWidth: 1,
          borderColor: withAlpha(borderSubtle, isDark ? 0.5 : 1)
        }}>
          {/* Title */}
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
            Projection by end of {cycle === 'monthly' ? 'month' : 'period'}
          </Text>

          {/* Summary Stats - Single Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s8, flex: 1 }}>
              <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 }}>
                {fmtMoney(projected)}
              </Text>
              <Text style={{ color: textMuted, fontSize: 16, fontWeight: '600' }}>
                / {fmtMoney(budget)}
              </Text>
            </View>

            {/* Status Badge on Right */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              {projectedOver > 0 ? (
                <View style={{
                  paddingHorizontal: spacing.s10,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.12),
                  borderWidth: 1,
                  borderColor: withAlpha(warningColor, 0.3)
                }}>
                  <Text style={{ color: warningColor, fontSize: 12, fontWeight: '700' }}>
                    ⚠️ Over {fmtMoney(projectedOver)}
                  </Text>
                </View>
              ) : (
                <View style={{
                  paddingHorizontal: spacing.s10,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.12),
                  borderWidth: 1,
                  borderColor: withAlpha(successColor, 0.3)
                }}>
                  <Text style={{ color: successColor, fontSize: 12, fontWeight: '700' }}>
                    ✓ On track
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Overrun ETA if applicable */}
          {overrunEta && (
            <Text style={{ color: warningColor, fontSize: 12, marginTop: -spacing.s4 }}>
              Estimated overrun: {overrunEta.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          )}

          {/* Spending Projection Chart */}
          {actualChartData.length > 0 && budget > 0 && (
            <View style={{ marginHorizontal: -spacing.s8, marginTop: -spacing.s2 }}>
              <ProjectionChart
                actualData={actualChartData}
                projectedValue={projected}
                projectedTime={period.end.getTime()}
                budget={budget}
                height={180}
              />
            </View>
          )}
        </View>

        </View>
      </Animated.View>

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
                    onPress={() => setPickerYear(prev => (prev >= today.getFullYear() ? prev : prev + 1))}
                    hitSlop={8}
                    style={{ padding: spacing.s8, opacity: pickerYear >= today.getFullYear() ? 0.4 : 1 }}
                    disabled={pickerYear >= today.getFullYear()}
                  >
                    <Text style={{ color: textPrimary, fontSize: 20 }}>›</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                  {MONTHS.map((lbl, idx) => {
                    const now = new Date();
                    const afterNow = (pickerYear > now.getFullYear()) || (pickerYear === now.getFullYear() && idx > now.getMonth());
                    const disabled = afterNow;
                    const isSelected = (pickerYear === selectedMonth.getFullYear() && idx === selectedMonth.getMonth());
                    return (
                      <Pressable
                        key={lbl}
                        onPress={() => { if (!disabled) selectMonth(pickerYear, idx); }}
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
    </ScreenScroll>
  );
};

export default Budgets;
