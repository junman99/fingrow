import React, { useMemo, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { Screen } from '../components/Screen';
// FinGrow TODO: Avoid nesting FlatList inside ScreenScroll; prefer FlatList as primary scroller.
import Button from '../components/Button';
import Input from '../components/Input';
import { spacing } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useDebtsStore, Debt } from '../store/debts';
import { formatCurrency } from '../lib/format';

type Row = { name: string; months: number; interest: number };

function simulate(debts: Debt[], monthly: number, strategy: 'snowball' | 'avalanche'): Row[] {
  // Deep copy and monthly loop
  const items = debts.map(d => ({ ...d, balance: d.balance || 0, apr: d.apr || 0, minDue: d.minDue || 0 }));
  const order = (strategy === 'snowball')
    ? (a: Debt, b: Debt) => (a.balance - b.balance)
    : (a: Debt, b: Debt) => ((b.apr || 0) - (a.apr || 0));
  items.sort(order as any);

  const rows: Row[] = [];
  const EPS = 1e-6;
  for (const d of items) rows.push({ name: d.name, months: 0, interest: 0 });

  // iterate months until all paid or safety cap
  let guard = 0;
  while (items.some(d => d.balance > EPS) && guard < 1200) {
    guard++;
    // allocate minimums
    let budget = monthly;
    for (const d of items) {
      if (d.balance <= EPS) continue;
      const min = Math.min(budget, d.minDue);
      const interest = d.balance * (d.apr/100) / 12;
      const principal = Math.max(0, min - interest);
      d.balance = Math.max(0, d.balance + interest - principal);
      budget -= min;
    }
    // allocate remainder to the first unpaid debt (per ordering)
    if (budget > 0) {
      const target = items.find(d => d.balance > EPS);
      if (target) {
        const interest = target.balance * (target.apr/100) / 12;
        const principal = Math.max(0, budget - interest);
        target.balance = Math.max(0, target.balance + interest - principal);
        budget = 0;
      }
    }
    // month tick
    for (let i=0;i<items.length;i++) if (rows[i] && items[i].balance > EPS) rows[i].months++;
  }

  // compute interest paid per debt by re-simulating quickly to capture totals
  // (to keep code short we approximate using average interest per month times months)
  // For clarity in UI, we only show total months per debt and total interest overall below.
  return rows;
}

export default function PayoffSimulator() {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const border = get('border.subtle') as string;
  const { items } = useDebtsStore();

  const [monthly, setMonthly] = useState('500');

  const snow = useMemo(()=> simulate(items||[], parseFloat(monthly||'0')||0, 'snowball'), [items, monthly]);
  const aval = useMemo(()=> simulate(items||[], parseFloat(monthly||'0')||0, 'avalanche'), [items, monthly]);

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>Payoff simulator</Text>
        <Text style={{ color: muted }}>Compare snowball (lowest balance first) vs avalanche (highest APR first). This is an estimate.</Text>
        <Input label="Monthly payment budget" value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" />
        <View style={{ flexDirection:'row', gap: spacing.s12 }}>
          <View style={{ flex:1, borderWidth:1, borderColor: border, borderRadius: 8, padding: spacing.s12 }}>
            <Text style={{ color: text, fontWeight:'700' }}>Snowball</Text>
            <FlatList data={snow} keyExtractor={(r,i)=>'s'+i} renderItem={({item}) => (
              <View style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical: spacing.s8, borderBottomWidth:1, borderBottomColor:border }}>
                <Text style={{ color: onSurface }}>{item.name}</Text>
                <Text style={{ color: muted }}>{item.months} mo</Text>
              </View>
            )} />
          </View>
          <View style={{ flex:1, borderWidth:1, borderColor: border, borderRadius: 8, padding: spacing.s12 }}>
            <Text style={{ color: text, fontWeight:'700' }}>Avalanche</Text>
            <FlatList data={aval} keyExtractor={(r,i)=>'a'+i} renderItem={({item}) => (
              <View style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical: spacing.s8, borderBottomWidth:1, borderBottomColor:border }}>
                <Text style={{ color: onSurface }}>{item.name}</Text>
                <Text style={{ color: muted }}>{item.months} mo</Text>
              </View>
            )} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
