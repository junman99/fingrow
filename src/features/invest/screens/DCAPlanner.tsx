import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Screen } from '../../../components/Screen';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import { Card } from '../../../components/Card';
import Icon from '../../../components/Icon';
import { spacing, radius } from '../../../theme/tokens';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { useInvestStore } from '../store/invest';
import { usePlansStore } from '../../../store/plans';
import { formatCurrency } from '../../../lib/format';
import { useNavigation, useRoute } from '@react-navigation/native';
import LineChart from '../../../components/LineChart';

type RouteParams = { suggest?: number };

// Major US indices with historical average returns
const INDICES = [
  { symbol: 'SPY', name: 'S&P 500', avgReturn: 0.104, color: '#3B82F6' }, // 10.4% historical avg
  { symbol: 'QQQ', name: 'Nasdaq-100', avgReturn: 0.135, color: '#8B5CF6' }, // 13.5% historical avg
  { symbol: 'VTI', name: 'Total US Market', avgReturn: 0.102, color: '#10B981' }, // 10.2% historical avg
  { symbol: 'VT', name: 'Total World', avgReturn: 0.089, color: '#F59E0B' }, // 8.9% historical avg
  { symbol: 'SMH', name: 'Semiconductor', avgReturn: 0.18, color: '#EF4444' }, // 18% historical avg
  { symbol: 'VWO', name: 'Emerging Markets', avgReturn: 0.076, color: '#06B6D4' }, // 7.6% historical avg
];

const TIMEFRAMES = [5, 10, 20, 30] as const;

