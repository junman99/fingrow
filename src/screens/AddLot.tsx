
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const AddLot = React.memo(() => {
  const [showTxSheet, setShowTxSheet] = React.useState(false);
  const [editLotState, setEditLotState] = React.useState<{id:string, lot:any} | null>(null);
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const symbol = route.params?.symbol as string;
  const portfolioId = route.params?.portfolioId as (string | undefined);

  const store = useInvestStore();
  const quotes = useInvestStore(s => s.quotes);
  const portfolios = useInvestStore(s => s.portfolios);
  const holdings = useInvestStore(s => s.holdings);

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
  const onEditLot = React.useCallback((lot: any) => {
    setEditLotState({ id: lot.id, lot });
    setShowTxSheet(true);
  }, []);
  const onDeleteLot = React.useCallback(async (lot: any) => {
    try { await (store as any).removeLot(symbol, lot.id, { portfolioId }); } catch {}
  }, [store, symbol, portfolioId]);

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

  // Get fundamentals data
  const fundamentals = q?.fundamentals;

  const onSave = React.useCallback(async () => {
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
      // Use requestAnimationFrame to defer navigation
      requestAnimationFrame(() => {
        nav.goBack();
      });
    } catch (e) {
      console.error(e);
    }
  }, [qtyInput, priceInput, symbol, holding, q, cur, store, side, date, portfolioId, nav]);

  return (
    <Screen inTab style={{ paddingBottom: 0 }}>
      <ScrollView
        alwaysBounceVertical={Platform.OS === 'ios'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + spacing.s24 }}
      >

        {/* Chart Section - No Card */}
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s12 }}>
          {/* Header */}
          <View>
            <Text style={{ color: text, fontWeight:'800', fontSize: 32, letterSpacing: -0.8 }}>{symbol}</Text>
            {fundamentals?.companyName && fundamentals.companyName !== symbol && (
              <Text style={{ color: muted, fontSize: 15, marginTop: spacing.s2 }}>{fundamentals.companyName}</Text>
            )}
            <Text style={{ color: text, fontSize: 40, fontWeight: '800', marginTop: spacing.s8, letterSpacing: -1 }}>
              {formatCurrency(Number(last || 0), cur, { compact: false })}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6, marginTop: spacing.s4 }}>
              <Text style={{ color: (Number(changePct) >= 0 ? good : bad), fontSize: 16, fontWeight: '700' }}>
                {formatCurrency(Number(change || 0), cur, { compact: false })}
              </Text>
              <Text style={{ color: (Number(changePct) >= 0 ? good : bad), fontSize: 16, fontWeight: '700' }}>
                ({formatPercent(Number(changePct || 0))})
              </Text>
            </View>
          </View>

          {/* Chart */}
          <LineChart
            data={chartToShow}
            height={200}
            yAxisWidth={0}
            padding={{ left: 12, right: 12, bottom: 20, top: 10 }}
            showArea
            currency={cur}
            xTickStrategy={xTickStrategy}
          />

          {/* Timeframes */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.s6 }}
          >
            {(['1D','5D','1M','6M','YTD','1Y','ALL'] as const).map(k => {
              const on = tf===k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setTf(k)}
                  style={{
                    paddingHorizontal: spacing.s14,
                    paddingVertical: spacing.s8,
                    borderRadius: radius.pill,
                    backgroundColor: on ? (get('accent.primary') as string) : bg,
                    borderWidth: on ? 0 : 1,
                    borderColor: border
                  }}
                >
                  <Text style={{ color: on ? onPrimary : text, fontWeight: '700', fontSize: 13 }}>
                    {k}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Company Info - No Card, Clean Design */}
        {fundamentals && (fundamentals.sector || fundamentals.industry || fundamentals.description) && (
          <View style={{ paddingHorizontal: spacing.s16, marginTop: spacing.s24 }}>
            <Text style={{ color: text, fontWeight: '800', fontSize: 20, marginBottom: spacing.s12 }}>About</Text>

            {(fundamentals.sector || fundamentals.industry) && (
              <View style={{ flexDirection: 'row', gap: spacing.s8, marginBottom: spacing.s12 }}>
                {fundamentals.sector && (
                  <View
                    style={{
                      paddingHorizontal: spacing.s12,
                      paddingVertical: spacing.s6,
                      borderRadius: radius.pill,
                      backgroundColor: bg,
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  >
                    <Text style={{ color: text, fontSize: 13, fontWeight: '600' }}>{fundamentals.sector}</Text>
                  </View>
                )}
                {fundamentals.industry && (
                  <View
                    style={{
                      paddingHorizontal: spacing.s12,
                      paddingVertical: spacing.s6,
                      borderRadius: radius.pill,
                      backgroundColor: bg,
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  >
                    <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>{fundamentals.industry}</Text>
                  </View>
                )}
              </View>
            )}

            {fundamentals.description && (
              <Text style={{ color: text, fontSize: 14, lineHeight: 20, opacity: 0.8 }} numberOfLines={3}>
                {fundamentals.description}
              </Text>
            )}
          </View>
        )}

        {/* Key Metrics - Grid Layout */}
        {fundamentals && (
          <View style={{ paddingHorizontal: spacing.s16, marginTop: spacing.s24 }}>
            <Text style={{ color: text, fontWeight: '800', fontSize: 20, marginBottom: spacing.s12 }}>Key Metrics</Text>

            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
                {/* Market Cap */}
                <View style={{ width: '47%' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    MARKET CAP
                  </Text>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {fundamentals.marketCap !== undefined ? formatCurrency(fundamentals.marketCap, cur, { compact: true }) : '-'}
                  </Text>
                </View>

                {/* P/E Ratio */}
                <View style={{ width: '47%' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    P/E RATIO
                  </Text>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {fundamentals.peRatio !== undefined ? fundamentals.peRatio.toFixed(2) : '-'}
                  </Text>
                </View>

                {/* Forward P/E */}
                <View style={{ width: '47%' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    FORWARD P/E
                  </Text>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {fundamentals.forwardPE !== undefined ? fundamentals.forwardPE.toFixed(2) : '-'}
                  </Text>
                </View>

                {/* EPS */}
                <View style={{ width: '47%' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    EPS (TTM)
                  </Text>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {fundamentals.eps !== undefined ? formatCurrency(fundamentals.eps, cur) : '-'}
                  </Text>
                </View>

                {/* Dividend Yield */}
                <View style={{ width: '47%' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    DIVIDEND YIELD
                  </Text>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {fundamentals.dividendYield !== undefined && fundamentals.dividendYield > 0 ? `${(fundamentals.dividendYield * 100).toFixed(2)}%` : '-'}
                  </Text>
                </View>

                {/* Beta */}
                <View style={{ width: '47%' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    BETA
                  </Text>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {fundamentals.beta !== undefined ? fundamentals.beta.toFixed(2) : '-'}
                  </Text>
                </View>

                {/* Avg Volume */}
                <View style={{ width: '47%' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    AVG VOLUME
                  </Text>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {fundamentals.avgVolume !== undefined ? `${(fundamentals.avgVolume / 1000000).toFixed(2)}M` : '-'}
                  </Text>
                </View>

                {/* 52W High */}
                <View style={{ width: '47%' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    52W HIGH
                  </Text>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {fundamentals.week52High !== undefined ? formatCurrency(fundamentals.week52High, cur) : '-'}
                  </Text>
                </View>

                {/* 52W Low */}
                <View style={{ width: '47%' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    52W LOW
                  </Text>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {fundamentals.week52Low !== undefined ? formatCurrency(fundamentals.week52Low, cur) : '-'}
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Earnings Performance Charts */}
        {fundamentals?.earningsHistory && fundamentals.earningsHistory.length > 0 && (
          <View style={{ paddingHorizontal: spacing.s16, marginTop: spacing.s24 }}>
            <Text style={{ color: text, fontWeight: '800', fontSize: 20, marginBottom: spacing.s12 }}>Earnings Performance</Text>

            <Card>
              {/* EPS Chart: Estimate vs Actual */}
              <View style={{ gap: spacing.s12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>EPS: Estimate vs Actual</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: get('accent.primary') as string, borderRadius: 2 }} />
                      <Text style={{ color: muted, fontSize: 11 }}>Actual</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: muted, borderRadius: 2, opacity: 0.4 }} />
                      <Text style={{ color: muted, fontSize: 11 }}>Estimate</Text>
                    </View>
                  </View>
                </View>

                {/* Custom EPS Chart - Yahoo Finance Style */}
                <View style={{ height: 200, marginTop: spacing.s8 }}>
                  {(() => {
                    const sortedEarnings = [...fundamentals.earningsHistory].sort((a, b) => a.date - b.date).slice(-4);
                    const allValues = sortedEarnings.flatMap(e => [e.actual, e.estimate ?? 0]).filter(v => v !== undefined) as number[];
                    const maxVal = Math.max(...allValues);
                    const minVal = Math.min(...allValues);

                    // Add 15% padding to top and bottom for better visual spacing
                    const rawRange = maxVal - minVal || 1;
                    const paddingPercent = 0.15;
                    const paddedMax = maxVal + (rawRange * paddingPercent);
                    const paddedMin = Math.max(0, minVal - (rawRange * paddingPercent)); // Don't go below 0
                    const range = paddedMax - paddedMin;

                    const chartHeight = 120;
                    const padding = 20;
                    const topPadding = 10;

                    const getY = (value: number) => {
                      return topPadding + ((paddedMax - value) / range) * chartHeight;
                    };

                    return (
                      <View style={{ position: 'relative', height: '100%', paddingHorizontal: padding }}>
                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                          <View
                            key={i}
                            style={{
                              position: 'absolute',
                              left: padding,
                              right: padding,
                              top: topPadding + chartHeight * ratio,
                              height: 1,
                              backgroundColor: border,
                              opacity: ratio === 0.5 ? 0.3 : 0.15,
                            }}
                          />
                        ))}

                        {/* Chart area */}
                        <View style={{ height: chartHeight + topPadding * 2, flexDirection: 'row', justifyContent: 'space-between' }}>
                          {sortedEarnings.map((earning, idx) => {
                            const actual = earning.actual;
                            const estimate = earning.estimate ?? 0;
                            const hasActual = actual !== undefined;
                            const beat = hasActual && actual >= estimate;
                            const actualY = hasActual ? getY(actual) : 0;
                            const estimateY = getY(estimate);

                            return (
                              <View key={idx} style={{ flex: 1, alignItems: 'center', position: 'relative', height: '100%' }}>
                                {/* Connecting line for estimate */}
                                {idx < sortedEarnings.length - 1 && (
                                  <View
                                    style={{
                                      position: 'absolute',
                                      top: estimateY,
                                      left: '50%',
                                      width: `${100 / sortedEarnings.length}%`,
                                      height: 1,
                                      backgroundColor: muted,
                                      opacity: 0.3,
                                    }}
                                  />
                                )}

                                {/* Estimate dot (outlined) */}
                                <View
                                  style={{
                                    position: 'absolute',
                                    top: estimateY - 6,
                                    width: 12,
                                    height: 12,
                                    borderRadius: 6,
                                    borderWidth: 2,
                                    borderColor: muted,
                                    borderStyle: 'dashed',
                                    backgroundColor: get('surface.level1') as string,
                                  }}
                                />

                                {/* Actual dot (filled) - only show if actual exists */}
                                {hasActual && (
                                  <View
                                    style={{
                                      position: 'absolute',
                                      top: actualY - 7,
                                      width: 14,
                                      height: 14,
                                      borderRadius: 7,
                                      backgroundColor: beat ? good : bad,
                                    }}
                                  />
                                )}
                              </View>
                            );
                          })}
                        </View>

                        {/* X-axis labels */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s8 }}>
                          {sortedEarnings.map((earning, idx) => {
                            const actual = earning.actual;
                            const estimate = earning.estimate ?? 0;
                            const hasActual = actual !== undefined;
                            const beat = hasActual && actual >= estimate;

                            return (
                              <View key={idx} style={{ flex: 1, alignItems: 'center', gap: spacing.s2 }}>
                                <Text style={{ color: text, fontSize: 11, fontWeight: '700' }}>
                                  {earning.quarter}
                                </Text>
                                <Text style={{ color: hasActual ? (beat ? good : bad) : muted, fontSize: 12, fontWeight: '700' }}>
                                  ${hasActual ? actual.toFixed(2) : estimate.toFixed(2)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Earnings Detail Table */}
              <View style={{ gap: spacing.s10, marginTop: spacing.s16, paddingTop: spacing.s16, borderTopWidth: 1, borderColor: border }}>
                <Text style={{ color: text, fontWeight: '700', fontSize: 15, marginBottom: spacing.s4 }}>Recent Earnings</Text>
                {[...fundamentals.earningsHistory].sort((a, b) => b.date - a.date).slice(0, 4).map((earning, idx, arr) => {
                  const actual = earning.actual;
                  const estimate = earning.estimate ?? 0;
                  const hasActual = actual !== undefined;
                  const beat = hasActual && actual > estimate;
                  const diff = hasActual ? actual - estimate : 0;
                  const diffPct = hasActual && estimate !== 0 ? (diff / Math.abs(estimate)) * 100 : 0;

                  return (
                    <View key={idx}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s6 }}>
                        <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>{earning.quarter}</Text>
                        {hasActual && diff !== 0 && (
                          <View
                            style={{
                              paddingHorizontal: spacing.s8,
                              paddingVertical: spacing.s4,
                              borderRadius: radius.pill,
                              backgroundColor: beat ? good : bad,
                              opacity: 0.15,
                            }}
                          >
                            <Text style={{ color: beat ? good : bad, fontWeight: '700', fontSize: 11 }}>
                              {beat ? '▲' : '▼'} {Math.abs(diffPct).toFixed(1)}%
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: muted, fontSize: 11, marginBottom: spacing.s2 }}>Estimate</Text>
                          <Text style={{ color: text, fontSize: 13 }}>{formatCurrency(estimate, cur)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: muted, fontSize: 11, marginBottom: spacing.s2 }}>Actual</Text>
                          <Text style={{ color: hasActual ? (beat ? good : bad) : muted, fontWeight: hasActual ? '700' : '600', fontSize: 13 }}>
                            {hasActual ? formatCurrency(actual, cur) : '-'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: muted, fontSize: 11, marginBottom: spacing.s2 }}>Difference</Text>
                          <Text style={{ color: hasActual ? (beat ? good : bad) : muted, fontWeight: '600', fontSize: 13 }}>
                            {hasActual ? (diff >= 0 ? '+' : '') + formatCurrency(diff, cur) : '-'}
                          </Text>
                        </View>
                      </View>

                      {idx < arr.length - 1 && (
                        <View style={{ height: 1, backgroundColor: border, marginTop: spacing.s10 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* Position summary */}
        <View style={{ paddingHorizontal: spacing.s16, marginTop: spacing.s24 }}>
        <Text style={{ color: text, fontWeight: '800', fontSize: 20, marginBottom: spacing.s12 }}>Your Position</Text>
        <Card>
          <View style={{ gap: spacing.s12 }}>
            {/* Gains Row */}
            <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, fontSize: 12, marginBottom: spacing.s4 }}>Day's gain</Text>
                <Text style={{ color: dayGain >= 0 ? good : bad, fontWeight:'700', fontSize: 16 }}>
                  {formatCurrency(dayGain, cur)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, fontSize: 12, marginBottom: spacing.s4 }}>Total gain</Text>
                <Text style={{ color: totalGain >= 0 ? good : bad, fontWeight:'700', fontSize: 16 }}>
                  {formatCurrency(totalGain, cur)}
                </Text>
              </View>
            </View>

            {/* Details */}
            <View style={{ gap: spacing.s8, paddingTop: spacing.s8, borderTopWidth: 1, borderColor: border }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color: muted, fontSize: 13 }}>Market value</Text>
                <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>{formatCurrency(mktValue, cur)}</Text>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color: muted, fontSize: 13 }}>Total cost</Text>
                <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>{formatCurrency(totalCost, cur)}</Text>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color: muted, fontSize: 13 }}>Shares</Text>
                <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>{qty}</Text>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color: muted, fontSize: 13 }}>Average cost</Text>
                <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>{formatCurrency(avgCost, cur)}</Text>
              </View>
            </View>
          </View>
          

        
          {/* Actions */}
          <View style={{ gap: spacing.s8, paddingTop: spacing.s12, borderTopWidth: 1, borderColor: border, marginTop: spacing.s4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add transaction"
              onPress={() => setShowTxSheet(true)}
              style={({ pressed }) => ({
                backgroundColor: primary,
                height: 44,
                borderRadius: radius.md,
                alignItems:'center',
                justifyContent:'center',
                opacity: pressed ? 0.8 : 1
              })}
            >
              <Text style={{ color: onPrimary, fontWeight:'700', fontSize: 15 }}>Add Transaction</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all transactions"
              onPress={() => nav.navigate('HoldingHistory' as never, { symbol, portfolioId } as never)}
              style={({ pressed }) => ({
                height: 44,
                borderRadius: radius.md,
                alignItems:'center',
                justifyContent:'center',
                backgroundColor: bg,
                opacity: pressed ? 0.8 : 1
              })}
            >
              <Text style={{ color: text, fontWeight:'700', fontSize: 15 }}>View History</Text>
            </Pressable>
          </View>

          {/* Recent transactions preview */}
          {lots.length > 0 ? (
            <View style={{ paddingTop: spacing.s12, marginTop: spacing.s12, borderTopWidth: 1, borderColor: border }}>
              <Text style={{ color: text, fontWeight:'800', marginBottom: spacing.s8, fontSize: 16 }}>Recent Transactions</Text>
              <View style={{ borderTopWidth: 1, borderColor: border }}>
                {[...lots].sort((a:any,b:any)=> new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,3).map((l:any, i:number, arr:any[]) => (
                  <View key={l.id || i}>
                    <TransactionRow lot={l} currency={cur} onEdit={onEditLot} onDelete={onDeleteLot} />
                    {i < arr.length - 1 ? <View style={{ height: 1, backgroundColor: border }} /> : null}
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.navigate('HoldingHistory' as never, { symbol, portfolioId } as never)}
                style={({ pressed }) => ({
                  alignSelf:'flex-start',
                  marginTop: spacing.s10,
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: bg,
                  opacity: pressed ? 0.7 : 1
                })}
              >
                <Text style={{ color: text, fontWeight:'700', fontSize: 13 }}>View all</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>
        </View>

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
});

AddLot.displayName = 'AddLot';
