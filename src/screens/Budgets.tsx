import AsyncStorage from '@react-native-async-storage/async-storage';

import React, { useEffect, useState } from 'react';
import { View, Text, Switch, Alert, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { ScreenScroll } from '../components/ScreenScroll';
import { detectRecurring, forecastUpcoming } from '../lib/recurrence';
import { useEnvelopesStore } from '../store/envelopes';
import { useRecurringStore, computeNextDue } from '../store/recurring';
import { ensureWeeklyDigest, maybeFirePaceAlert, maybeFireThresholdAlerts, toggleWeeklyDigest } from '../lib/budgetAlerts';
import { ProgressBar } from '../components/ProgressBar';
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

export const Budgets: React.FC = () => {
  const { get } = useThemeTokens();
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
  const remaining = Math.max(0, budget - spent);
  const safePerDay = daysLeft>0 ? remaining/daysLeft : 0;
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
    <ScreenScroll>
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text onPress={() => nav.goBack()} style={{ color: get('text.muted') as string, fontWeight: '600' }}>Close</Text>
          <Text onPress={onSave} style={{ color: get('accent.primary') as string, fontWeight: '700' }}>Save</Text>
        </View>
        <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s4, marginBottom: spacing.s4 }}>Budget</Text>
        
        {/* Export CSV */}
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Export</Text>
          <Text style={{ color: get('text.muted') as string }}>Download all transactions in this period as CSV.</Text>
          <Button title="Export CSV (this period)" variant="secondary" onPress={() => exportPeriodCsv(startOfDay(period.start), endOfDay(period.end))} />
        </View>

        {/* period label */}
        <Text style={{ color: get('text.muted') as string, marginTop: spacing.s8 }}>
          {startOfDay(period.start).toDateString()} – {endOfDay(period.end).toDateString()}
        </Text>

        {/* --- FinGrow hi-impact tiles --- */}
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Safe to spend today</Text>
          <Text style={{ color: get('text.onSurface') as string, fontSize: 28, fontWeight: '800' }}>{fmtMoney(Math.max(0, Math.floor(safePerDayAdj)))}</Text>
          <Text style={{ color: get('text.muted') as string }}>{daysLeft} day(s) left • Remaining (after holds) {fmtMoney(remainingAfterHolds)}</Text>
        </View>
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Budget used</Text>
          <ProgressBar value={budget>0?spent/budget:0} />
          <Text style={{ color: get('text.muted') as string }}>{`${(usedRatio*100).toFixed(0)}% • ${fmtMoney(spent)} / ${fmtMoney(budget)}`}</Text>
          <Text style={{ color: get('text.muted') as string }}>
            {paceDelta <= 0 ? `On pace • ${fmtMoney(Math.abs(paceDelta))} under` : `Ahead of pace by ${fmtMoney(paceDelta)}`}
          </Text>
        </View>
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s8 }}>
          
        {/* Envelopes */}
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Category envelopes</Text>
          <Button title="Edit envelopes" variant="secondary" onPress={() => nav.navigate('Envelopes')} />
        </View>
        {/* Upcoming bills hold */}
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Upcoming bills</Text>
          <Text style={{ color: get('text.onSurface') as string }}>
            Holding {fmtMoney(holdAmount)} for bills due before {endOfDay(period.end).toDateString()}
          </Text>
          {holdItems.length === 0 ? <Text style={{ color: get('text.muted') as string }}>No upcoming bills in this period.</Text> : null}
          {holdItems.slice(0,5).map((it: any) => (
            <View key={it.key} style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: get('text.onSurface') as string }}>{it.label}</Text>
              <Text style={{ color: get('text.muted') as string }}>{fmtMoney(it.amount)} • {it.due.toDateString()}</Text>
            </View>
          ))}
          <Button title="Manage bills" variant="secondary" onPress={() => nav.navigate('Bills')} />
        </View>

          {budget<=0 ? <Text style={{ color: get('text.muted') as string }}>Set a monthly budget to see envelopes.</Text> : null}
          {cats.map((c, idx) => (
            <View key={c.name+idx} style={{ gap: spacing.s4 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap: spacing.s8 }}>
                <Text style={{ color: get('text.onSurface') as string }}>{c.name}</Text>
                {overrides[c.name] !== undefined ? (
                  <View style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.pill, paddingHorizontal: spacing.s8, paddingVertical: 4 }}>
                    <Text style={{ color: get('text.muted') as string }}>Manual</Text>
                  </View>
                ) : null}
              </View>
                <Text style={{ color: get('text.muted') as string }}>{`${fmtMoney(c.spent)} / ${fmtMoney(Math.max(0, Math.floor(c.cap)))}`}</Text>
              </View>
              <ProgressBar value={c.cap>0? (c.spent/c.cap) : 0} />
              {(c.cap>0 && daysLeft > 0) ? (
                <Text style={{ color: get('text.muted') as string }}>Safe today: {fmtMoney(Math.max(0, Math.floor((c.cap - c.spent) / daysLeft)))}</Text>
              ) : null}

              <Text style={{ color: get('text.muted') as string }}>
                {c.cap>0 ? (c.spent<=c.cap ? `Remaining ${fmtMoney(c.remaining)}` : `Over by ${fmtMoney(c.spent-c.cap)}`) : 'No cap (no history yet)'}
              </Text>
            </View>
          ))}
        </View>


          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Projection</Text>
          <Text style={{ color: get('text.onSurface') as string }}>
            Projected end: {fmtMoney(projected)} {budget>0?`/ ${fmtMoney(budget)}`:''} {projectedOver>0?`• over by ${fmtMoney(projectedOver)}`:''}
          </Text>
          {overrunEta ? <Text style={{ color: get('text.muted') as string }}>Estimated overrun on {overrunEta.toDateString()}</Text> : null}
        </View>
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Alerts</Text>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ color: get('text.onSurface') as string }}>Budget thresholds (80/100/110%)</Text>
            <Switch value={alertsOn} onValueChange={(v)=>savePrefs({alertsOn:v})} />
          </View>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ color: get('text.onSurface') as string }}>Pace alerts (ahead by 10%)</Text>
            <Switch value={paceOn} onValueChange={(v)=>savePrefs({paceOn:v})} />
          </View>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ color: get('text.onSurface') as string }}>Weekly digest (Mon 9am)</Text>
            <Switch value={digestOn} onValueChange={(v)=>savePrefs({digestOn:v})} />
          </View>
        </View>

        {/* Pay cycle */}
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Pay cycle</Text>
          <View style={{ flexDirection:'row', gap: spacing.s12 }}>
            <Button title="Monthly" variant={cycle==='monthly'?'primary':'secondary'} onPress={() => saveCycle('monthly')} />
            <Button title="Bi-weekly" variant={cycle==='biweekly'?'primary':'secondary'} onPress={() => saveCycle('biweekly')} />
          </View>
          {cycle==='biweekly' ? <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: get('text.muted') as string }}>Anchor: {anchorISO ? new Date(anchorISO).toDateString() : 'not set (will use today)'}</Text>
            <Button title="Set anchor to today" variant="secondary" onPress={async () => {
              const now = new Date().toISOString();
              setAnchorISO(now);
              await AsyncStorage.setItem(CYCLE_KEY, JSON.stringify({ cycle, anchor: now }));
            }} />
          </View> : null}
        </View>
        {/* --- end hi-impact tiles --- */}

        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Monthly budget</Text>
          <Input value={budgetText} onChangeText={setBudgetText} placeholder="e.g. 1200" keyboardType="numeric" />
          <Text style={{ color: get('text.muted') as string }}>Leave empty to remove budget.</Text>
        </View>
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Alert threshold</Text>
          <Input value={thresholdText} onChangeText={setThresholdText} placeholder="80" keyboardType="numeric" />
          <Text style={{ color: get('text.muted') as string }}>Warning when you hit this % of your budget (default 80%).</Text>
        </View>
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
