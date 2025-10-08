import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
// FinGrow TODO: Avoid nesting FlatList inside ScreenScroll; prefer FlatList as primary scroller.
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { isCryptoSymbol, baseCryptoSymbol, fetchCryptoOhlc } from '../lib/coingecko';
import { useInvestStore } from '../store/invest';
import { useProfileStore } from '../store/profile';
import { useRoute, useNavigation } from '@react-navigation/native';
import LineChart from '../components/LineChart';
import CandleChart from '../components/CandleChart';
import { formatCurrency, formatPercent } from '../lib/format';
import { computePnL } from '../lib/positions';

export function Instrument() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const symbol = route.params?.symbol as string;
  const { quotes, refreshQuotes, holdings, fxRates } = useInvestStore();
  const { profile } = useProfileStore();

  useEffect(() => { if (symbol) refreshQuotes([symbol]); }, [symbol]);

  const q = quotes[symbol];
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg = get('surface.level1') as string;
  const accent = get('accent.primary') as string;

  const [tf, setTf] = useState<'1M'|'6M'|'1Y'>('1M');
  const [cryptoBars, setCryptoBars] = useState<Array<{t:number;o:number;h:number;l:number;c:number;v:number}>>([]);
  const [loadingBars, setLoadingBars] = useState(false);
  const [mode, setMode] = useState<'line'|'candle'>('line');

  const bars = q?.bars || [];
  const now = Date.now();
  const cutoff = tf === '1M' ? (now - 32*24*60*60*1000)
               : tf === '6M' ? (now - 190*24*60*60*1000)
               : (now - 380*24*60*60*1000);
  const filteredBars = bars.filter(b => b.t >= cutoff);

  React.useEffect(() => {
    const load = async () => {
      if (mode !== 'candle') return;
      if (!isCryptoSymbol(symbol)) return;
      setLoadingBars(true);
      try {
        const days = tf==='1M' ? 30 : tf==='6M' ? 180 : 365;
        const base = baseCryptoSymbol(symbol)!;
        const bars = await fetchCryptoOhlc(base, days);
        setCryptoBars(bars.map(b => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: 0 })));
      } finally { setLoadingBars(false); }
    };
    load();
  }, [symbol, mode, tf]);
  const line = filteredBars.map(b => ({ t: b.t, v: b.c }));

  // Stats
  const last = q?.last;
  const change = q?.change;
  const changePct = q?.changePct;
  const prevClose = bars.length > 1 ? bars[bars.length-2].c : undefined;
  const today = bars[bars.length-1];
  const hi52 = bars.length ? Math.max(...bars.slice(-260).map(b => b.h)) : undefined;
  const lo52 = bars.length ? Math.min(...bars.slice(-260).map(b => b.l)) : undefined;

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        {/* Header with Buy/Sell */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ color: text, fontWeight:'700', fontSize: 24 }}>{symbol}</Text>
          <Pressable accessibilityRole="button" onPress={() => nav.navigate('AddLot', { symbol })} style={{ backgroundColor: accent, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
            <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Buy / Sell</Text>
          </Pressable>
        </View>

        {/* Price + change */}
        <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s16 }}>
          <Text style={{ color: text, fontWeight:'700', fontSize: 20 }}>{last !== undefined ? formatCurrency((fxRates?.rates?.[(profile?.currency||'USD').toUpperCase()]||1) * last, (profile?.currency||'USD').toUpperCase()) : '—'}</Text>
          <Text style={{ color: (change ?? 0) >= 0 ? (get('semantic.success') as string) : (get('semantic.danger') as string) }}>
            {change !== undefined && changePct !== undefined ? `${change>=0?'+':''}${formatCurrency(Math.abs(change), (profile?.currency||'USD').toUpperCase())} (${formatPercent(changePct)})` : '—'}
          </Text>

          {/* timeframe chips */}
          <View style={{ flexDirection:'row', gap: spacing.s8, marginTop: spacing.s12 }}>
            {(['1M','6M','1Y'] as const).map(k => {
              const on = tf === k;
              return (
                <Pressable key={k} onPress={() => setTf(k)} style={{ backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string), paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
                  <Text style={{ color: on ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight:'700' }}>{k}</Text>
                </Pressable>
              )
            })}
            {/* mode toggle */}
            <Pressable onPress={() => setMode(m => m==='line'?'candle':'line')} style={{ marginLeft: 'auto', backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
              <Text style={{ color: text }}>{mode==='line' ? 'Line' : 'Candle'}</Text>
            </Pressable>
          </View>

          {/* chart */}
          <View style={{ marginTop: spacing.s12 }}>
            {mode==='line'
              ? (line.length ? <LineChart data={line} height={180} /> : <Text style={{ color: muted }}>No data</Text>)
              : (isCryptoSymbol(symbol) ? (loadingBars ? <Text style={{ color: muted }}>Loading candles…</Text> : (cryptoBars.length ? <CandleChart data={cryptoBars} height={200} /> : <Text style={{ color: muted }}>No data</Text>)) : (filteredBars.length ? <CandleChart data={filteredBars} height={200} /> : <Text style={{ color: muted }}>No data</Text>))
            }
          </View>
        </View>

        {/* Stats */}
        <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s16, flexDirection:'row', flexWrap:'wrap', columnGap: spacing.s16, rowGap: spacing.s8 }}>
          {[
            ['Open', today?.o], ['High', today?.h], ['Low', today?.l], ['Prev Close', prevClose],
            ['52W High', hi52], ['52W Low', lo52],
          ].map(([k,v]) => (
            <View key={String(k)} style={{ width: '45%' }}>
              <Text style={{ color: muted }}>{k}</Text>
              <Text style={{ color: text, fontWeight:'700' }}>{v!==undefined ? formatCurrency((fxRates?.rates?.[(profile?.currency||'USD').toUpperCase()]||1) * Number(v), (profile?.currency||'USD').toUpperCase()) : '—'}</Text>
            </View>
          ))}
        
        </View>

        {/* Positions & PnL */}
        <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s8 }}>
          <Text style={{ color: text, fontWeight:'700' }}>Positions</Text>
          {(() => {
            const lots = holdings[symbol]?.lots || [];
            if (!lots.length) return <Text style={{ color: muted }}>No lots yet. Tap Buy / Sell to add.</Text>;
            const lastP = q?.last ?? 0;
            const pnl = computePnL(lots as any, lastP);
            return (
              <View>
                <Text style={{ color: muted, marginBottom: spacing.s8 }}>Qty: {pnl.qty} · Avg cost: {pnl.avgCost ? formatCurrency((fxRates?.rates?.[(profile?.currency||'USD').toUpperCase()]||1)*pnl.avgCost, (profile?.currency||'USD').toUpperCase()) : '-'}</Text>
                <Text style={{ color: (pnl.unrealized>=0 ? (get('semantic.success') as string) : (get('semantic.danger') as string)) }}>
                  Unrealized: {`${pnl.unrealized>=0?'+':''}${formatCurrency(Math.abs((fxRates?.rates?.[(profile?.currency||'USD').toUpperCase()]||1)*pnl.unrealized), (profile?.currency||'USD').toUpperCase())}`}
                </Text>
                <Text style={{ color: (pnl.realized>=0 ? (get('semantic.success') as string) : (get('semantic.danger') as string)) }}>
                  Realized: {`${pnl.realized>=0?'+':''}${formatCurrency(Math.abs((fxRates?.rates?.[(profile?.currency||'USD').toUpperCase()]||1)*pnl.realized), (profile?.currency||'USD').toUpperCase())}`}
                </Text>

                {/* List lots (no FlatList to avoid nested virtualized warnings) */}
                <View style={{ marginTop: spacing.s8, gap: spacing.s8 }}>
                  {lots.map((l:any) => (
                    <View key={l.id} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical: spacing.s8 }}>
                      <Text style={{ color: text }}>{l.side.toUpperCase()} {l.qty} @ ${l.price.toFixed(2)} · {new Date(l.date).toLocaleDateString()}</Text>
                      <Pressable onPress={() => nav.navigate('EditLot', { symbol, lotId: l.id })} style={{ backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s6, borderRadius: radius.pill }}>
                        <Text style={{ color: text }}>Edit</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>
      </View>
    </Screen>
  );
}
