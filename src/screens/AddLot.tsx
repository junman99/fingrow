
import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import { Screen } from '../components/Screen';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useInvestStore } from '../store/invest';
import DateTimeSheet from '../components/DateTimeSheet';
import LineChart from '../components/LineChart';
import { Card } from '../components/Card';
import TransactionEditorSheet from '../components/invest/TransactionEditorSheet';
import TransactionRow from '../components/invest/TransactionRow';
import { formatCurrency, formatPercent } from '../lib/format';
import { computePnL } from '../lib/positions';

export function AddLot() {
  const [showTxSheet, setShowTxSheet] = React.useState(false);
  const [editLotState, setEditLotState] = React.useState<{id:string, lot:any} | null>(null);
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();

  const symbol = route.params?.symbol as string;
  const portfolioId = route.params?.portfolioId as (string | undefined);

  const store = useInvestStore();
  const { quotes = {}, portfolios = {}, holdings = {} } = store as any;

  const q: any = quotes[symbol] || {};
  const p = portfolioId ? portfolios[portfolioId] : null;
  const holding = portfolioId ? (p?.holdings?.[symbol]) : (holdings?.[symbol]);
  const cur = (p?.baseCurrency || 'USD').toUpperCase();

  // Build chart data from quotes (line/bars) -> [{t,v}]
  const chartData = React.useMemo(() => {
    const line = q?.line;
    if (Array.isArray(line) && line.length) {
      return line.map((d: any, i: number) => {
        if (typeof d === 'number') return { t: i, v: d };
        if (d && typeof d === 'object') {
          if (typeof d.v === 'number') return { t: d.t ?? i, v: d.v };
          if (typeof d.c === 'number') return { t: d.t ?? i, v: d.c };
        }
        return { t: i, v: 0 };
      });
    }
    const bars = q?.bars;
    if (Array.isArray(bars) && bars.length) {
      return bars.map((b: any, i: number) => ({ t: (typeof b.t === 'number' ? b.t : Date.parse(b.t || '')) || i, v: b.c ?? b.v ?? 0 }));
    }
    return [];
  }, [q]);

  const last = q?.last ?? (chartData.length ? chartData[chartData.length - 1].v : 0);
  const change = q?.change ?? 0;
  const changePct = q?.changePct ?? 0;

  // Timeframe selection
  const [tf, setTf] = React.useState<'1D'|'5D'|'1M'|'6M'|'YTD'|'1Y'|'5Y'|'ALL'>('6M');

  // Fallback series if empty
  const displaySeries = React.useMemo(() => {
    if (chartData && chartData.length) return chartData;
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    return Array.from({ length: 14 }, (_, i) => ({ t: now - (13 - i) * day, v: 0 }));
  }, [chartData]);

  // Visible series by timeframe
  const visibleSeries = React.useMemo(() => {
    const s = displaySeries;
    if (!s.length) return s;
    const endTs = s[s.length - 1].t;
    const end = new Date(endTs);
    const msDay = 24 * 3600 * 1000;
    const since = (() => {
      switch (tf) {
        case '1D': return endTs - 1 * msDay;
        case '5D': return endTs - 5 * msDay;
        case '1M': { const d = new Date(end); d.setMonth(d.getMonth() - 1); return d.getTime(); }
        case '6M': { const d = new Date(end); d.setMonth(d.getMonth() - 6); return d.getTime(); }
        case '1Y': { const d = new Date(end); d.setFullYear(d.getFullYear() - 1); return d.getTime(); }
        case 'YTD': { const d = new Date(end); d.setMonth(0,1); d.setHours(0,0,0,0); return d.getTime(); }
        case '5Y': { const d = new Date(end); d.setFullYear(d.getFullYear() - 5); return d.getTime(); }
        default: return 0;
      }
    })();
    return tf === 'ALL' ? s : s.filter(p => p.t >= since);
  }, [displaySeries, tf]);

  const chartToShow = visibleSeries.length ? visibleSeries : displaySeries;

  const xTickStrategy = React.useMemo(() => {
    if (tf === '1D' || tf === '5D') {
      return { mode: 'day', every: 1 } as const;
    }
    if (tf === '1M') {
      const len = chartToShow.length || 0;
      const every = Math.max(1, Math.round(len / 6));
      return { mode: 'day', every } as const;
    }
    return { mode: 'month' } as const;
  }, [tf, chartToShow]);

  // Position summary
  const lots = (holding?.lots ?? []) as any[];
  const onEditLot = (lot: any) => {
    setEditLotState({ id: lot.id, lot });
    setShowTxSheet(true);
  };
  const onDeleteLot = async (lot: any) => {
    try { await (store as any).removeLot(symbol, lot.id, { portfolioId }); } catch {}
  };

  const pnl = computePnL(lots, Number(last) || 0);
  const qty = pnl.qty || 0;
  const avgCost = pnl.avgCost || 0;
  const totalCost = qty * avgCost;
  const mktValue = qty * (Number(last) || 0);
  const dayGain = (Number(change) || 0) * qty;
  const totalGain = (mktValue - totalCost);

  // Trade form
  const [side, setSide] = React.useState<'buy'|'sell'>('buy');
  const [qtyInput, setQtyInput] = React.useState<string>('');
  const [priceInput, setPriceInput] = React.useState<string>(last ? String(Number(last).toFixed(2)) : '');
  const [date, setDate] = React.useState<Date>(new Date());
  const [open, setOpen] = React.useState(false);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const good = get('semantic.success') as string;
  const bad = get('semantic.danger') as string;
  const border = get('border.subtle') as string;
  const bg = get('surface.level1') as string;
  const onPrimary = get('text.onPrimary') as string;
  const primary = get('component.button.primary.bg') as string;

  const onSave = async () => {
    const qn = Number(qtyInput);
    const pr = Number(priceInput);
    if (!symbol || !qn || !pr) return;
    const meta = {
      name: holding?.name || symbol,
      type: holding?.type || (q?.type || 'stock'),
      currency: holding?.currency || (q?.currency || cur),
    };
    try {
      await store.addLot(symbol, { side, qty: qn, price: pr, date: date.toISOString() }, meta, { portfolioId });
      // Auto-adjust cash for quick trade form
      try {
        const gross = qn * pr;
        const fees = 0;
        const cf = side === 'buy' ? -(gross + fees) : (gross - fees);
        await (store as any).addCash(cf, { portfolioId });
      } catch {}
      try { await store.refreshQuotes(); } catch {}
      try { setShowTxSheet(false); } catch {}
      nav.goBack();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Screen>
      <ScrollView
        alwaysBounceVertical={Platform.OS === 'ios'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: spacing.s16, gap: spacing.s16 }}
      >

        {/* Chart */}
        <Card style={{ padding: spacing.s16 }}>

          {/* Header price + change */}
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: text, fontWeight:'800', fontSize: 16 }}>{symbol}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s8 }}>
              <Text style={{ color: text, fontSize: 28, fontWeight: '800' }}>{formatCurrency(Number(last || 0), cur, { compact: false })}</Text>
              <Text style={{ color: (Number(changePct) >= 0 ? good : bad), fontSize: 14, fontWeight: '700' }}>
                {formatCurrency(Number(change || 0), cur, { compact: false })} ({formatPercent(Number(changePct || 0))})
              </Text>
            </View>
          </View>
    
          <View style={{ marginTop: spacing.s12, marginHorizontal: -spacing.s8 }}>
            <LineChart
            data={chartToShow}
            height={200}
            yAxisWidth={28}
            padding={{ left: 10, bottom: 17, top: 8 }}
            
            showArea
            currency={cur}
            xTickStrategy={xTickStrategy}
          />
        </View>
          {/* Timeframes (single row under chart) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.s8, paddingVertical: spacing.s8 }}
            bounces
            overScrollMode="always"
          >
            {(['1D','5D','1M','6M','YTD','1Y','ALL'] as const).map(k => {
              const on = tf===k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setTf(k)}
                  hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Set interval ${k}`}
                  style={{ justifyContent: 'center', paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string) }}
                >
                  <Text style={{ color: on ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight: '700', fontSize: 14 }}>{k}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
    
          

        </Card>

        {/* Position summary */}
        <Card>
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontWeight: '800' }}>Position</Text>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: muted }}>Day's gain</Text>
              <Text style={{ color: dayGain >= 0 ? good : bad, fontWeight:'700' }}>{formatCurrency(dayGain, cur)}</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: muted }}>Total gain</Text>
              <Text style={{ color: totalGain >= 0 ? good : bad, fontWeight:'700' }}>{formatCurrency(totalGain, cur)}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: border, marginVertical: spacing.s8 }} />
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: muted }}>Total cost</Text>
              <Text style={{ color: text }}>{formatCurrency(totalCost, cur)}</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: muted }}>Shares</Text>
              <Text style={{ color: text }}>{qty}</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: muted }}>Average cost</Text>
              <Text style={{ color: text }}>{formatCurrency(avgCost, cur)}</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: muted }}>Market value</Text>
              <Text style={{ color: text }}>{formatCurrency(mktValue, cur)}</Text>
            </View>
          </View>
          

        
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: get('border.subtle') as string, marginVertical: spacing.s12 }} />

          {/* Actions: Add transaction / View history */}
          <View style={{ gap: spacing.s8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add transaction"
              onPress={() => setShowTxSheet(true)}
              style={{ backgroundColor: get('component.button.primary.bg') as string, height: 44, borderRadius: radius.lg, alignItems:'center', justifyContent:'center' }}
            >
              <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Add Transaction</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all transactions"
              onPress={() => nav.navigate('HoldingHistory' as never, { symbol, portfolioId } as never)}
              style={({ pressed }) => ({ height: 44, borderRadius: radius.lg, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}
            >
              <Text style={{ color: text, fontWeight:'700' }}>View Transaction History</Text>
            </Pressable>
          </View>

          {/* Recent transactions preview */}
          {lots.length > 0 ? (
            <View style={{ marginTop: spacing.s12 }}>
              <Text style={{ color: text, fontWeight:'800', marginBottom: spacing.s8 }}>Recent transactions</Text>
              <View style={{ borderTopWidth: 1, borderColor: get('border.subtle') as string }}>
                {[...lots].sort((a:any,b:any)=> new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,3).map((l:any, i:number, arr:any[]) => (
                  <View key={l.id || i}>
                    <TransactionRow lot={l} currency={cur} onEdit={onEditLot} onDelete={onDeleteLot} />
                    {i < arr.length - 1 ? <View style={{ height: 1, backgroundColor: get('border.subtle') as string }} /> : null}
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.navigate('HoldingHistory' as never, { symbol, portfolioId } as never)}
                style={({ pressed }) => ({ alignSelf:'flex-start', marginTop: spacing.s8, paddingHorizontal: spacing.s12, height: 36, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}
              >
                <Text style={{ color: text, fontWeight:'700' }}>View all</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        
        

      </ScrollView>

      <TransactionEditorSheet
        visible={showTxSheet}
        onClose={()=> { setShowTxSheet(false); setEditLotState(null); }}
        symbol={symbol}
        portfolioId={portfolioId}
        mode={editLotState ? 'edit' : 'add'}
        lotId={editLotState?.id || undefined}
        initial={editLotState ? { side: editLotState.lot.side, qty: editLotState.lot.qty, price: editLotState.lot.price, fees: editLotState.lot.fees, date: editLotState.lot.date } : undefined}
      />

      <DateTimeSheet visible={open} date={date} onCancel={() => setOpen(false)} onConfirm={(d)=>{ setDate(d); setOpen(false); }} />
    </Screen>
  );
}
