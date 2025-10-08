
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { AppHeader } from '../components/AppHeader';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';

type Tx = ReturnType<typeof useTxStore.getState>['transactions'][number];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function sameMonth(d: Date, y: number, m: number) { return d.getFullYear() === y && d.getMonth() === m; }

function toCSV(rows: Tx[]) {
  const header = 'id,type,amount,category,date,note';
  const lines = rows.map(r => [r.id, r.type, r.amount, (r.category||'').replace(/,/g,' '), r.date, (r.note||'').replace(/,/g,' ')].join(','));
  return [header, ...lines].join('\n');
}

export const Insights: React.FC = () => {
  const { get } = useThemeTokens();
  const { transactions, hydrate } = useTxStore();
  const [offset, setOffset] = useState(0); // 0 = current month
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
    for (const t of monthTx) { if (t.type === 'expense') spend += Math.abs(Number(t.amount)||0); else income += Math.abs(Number(t.amount)||0); }
    return { spend, income };
  }, [monthTx]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTx) { if (t.type !== 'expense') continue; const key = t.category || 'General'; map[key] = (map[key] || 0) + Math.abs(Number(t.amount)||0); }
    const arr = Object.entries(map).map(([k,v]) => ({ name: k, value: v })); arr.sort((a,b)=>b.value-a.value); return arr;
  }, [monthTx]);

  const days = daysInMonth(Y, M);
  const byDay = useMemo(() => {
    const arr = Array.from({ length: days }, () => 0);
    for (const t of monthTx) { if (t.type !== 'expense') continue; const d = new Date(t.date).getDate(); arr[d-1] += Math.abs(Number(t.amount)||0); }
    return arr;
  }, [monthTx, days]);

  const biggestDayIdx = byDay.reduce((imax, v, i, a) => v > a[imax] ? i : imax, 0);
  const biggestDayAmt = byDay[biggestDayIdx] || 0;
  const avgPerDay = totals.spend / Math.max(1, days);

  const prevSpend = useMemo(()=> { let s=0; for(const t of prevTx) if (t.type==='expense') s += Math.abs(Number(t.amount)||0); return s; }, [prevTx]);
  const deltaAbs = totals.spend - prevSpend;
  const deltaPct = prevSpend > 0 ? (deltaAbs / prevSpend) * 100 : 0;

  const handleEmailCSV = () => {
    const subject = encodeURIComponent(`FinGrow ${ref.toLocaleString(undefined, { month: 'short', year: 'numeric' })} Transactions CSV`);
    const body = encodeURIComponent(toCSV(monthTx));
    const url = `mailto:?subject=${subject}&body=${body}`; Linking.openURL(url);
  };

  return (
    <ScreenScroll>
      <AppHeader title="Insights" right={<Pressable accessibilityRole="button" onPress={handleEmailCSV}><Text style={{ color: get('accent.primary') as string, fontWeight: '700' }}>Email CSV</Text></Pressable>} />
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => setOffset(offset - 1)} hitSlop={12} style={{ padding: spacing.s8 }}><Text style={{ color: get('text.primary') as string, fontSize: 18 }}>{'<'}</Text></Pressable>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{new Date(Y, M, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })}</Text>
          <Pressable onPress={() => { if (offset < 0) setOffset(offset + 1); }} disabled={offset === 0} hitSlop={12} style={{ padding: spacing.s8, opacity: offset === 0 ? 0.4 : 1 }}><Text style={{ color: get('text.primary') as string, fontSize: 18 }}>{'>'}</Text></Pressable>
        </View>

        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>This month</Text>
          <Text style={{ color: get('text.muted') as string }}>Spend ${totals.spend.toFixed(0)} • Income ${totals.income.toFixed(0)} • Avg/day ${avgPerDay.toFixed(0)}</Text>
          <Text style={{ color: (deltaAbs >= 0 ? (get('semantic.danger') as string) : (get('semantic.success') as string)), fontWeight: '700' }}>{deltaAbs >= 0 ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}% vs last month</Text>
        </View>

        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Top categories</Text>
          {byCategory.length === 0 ? <Text style={{ color: get('text.muted') as string }}>No spending yet.</Text> : byCategory.slice(0, 8).map(c => {
            const share = totals.spend > 0 ? c.value / totals.spend : 0;
            return (
              <View key={c.name} style={{ gap: spacing.s4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: get('text.primary') as string }}>{c.name}</Text>
                  <Text style={{ color: get('text.muted') as string }}>${c.value.toFixed(0)}</Text>
                </View>
                <View style={{ height: 8, borderRadius: radius.lg, backgroundColor: get('surface.level2') as string }}>
                  <View style={{ height: 8, width: `${Math.min(100, Math.round(share*100))}%`, borderRadius: radius.lg, backgroundColor: get('accent.primary') as string }} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Biggest day</Text>
          <Text style={{ color: get('text.muted') as string }}>{new Date(Y, M, byDay.indexOf(Math.max(...byDay))+1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • ${Math.max(...byDay).toFixed(0)}</Text>
        </View>
      </View>
    </ScreenScroll>
  );
};

export default Insights;
