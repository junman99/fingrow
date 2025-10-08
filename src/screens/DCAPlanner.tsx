import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList } from 'react-native';
import { Screen } from '../components/Screen';
// FinGrow TODO: Avoid nesting FlatList inside ScreenScroll; prefer FlatList as primary scroller.
import Button from '../components/Button';
import { spacing } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useInvestStore } from '../store/invest';
import { usePlansStore } from '../store/plans';
import { formatCurrency } from '../lib/format';
import { useNavigation, useRoute } from '@react-navigation/native';

type RouteParams = { suggest?: number };

export default function DCAPlanner() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const border = get('border.subtle') as string;
  const { holdings, quotes, watchlist, hydrate } = useInvestStore();
  const { plan, hydrate: hydratePlan, save } = usePlansStore();

  const suggest = (route.params as RouteParams)?.suggest ?? 0;
  const [amount, setAmount] = useState<string>(suggest ? String(suggest) : (plan?.amount ? String(plan.amount) : '200'));

  useEffect(()=> { hydrate(); hydratePlan(); }, []);

  // Candidate symbols: prefer holdings; if empty, use watchlist
  const symbols = useMemo(()=> {
    const held = Object.keys(holdings||{});
    if (held.length > 0) return held;
    return watchlist || [];
  }, [holdings, watchlist]);

  // Equal weights by default or from existing plan
  const [weights, setWeights] = useState<Record<string, number>>({});
  useEffect(()=> {
    const base: Record<string, number> = {};
    if (plan?.symbols?.length) {
      // Use existing weights but only for available symbols
      const map: Record<string, number> = {};
      for (const s of plan.symbols) map[s.symbol] = s.weight;
      const syms = symbols;
      const sum = syms.reduce((acc, s)=> acc + (map[s] || 0), 0);
      if (sum > 0) {
        for (const s of syms) base[s] = (map[s] || 0) / sum;
      } else {
        for (const s of syms) base[s] = 1 / Math.max(1, syms.length);
      }
    } else {
      for (const s of symbols) base[s] = 1 / Math.max(1, symbols.length);
    }
    setWeights(base);
  }, [symbols]);

  const totalWeight = Object.values(weights).reduce((a,b)=> a+b, 0) || 1;
  const planRows = symbols.map(s => {
    const w = (weights[s] || 0) / totalWeight;
    const amt = (parseFloat(amount||'0')||0) * w;
    const price = quotes[s]?.last || 0;
    const qty = price > 0 ? amt / price : 0;
    return { symbol: s, weight: w, amount: amt, price, qty };
  });

  function setWeight(sym: string, val: number) {
    const next = { ...weights, [sym]: Math.max(0, val) };
    const sum = Object.values(next).reduce((a,b)=> a+b, 0);
    // normalize
    const norm: Record<string, number> = {};
    for (const k of Object.keys(next)) norm[k] = sum ? next[k]/sum : 0;
    setWeights(norm);
  }

  async function onSave() {
    const amt = parseFloat(amount||'0')||0;
    const symbols = planRows.map(r => ({ symbol: r.symbol, weight: r.weight }));
    await save({ amount: amt, symbols, period: 'monthly' });
    nav.goBack();
  }

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>Plan monthly DCA</Text>
        <Text style={{ color: muted }}>Distribute a monthly amount across your holdings/watchlist. This is a planning tool—no brokerage integration.</Text>

        <View style={{ gap: spacing.s8 }}>
          <Text style={{ color: text, fontWeight: '700' }}>Monthly amount</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad"
            style={{ borderWidth:1, borderColor: border, padding: spacing.s12, borderRadius: 8, color: onSurface }} />
        </View>

        <View style={{ gap: spacing.s8, marginTop: spacing.s8 }}>
          <Text style={{ color: text, fontWeight: '700' }}>Allocation</Text>
          {symbols.length === 0 ? (
            <Text style={{ color: muted }}>No holdings or watchlist yet. Add some symbols first.</Text>
          ) : (
            <FlatList
              data={planRows}
              keyExtractor={(r)=> r.symbol}
              contentContainerStyle={{ gap: spacing.s12 }}
              renderItem={({item}) => (
                <View style={{ borderWidth:1, borderColor: border, borderRadius: 8, padding: spacing.s12 }}>
                  <Text style={{ color: text, fontWeight: '700' }}>{item.symbol}</Text>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: spacing.s8 }}>
                    <Text style={{ color: muted }}>Weight</Text>
                    <Text style={{ color: onSurface }}>{(item.weight*100).toFixed(0)}%</Text>
                  </View>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: spacing.s4 }}>
                    <Text style={{ color: muted }}>Amount</Text>
                    <Text style={{ color: onSurface }}>{formatCurrency(item.amount)}</Text>
                  </View>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: spacing.s4 }}>
                    <Text style={{ color: muted }}>Est. qty (≈ price {item.price ? formatCurrency(item.price) : '—'})</Text>
                    <Text style={{ color: onSurface }}>{item.qty > 0 ? item.qty.toFixed(3) : '—'}</Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        <Button title="Save plan" onPress={onSave} />
      </View>
    </Screen>
  );
}