function withAlpha(color: string, alpha: number) {
  if (!color) return color;
  if (color.startsWith('rgba')) {
    const parts = color.slice(5, -1).split(',').map(part => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb')) {
    const parts = color.slice(4, -1).split(',').map(part => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const raw = color.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Calculate future value with monthly DCA using compound growth
function calculateDCAProjection(monthlyAmount: number, years: number, annualReturn: number) {
  const monthlyRate = annualReturn / 12;
  const months = years * 12;

  // Future value of an annuity formula: FV = P * [((1 + r)^n - 1) / r]
  if (monthlyRate === 0) {
    return monthlyAmount * months;
  }

  const futureValue = monthlyAmount * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  return futureValue;
}

// Generate chart data showing invested vs projected value over time
function generateProjectionChartData(monthlyAmount: number, years: number, annualReturn: number): Array<{ invested: Array<{t: number; v: number}>; projected: Array<{t: number; v: number}> }> {
  const monthlyRate = annualReturn / 12;
  const months = years * 12;
  const now = Date.now();
  const monthMs = 30.44 * 24 * 60 * 60 * 1000; // Average month in milliseconds

  const invested: Array<{t: number; v: number}> = [];
  const projected: Array<{t: number; v: number}> = [];

  for (let month = 0; month <= months; month++) {
    const t = now + (month * monthMs);
    const totalInvested = monthlyAmount * month;

    // Calculate future value at this point
    let futureValue = 0;
    if (monthlyRate === 0) {
      futureValue = totalInvested;
    } else {
      futureValue = month === 0 ? 0 : monthlyAmount * (Math.pow(1 + monthlyRate, month) - 1) / monthlyRate;
    }

    invested.push({ t, v: totalInvested });
    projected.push({ t, v: futureValue });
  }

  return [{ invested, projected }];
}

export default function DCAPlanner() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { get, isDark } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const border = get('border.subtle') as string;
  const cardBg = get('surface.level1') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successColor = get('semantic.success') as string;
  const bgDefault = get('background.default') as string;

  const { holdings, quotes, watchlist, hydrate, refreshQuotes } = useInvestStore();
  const { plan, hydrate: hydratePlan, save } = usePlansStore();

  const suggest = (route.params as RouteParams)?.suggest ?? 0;
  const [mode, setMode] = useState<'custom' | 'compare'>('compare');
  const [amount, setAmount] = useState<string>(suggest ? String(suggest) : (plan?.amount ? String(plan.amount) : '500'));
  const [selectedTimeframe, setSelectedTimeframe] = useState<number>(10);
  const [selectedIndices, setSelectedIndices] = useState<string[]>(['SPY', 'QQQ', 'VTI']);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    hydratePlan();
    // Fetch actual market data for all indices
    const indexSymbols = INDICES.map(idx => idx.symbol);
    refreshQuotes(indexSymbols);
  }, []);

  // Custom allocation mode (original functionality)
  const symbols = useMemo(() => {
    const held = Object.keys(holdings || {});
    if (held.length > 0) return held;
    return watchlist || [];
  }, [holdings, watchlist]);

  const [weights, setWeights] = useState<Record<string, number>>({});
  useEffect(() => {
    const base: Record<string, number> = {};
    if (plan?.symbols?.length) {
      const map: Record<string, number> = {};
      for (const s of plan.symbols) map[s.symbol] = s.weight;
      const syms = symbols;
      const sum = syms.reduce((acc, s) => acc + (map[s] || 0), 0);
      if (sum > 0) {
        for (const s of syms) base[s] = (map[s] || 0) / sum;
      } else {
        for (const s of syms) base[s] = 1 / Math.max(1, syms.length);
      }
    } else {
      for (const s of symbols) base[s] = 1 / Math.max(1, symbols.length);
    }
    setWeights(base);
  }, [symbols, plan]);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const planRows = symbols.map(s => {
    const w = (weights[s] || 0) / totalWeight;
    const amt = (parseFloat(amount || '0') || 0) * w;
    const price = quotes[s]?.last || 0;
    const qty = price > 0 ? amt / price : 0;
    return { symbol: s, weight: w, amount: amt, price, qty };
  });

  function setWeight(sym: string, val: number) {
    const next = { ...weights, [sym]: Math.max(0, Math.min(100, val)) };
    setWeights(next);
  }

  function normalizeWeights() {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum === 0) return;
    const norm: Record<string, number> = {};
    for (const k of Object.keys(weights)) norm[k] = weights[k] / sum;
    setWeights(norm);
  }

  function resetToEqual() {
    const base: Record<string, number> = {};
    for (const s of symbols) base[s] = 1 / Math.max(1, symbols.length);
    setWeights(base);
  }

  async function onSave() {
    normalizeWeights();
    const amt = parseFloat(amount || '0') || 0;
    const normalizedWeights = { ...weights };
    const sum = Object.values(normalizedWeights).reduce((a, b) => a + b, 0);
    const symbols = planRows.map(r => ({
      symbol: r.symbol,
      weight: sum > 0 ? normalizedWeights[r.symbol] / sum : 0
    }));
    await save({ amount: amt, symbols, period: 'monthly' });
    nav.goBack();
  }

  const monthlyAmount = parseFloat(amount || '0') || 0;
  const yearlyAmount = monthlyAmount * 12;

  // Calculate actual returns from market data
  const indexActualReturns = useMemo(() => {
    const returns: Record<string, number> = {};

    INDICES.forEach(index => {
      const quote = quotes[index.symbol];
      if (quote?.line && quote.line.length >= 252) { // At least 1 year of daily data
        // Calculate annualized return from historical data
        const sortedData = [...quote.line].sort((a, b) => a.t - b.t);
        const oldestPrice = sortedData[0].v;
        const latestPrice = sortedData[sortedData.length - 1].v;
        const timeSpanYears = (sortedData[sortedData.length - 1].t - sortedData[0].t) / (365.25 * 24 * 60 * 60 * 1000);

        if (oldestPrice > 0 && timeSpanYears > 0) {
          // Compound annual growth rate (CAGR)
          const cagr = Math.pow(latestPrice / oldestPrice, 1 / timeSpanYears) - 1;
          returns[index.symbol] = cagr;
        }
      }
    });

    return returns;
  }, [quotes]);

  // Index comparison calculations with actual market data when available
  const indexProjections = useMemo(() => {
    return INDICES.map(index => {
      // Use actual return if available, otherwise fall back to historical average
      const returnRate = indexActualReturns[index.symbol] ?? index.avgReturn;
      const usingActualData = indexActualReturns[index.symbol] !== undefined;

      const projections = TIMEFRAMES.map(years => {
        const totalInvested = monthlyAmount * 12 * years;
        const futureValue = calculateDCAProjection(monthlyAmount, years, returnRate);
        const totalGains = futureValue - totalInvested;
        return {
          years,
          totalInvested,
          futureValue,
          totalGains,
          returnPct: totalInvested > 0 ? (totalGains / totalInvested) * 100 : 0,
        };
      });
      return { ...index, projections, actualReturn: returnRate, usingActualData };
    });
  }, [monthlyAmount, indexActualReturns]);

  function toggleIndex(symbol: string) {
    setSelectedIndices(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  }

  const selectedTimeframeProjections = useMemo(() => {
    return indexProjections.map(idx => {
      const projection = idx.projections.find(p => p.years === selectedTimeframe);
      return { ...idx, ...projection };
    }).filter(p => selectedIndices.includes(p.symbol));
  }, [indexProjections, selectedTimeframe, selectedIndices]);

  // Generate projection chart data for comparison mode
  const projectionChartData = useMemo(() => {
    if (mode !== 'compare' || monthlyAmount <= 0 || selectedTimeframeProjections.length === 0) {
      return null;
    }

    // Use the best performing index for the main projection
    const bestIndex = selectedTimeframeProjections.reduce((best, curr) =>
      (curr.futureValue || 0) > (best.futureValue || 0) ? curr : best
    );

    const chartData = generateProjectionChartData(monthlyAmount, selectedTimeframe, bestIndex.actualReturn || bestIndex.avgReturn);
    return {
      invested: chartData[0].invested,
      projected: chartData[0].projected,
      indexName: bestIndex.name,
      indexColor: bestIndex.color,
    };
  }, [mode, monthlyAmount, selectedTimeframeProjections, selectedTimeframe]);

  return (
    <Screen inTab>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.s16,
          gap: spacing.s24,
          paddingBottom: spacing.s16
        }}
      >
        {/* Header */}
        <View>
          <Text style={{ color: text, fontSize: 28, fontWeight: '800' }}>
            DCA Planner
          </Text>
          <Text style={{ color: muted, marginTop: spacing.s6, lineHeight: 20 }}>
            Compare index returns and project your long-term wealth with dollar-cost averaging.
          </Text>
        </View>

        {/* Mode Toggle */}
        <View style={{ flexDirection: 'row', gap: spacing.s8, backgroundColor: cardBg, padding: spacing.s4, borderRadius: radius.lg }}>
          <Pressable
            onPress={() => setMode('compare')}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing.s10,
              borderRadius: radius.md,
              backgroundColor: mode === 'compare' ? accentPrimary : 'transparent',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{
              color: mode === 'compare' ? get('text.onPrimary') as string : muted,
              fontWeight: '700',
              fontSize: 14,
              textAlign: 'center',
            }}>
              Compare Indices
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('custom')}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing.s10,
              borderRadius: radius.md,
              backgroundColor: mode === 'custom' ? accentPrimary : 'transparent',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{
              color: mode === 'custom' ? get('text.onPrimary') as string : muted,
              fontWeight: '700',
              fontSize: 14,
              textAlign: 'center',
            }}>
              Custom Plan
            </Text>
          </Pressable>
        </View>

        {/* Amount Input */}
        <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginBottom: spacing.s12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="dollar-sign" size={20} colorToken="accent.primary" />
            </View>
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              Monthly investment
            </Text>
          </View>
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="500"
          />
          <View
            style={{
              marginTop: spacing.s12,
              padding: spacing.s12,
              borderRadius: radius.md,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08),
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: muted, fontSize: 13 }}>Yearly total</Text>
              <Text style={{ color: onSurface, fontWeight: '700', fontSize: 14 }}>
                {formatCurrency(yearlyAmount)}
              </Text>
            </View>
          </View>
        </Card>

        {mode === 'compare' ? (
          <>
            {/* Timeframe Selector */}
            <View style={{ gap: spacing.s12 }}>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Investment timeframe</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s8 }}>
                {TIMEFRAMES.map(years => (
                  <Pressable
                    key={years}
                    onPress={() => setSelectedTimeframe(years)}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.s16,
                      paddingVertical: spacing.s10,
                      borderRadius: radius.pill,
                      backgroundColor: selectedTimeframe === years ? accentPrimary : cardBg,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{
                      color: selectedTimeframe === years ? get('text.onPrimary') as string : text,
                      fontWeight: '700',
                      fontSize: 14,
                    }}>
                      {years} years
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Index Selection */}
            <View style={{ gap: spacing.s12 }}>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Select indices to compare</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                {INDICES.map(index => {
                  const selected = selectedIndices.includes(index.symbol);
                  return (
                    <Pressable
                      key={index.symbol}
                      onPress={() => toggleIndex(index.symbol)}
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing.s14,
                        paddingVertical: spacing.s10,
                        borderRadius: radius.pill,
                        backgroundColor: selected ? withAlpha(index.color, isDark ? 0.3 : 0.2) : cardBg,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? index.color : border,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                        {selected && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: index.color }} />
                        )}
                        <Text style={{
                          color: selected ? text : muted,
                          fontWeight: selected ? '700' : '600',
                          fontSize: 13,
                        }}>
                          {index.symbol}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Projection Chart */}
            {projectionChartData && (
              <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
                <View style={{ gap: spacing.s12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>
                        Growth Projection
                      </Text>
                      <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                        {projectionChartData.indexName} - {selectedTimeframe} years
                      </Text>
                    </View>
                  </View>

                  {/* Chart Legend */}
                  <View style={{ flexDirection: 'row', gap: spacing.s16, marginTop: spacing.s4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: withAlpha(muted, 0.5), borderRadius: 2 }} />
                      <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>Amount invested</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: projectionChartData.indexColor, borderRadius: 2 }} />
                      <Text style={{ color: text, fontSize: 11, fontWeight: '600' }}>Projected value</Text>
                    </View>
                  </View>

                  {/* Invested Amount Line Chart */}
                  <View style={{ position: 'relative', height: 200 }}>
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                      <LineChart
                        data={projectionChartData.invested}
                        height={200}
                        showArea={false}
                        currency="USD"
                        xTickStrategy={{ mode: 'month' }}
                        yAxisWidth={0}
                        padding={{ left: 12, right: 12, bottom: 24, top: 10 }}
                      />
                    </View>
                    {/* Projected Value Line Chart - Overlaid */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                      <LineChart
                        data={projectionChartData.projected}
                        height={200}
                        showArea={true}
                        currency="USD"
                        xTickStrategy={{ mode: 'month' }}
                        yAxisWidth={0}
                        padding={{ left: 12, right: 12, bottom: 24, top: 10 }}
                      />
                    </View>
                  </View>

                  {/* Key Stats */}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: spacing.s8,
                      marginTop: spacing.s8,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        padding: spacing.s12,
                        borderRadius: radius.md,
                        backgroundColor: withAlpha(text, isDark ? 0.06 : 0.04),
                      }}
                    >
                      <Text style={{ color: muted, fontSize: 11, marginBottom: spacing.s4 }}>Total invested</Text>
                      <Text style={{ color: onSurface, fontSize: 16, fontWeight: '800' }}>
                        {formatCurrency(monthlyAmount * 12 * selectedTimeframe)}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        padding: spacing.s12,
                        borderRadius: radius.md,
                        backgroundColor: withAlpha(projectionChartData.indexColor, isDark ? 0.2 : 0.12),
                      }}
                    >
                      <Text style={{ color: muted, fontSize: 11, marginBottom: spacing.s4 }}>Projected gains</Text>
                      <Text style={{ color: projectionChartData.indexColor, fontSize: 16, fontWeight: '800' }}>
                        {formatCurrency(projectionChartData.projected[projectionChartData.projected.length - 1].v - (monthlyAmount * 12 * selectedTimeframe))}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            )}

            {/* Visual Comparison Bars */}
            {monthlyAmount > 0 && selectedTimeframeProjections.length > 0 && (
              <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginBottom: spacing.s16 }}>
                  Quick Comparison - {selectedTimeframe} Years
                </Text>
                <View style={{ gap: spacing.s12 }}>
                  {selectedTimeframeProjections
                    .sort((a, b) => (b.futureValue || 0) - (a.futureValue || 0))
                    .map((proj) => {
                      const maxValue = Math.max(...selectedTimeframeProjections.map(p => p.futureValue || 0));
                      const barWidth = maxValue > 0 ? ((proj.futureValue || 0) / maxValue) * 100 : 0;
                      return (
                        <View key={proj.symbol} style={{ gap: spacing.s6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>{proj.name}</Text>
                            <Text style={{ color: proj.color, fontWeight: '800', fontSize: 14 }}>
                              {formatCurrency(proj.futureValue || 0)}
                            </Text>
                          </View>
                          <View
                            style={{
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: withAlpha(border, 0.2),
                              overflow: 'hidden',
                            }}
                          >
                            <View
                              style={{
                                height: '100%',
                                width: `${barWidth}%`,
                                backgroundColor: proj.color,
                                borderRadius: 4,
                              }}
                            />
                          </View>
                        </View>
                      );
                    })}
                </View>
              </Card>
            )}

            {/* Comparison Table */}
            {monthlyAmount > 0 && selectedTimeframeProjections.length > 0 && (
              <View style={{ gap: spacing.s12 }}>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
                  Projected Returns - {selectedTimeframe} Years
                </Text>
                {selectedTimeframeProjections
                  .sort((a, b) => (b.futureValue || 0) - (a.futureValue || 0))
                  .map((proj, idx) => (
                    <Card key={proj.symbol} style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
                      <View style={{ gap: spacing.s12 }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: radius.md,
                                backgroundColor: withAlpha(proj.color, isDark ? 0.3 : 0.2),
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: proj.color, fontWeight: '800', fontSize: 13 }}>
                                {idx + 1}
                              </Text>
                            </View>
                            <View>
                              <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>
                                {proj.symbol}
                              </Text>
                              <Text style={{ color: muted, fontSize: 12 }}>
                                {proj.name}
                              </Text>
                            </View>
                          </View>
                          <View
                            style={{
                              paddingHorizontal: spacing.s10,
                              paddingVertical: spacing.s6,
                              borderRadius: radius.pill,
                              backgroundColor: withAlpha(successColor, isDark ? 0.25 : 0.15),
                            }}
                          >
                            <Text style={{ color: successColor, fontWeight: '800', fontSize: 13 }}>
                              {((proj.actualReturn || proj.avgReturn) * 100).toFixed(1)}% {proj.usingActualData ? 'CAGR' : 'avg'}
                            </Text>
                          </View>
                        </View>

                        {/* Stats Grid */}
                        <View
                          style={{
                            padding: spacing.s14,
                            borderRadius: radius.md,
                            backgroundColor: withAlpha(text, isDark ? 0.06 : 0.04),
                            gap: spacing.s10,
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: muted, fontSize: 13 }}>Total invested</Text>
                            <Text style={{ color: onSurface, fontWeight: '600', fontSize: 14 }}>
                              {formatCurrency(proj.totalInvested || 0)}
                            </Text>
                          </View>
                          <View
                            style={{
                              height: 1,
                              backgroundColor: withAlpha(border, 0.3),
                            }}
                          />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: text, fontSize: 14, fontWeight: '700' }}>Projected value</Text>
                            <Text style={{ color: proj.color, fontWeight: '800', fontSize: 18 }}>
                              {formatCurrency(proj.futureValue || 0)}
                            </Text>
                          </View>
                          <View
                            style={{
                              height: 1,
                              backgroundColor: withAlpha(border, 0.3),
                            }}
                          />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: muted, fontSize: 13 }}>Total gains</Text>
                            <Text style={{ color: successColor, fontWeight: '700', fontSize: 14 }}>
                              +{formatCurrency(proj.totalGains || 0)}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: muted, fontSize: 13 }}>Return on investment</Text>
                            <Text style={{ color: successColor, fontWeight: '700', fontSize: 14 }}>
                              +{(proj.returnPct || 0).toFixed(1)}%
                            </Text>
                          </View>
                        </View>
                      </View>
                    </Card>
                  ))}
              </View>
            )}

            {/* Info Card */}
            <Card style={{ backgroundColor: withAlpha(accentSecondary, isDark ? 0.12 : 0.08), padding: spacing.s16 }}>
              <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                <Icon name="target" size={20} colorToken="accent.secondary" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: text, fontWeight: '700', marginBottom: spacing.s6 }}>
                    About these projections
                  </Text>
                  <Text style={{ color: muted, fontSize: 13, lineHeight: 19 }}>
                    {Object.keys(indexActualReturns).length > 0
                      ? 'Projections use actual market data (CAGR) where available, with historical averages as fallback. '
                      : 'Projections are based on historical average returns. '}
                    Assumes consistent monthly investments. Past performance doesn't guarantee future results. Market conditions vary, and actual returns may differ significantly.
                  </Text>
                </View>
              </View>
            </Card>
          </>
        ) : (
          <>
            {/* Custom Allocation (Original Functionality) */}
            {symbols.length > 0 && monthlyAmount > 0 && (
              <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                <Card style={{ flex: 1, backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.12), padding: spacing.s12 }}>
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Assets</Text>
                  <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                    {symbols.length}
                  </Text>
                </Card>
                <Card style={{ flex: 1, backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.12), padding: spacing.s12 }}>
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Avg per asset</Text>
                  <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                    {formatCurrency(monthlyAmount / symbols.length)}
                  </Text>
                </Card>
              </View>
            )}

            {/* Allocation Section */}
            <View style={{ gap: spacing.s12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Allocation</Text>
                {symbols.length > 1 && (
                  <Pressable
                    onPress={resetToEqual}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.s12,
                      paddingVertical: spacing.s6,
                      borderRadius: radius.md,
                      backgroundColor: withAlpha(accentPrimary, pressed ? (isDark ? 0.25 : 0.18) : (isDark ? 0.15 : 0.1)),
                    })}
                  >
                    <Text style={{ color: accentPrimary, fontWeight: '700', fontSize: 13 }}>
                      Reset to equal
                    </Text>
                  </Pressable>
                )}
              </View>

              {symbols.length === 0 ? (
                <Card style={{ backgroundColor: cardBg, padding: spacing.s24 }}>
                  <View style={{ alignItems: 'center', gap: spacing.s12 }}>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.lg,
                        backgroundColor: withAlpha(muted, isDark ? 0.15 : 0.1),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="trending-up" size={28} colorToken="text.muted" />
                    </View>
                    <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                      No holdings yet
                    </Text>
                    <Text style={{ color: muted, textAlign: 'center', lineHeight: 20 }}>
                      Add holdings to your portfolio or create a watchlist to plan your custom DCA strategy.
                    </Text>
                    <Button
                      title="Go to portfolio"
                      onPress={() => nav.navigate('InvestHome' as never)}
                      variant="secondary"
                      style={{ marginTop: spacing.s8 }}
                    />
                  </View>
                </Card>
              ) : (
                <View style={{ gap: spacing.s8 }}>
                  {planRows.map((item) => (
                    <Card key={item.symbol} style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
                      <View style={{ gap: spacing.s12 }}>
                        {/* Symbol Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: radius.sm,
                                backgroundColor: withAlpha(accentSecondary, isDark ? 0.25 : 0.15),
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: accentSecondary, fontWeight: '800', fontSize: 12 }}>
                                {item.symbol.substring(0, 2)}
                              </Text>
                            </View>
                            <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>
                              {item.symbol}
                            </Text>
                          </View>
                          <View
                            style={{
                              paddingHorizontal: spacing.s10,
                              paddingVertical: spacing.s4,
                              borderRadius: radius.pill,
                              backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                            }}
                          >
                            <Text style={{ color: accentPrimary, fontWeight: '800', fontSize: 13 }}>
                              {(item.weight * 100).toFixed(1)}%
                            </Text>
                          </View>
                        </View>

                        {/* Allocation Bar */}
                        <View
                          style={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: withAlpha(border, 0.3),
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              height: '100%',
                              width: `${item.weight * 100}%`,
                              backgroundColor: accentPrimary,
                              borderRadius: 3,
                            }}
                          />
                        </View>

                        {/* Weight Input */}
                        <View>
                          <Text style={{ color: muted, fontSize: 12, marginBottom: spacing.s6 }}>
                            Allocation weight
                          </Text>
                          <View style={{ flexDirection: 'row', gap: spacing.s8, alignItems: 'center' }}>
                            <Pressable
                              onPress={() => setWeight(item.symbol, (weights[item.symbol] || 0) - 5)}
                              style={({ pressed }) => ({
                                width: 36,
                                height: 36,
                                borderRadius: radius.md,
                                backgroundColor: withAlpha(border, pressed ? 0.5 : 0.3),
                                alignItems: 'center',
                                justifyContent: 'center',
                              })}
                            >
                              <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>−</Text>
                            </Pressable>
                            <Input
                              value={String(Math.round((weights[item.symbol] || 0) * 100) / 100)}
                              onChangeText={(val) => {
                                const num = parseFloat(val) || 0;
                                setWeight(item.symbol, num);
                              }}
                              keyboardType="decimal-pad"
                              style={{ flex: 1 }}
                            />
                            <Pressable
                              onPress={() => setWeight(item.symbol, (weights[item.symbol] || 0) + 5)}
                              style={({ pressed }) => ({
                                width: 36,
                                height: 36,
                                borderRadius: radius.md,
                                backgroundColor: withAlpha(border, pressed ? 0.5 : 0.3),
                                alignItems: 'center',
                                justifyContent: 'center',
                              })}
                            >
                              <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>+</Text>
                            </Pressable>
                          </View>
                        </View>

                        {/* Stats Grid */}
                        <View
                          style={{
                            padding: spacing.s12,
                            borderRadius: radius.md,
                            backgroundColor: withAlpha(text, isDark ? 0.06 : 0.04),
                            gap: spacing.s8,
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: muted, fontSize: 13 }}>Monthly amount</Text>
                            <Text style={{ color: onSurface, fontWeight: '700', fontSize: 14 }}>
                              {formatCurrency(item.amount)}
                            </Text>
                          </View>
                          {item.price > 0 && (
                            <>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: muted, fontSize: 13 }}>Current price</Text>
                                <Text style={{ color: onSurface, fontWeight: '600', fontSize: 13 }}>
                                  {formatCurrency(item.price)}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: muted, fontSize: 13 }}>Est. shares/month</Text>
                                <Text style={{ color: onSurface, fontWeight: '700', fontSize: 14 }}>
                                  {item.qty.toFixed(3)}
                                </Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: muted, fontSize: 13 }}>Est. shares/year</Text>
                                <Text style={{ color: accentPrimary, fontWeight: '800', fontSize: 14 }}>
                                  {(item.qty * 12).toFixed(2)}
                                </Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    </Card>
                  ))}

                  {/* Normalize Notice */}
                  {(() => {
                    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
                    const needsNormalization = Math.abs(sum - totalWeight) > 0.01;
                    return needsNormalization ? (
                      <View
                        style={{
                          padding: spacing.s12,
                          borderRadius: radius.md,
                          backgroundColor: withAlpha(get('semantic.warning') as string, isDark ? 0.2 : 0.12),
                          flexDirection: 'row',
                          gap: spacing.s10,
                          alignItems: 'center',
                        }}
                      >
                        <Icon name="target" size={18} colorToken="semantic.warning" />
                        <Text style={{ color: onSurface, fontSize: 13, flex: 1, lineHeight: 18 }}>
                          Weights will be normalized to 100% when you save
                        </Text>
                      </View>
                    ) : null;
                  })()}
                </View>
              )}
            </View>

            {/* Action Buttons */}
            {symbols.length > 0 && (
              <View style={{ gap: spacing.s8 }}>
                <Button
                  title="Save plan"
                  onPress={onSave}
                  disabled={monthlyAmount <= 0}
                />
                <Button
                  title="Cancel"
                  onPress={() => nav.goBack()}
                  variant="secondary"
                />
              </View>
            )}

            {/* Info Card */}
            <Card style={{ backgroundColor: withAlpha(accentSecondary, isDark ? 0.12 : 0.08), padding: spacing.s16 }}>
              <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                <Icon name="target" size={20} colorToken="accent.secondary" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: text, fontWeight: '700', marginBottom: spacing.s6 }}>
                    About DCA
                  </Text>
                  <Text style={{ color: muted, fontSize: 13, lineHeight: 19 }}>
                    Dollar-cost averaging means investing a fixed amount regularly, regardless of market conditions.
                    This reduces timing risk and builds discipline. Remember to review and rebalance quarterly.
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
