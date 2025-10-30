import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useInvestStore } from '../store/invest';
import Icon from '../components/Icon';
import { formatCurrency } from '../lib/format';
import { computePnL } from '../lib/positions';
import LineChart from '../components/LineChart';

function withAlpha(color: string, alpha: number) {
  if (!color) return color;
  const raw = color.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function PortfolioDetail() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();

  const portfolioId = route.params?.portfolioId as string;
  const { portfolios, quotes } = useInvestStore();
  const p = portfolios[portfolioId];

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;
  const errorColor = get('semantic.error') as string;

  const summary = React.useMemo(() => {
    if (!p) return null;
    const base = String(p.baseCurrency || 'USD').toUpperCase();
    let holdingsValue = 0;
    let dayDelta = 0;
    let totalGain = 0;
    const openRows: Array<{ sym: string; value: number }> = [];

    Object.values(p.holdings || {}).forEach((h: any) => {
      if (!h) return;
      const lots = h.lots || [];
      const qty = lots.reduce((acc: number, lot: any) => acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
      if (qty <= 0) return;

      const q = quotes[h.symbol];
      const last = q?.last || 0;
      const change = q?.change || 0;
      const value = last * qty;
      holdingsValue += value;
      dayDelta += change * qty;

      const norm = lots.map((l: any) => ({ ...l, fee: l.fee ?? l.fees }));
      const pnl = computePnL(norm, last);
      totalGain += pnl.totalGain;
      openRows.push({ sym: h.symbol, value });
    });

    const cashValue = Number(p.cash || 0);
    const totalValue = holdingsValue + cashValue;
    const positions = openRows.length;

    return { base, totalValue, holdingsValue, cashValue, dayDelta, totalGain, positions, openHoldings: openRows.map(r => r.sym) };
  }, [p, quotes]);

  if (!p || !summary) {
    return (
      <View style={{ flex: 1, backgroundColor: get('background.default') as string, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: textMuted }}>Portfolio not found</Text>
      </View>
    );
  }

  const dayColor = summary.dayDelta >= 0 ? successColor : errorColor;
  const totalColor = summary.totalGain >= 0 ? successColor : errorColor;

  // Generate simple portfolio history chart data (last 30 days)
  const chartData = React.useMemo(() => {
    const now = Date.now();
    const points: Array<{ t: number; v: number }> = [];
    const startValue = summary.totalValue - summary.totalGain;

    // Generate 30 data points with simple linear progression
    for (let i = 0; i < 30; i++) {
      const t = now - (29 - i) * 24 * 60 * 60 * 1000;
      const progress = i / 29;
      const v = startValue + (summary.totalGain * progress);
      points.push({ t, v });
    }

    return points;
  }, [summary.totalValue, summary.totalGain]);

  return (
    <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s32 }}>
        {/* Header with Back Button */}
        <View style={{ paddingHorizontal: spacing.s16, marginTop: spacing.s12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8, marginBottom: spacing.s16 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={({ pressed }) => ({
                padding: spacing.s8,
                marginLeft: -spacing.s8,
                marginTop: -spacing.s4,
                borderRadius: radius.md,
                backgroundColor: pressed ? cardBg : 'transparent',
              })}
              hitSlop={8}
            >
              <Icon name="chevron-left" size={28} color={textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
                {p.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Value Display */}
        <View style={{ paddingHorizontal: spacing.s16 }}>
          <View>
            <Text style={{ color: textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600', marginBottom: spacing.s4 }}>
              Total Value
            </Text>
            <Text style={{ color: textPrimary, fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>
              {formatCurrency(summary.totalValue, summary.base)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginTop: spacing.s6 }}>
              <Text style={{ color: dayColor, fontWeight: '600', fontSize: 13 }}>
                Today {summary.dayDelta >= 0 ? '+' : ''}{formatCurrency(Math.abs(summary.dayDelta), summary.base)} ({summary.dayDelta >= 0 ? '+' : ''}{((summary.dayDelta / Math.max(summary.totalValue - summary.dayDelta, 1)) * 100).toFixed(2)}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Portfolio Progress Chart - Temporarily disabled due to gesture handler issues */}
        {/* TODO: Re-enable once LineChart gesture issues are resolved */}

        {/* Summary Cards */}
        <View style={{ paddingHorizontal: spacing.s16, gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <View style={{
              flex: 1,
              backgroundColor: cardBg,
              borderRadius: radius.xl,
              padding: spacing.s16,
              borderWidth: 1,
              borderColor: withAlpha(border, isDark ? 0.5 : 1),
            }}>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s6 }}>Holdings</Text>
              <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>
                {formatCurrency(summary.holdingsValue, summary.base)}
              </Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: cardBg,
              borderRadius: radius.xl,
              padding: spacing.s16,
              borderWidth: 1,
              borderColor: withAlpha(border, isDark ? 0.5 : 1),
            }}>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s6 }}>Cash</Text>
              <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>
                {formatCurrency(summary.cashValue, summary.base)}
              </Text>
            </View>
          </View>

          <View style={{
            backgroundColor: withAlpha(totalColor, isDark ? 0.15 : 0.1),
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: withAlpha(totalColor, isDark ? 0.4 : 0.3),
          }}>
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s6 }}>Total Gain/Loss</Text>
            <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800' }}>
              {summary.totalGain >= 0 ? '+' : ''}{formatCurrency(Math.abs(summary.totalGain), summary.base)}
            </Text>
          </View>
        </View>

        {/* Holdings List */}
        <View style={{ paddingHorizontal: spacing.s16 }}>
          <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginBottom: spacing.s12 }}>
            Holdings
          </Text>
          <View style={{
            backgroundColor: cardBg,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: withAlpha(border, isDark ? 0.5 : 1),
          }}>
            {summary.openHoldings.map((sym, index) => {
              const h = p.holdings?.[sym];
              if (!h) return null;

              const lots = h.lots || [];
              const qty = lots.reduce((acc: number, lot: any) => acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
              const q = quotes[sym];
              const last = q?.last || 0;
              const value = last * qty;

              const norm = lots.map((l: any) => ({ ...l, fee: l.fee ?? l.fees }));
              const pnl = computePnL(norm, last);
              const totalGain = isNaN(pnl.totalGain) ? 0 : pnl.totalGain;
              const gainColor = totalGain >= 0 ? successColor : errorColor;

              return (
                <View key={sym}>
                  <View style={{ padding: spacing.s16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s8 }}>
                      <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>{sym}</Text>
                      <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '800' }}>
                        {formatCurrency(value, summary.base)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: textMuted, fontSize: 13 }}>{qty.toFixed(2)} shares @ {formatCurrency(last, summary.base)}</Text>
                      <Text style={{ color: gainColor, fontSize: 13, fontWeight: '600' }}>
                        {totalGain >= 0 ? '+' : ''}{formatCurrency(Math.abs(totalGain), summary.base)}
                      </Text>
                    </View>
                  </View>
                  {index < summary.openHoldings.length - 1 && (
                    <View style={{ height: 1, backgroundColor: withAlpha(border, 0.3), marginHorizontal: spacing.s16 }} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
    </ScreenScroll>
  );
}
