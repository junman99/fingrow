import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import { Card } from '../components/Card';
import Button from '../components/Button';
import { useInvestStore } from '../store/invest';
import { formatCurrency } from '../lib/format';
import { convertCurrency } from '../lib/fx';
import { useProfileStore } from '../store/profile';

function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
    const int = parseInt(expanded, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

const AnimatedPressable: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}> = ({ onPress, children, style }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const PortfolioList: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const { portfolios, quotes, fxRates, hydrate } = useInvestStore();
  const { profile } = useProfileStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;

  const portfolioCalc = useMemo(() => {
    const primaryCurrency = (profile.currency || 'USD').toUpperCase();
    const investCurrency = (profile.investCurrency || primaryCurrency).toUpperCase();

    // Build aggregated holdings across ALL tracked portfolios
    const aggregatedHoldings: Record<string, any> = {};
    Object.values(portfolios || {}).forEach((p: any) => {
      // Skip portfolios with tracking disabled
      if (!p || !p.holdings || (p.trackingEnabled === false)) return;
      Object.values(p.holdings || {}).forEach((h: any) => {
        const sym = h.symbol;
        if (!aggregatedHoldings[sym]) {
          aggregatedHoldings[sym] = { ...h, lots: [] };
        }
        aggregatedHoldings[sym].lots = aggregatedHoldings[sym].lots.concat(h.lots || []);
      });
    });

    const symbols = Object.keys(aggregatedHoldings);
    let totalChangeConverted = 0;
    const rows: { sym: string; value: number; qty: number; last: number; change: number; changePct: number }[] = [];

    for (const sym of symbols) {
      const h = aggregatedHoldings[sym];
      const q = quotes[sym]?.last || 0;
      const ch = quotes[sym]?.change || 0;
      const changePct = quotes[sym]?.changePct || 0;
      const qty = (h?.lots || []).reduce(
        (acc: number, l: any) => acc + (l.side === 'buy' ? l.qty : -l.qty),
        0
      );

      if (qty <= 0) continue;

      // Get ticker currency
      let tickerCurrency = h?.currency;
      if (!tickerCurrency) {
        const s = sym.toUpperCase();
        if (s.includes('-USD') || s.includes('USD')) tickerCurrency = 'USD';
        else if (s.endsWith('.L')) tickerCurrency = 'GBP';
        else if (s.endsWith('.T')) tickerCurrency = 'JPY';
        else if (s.endsWith('.TO')) tickerCurrency = 'CAD';
        else if (s.endsWith('.AX')) tickerCurrency = 'AUD';
        else if (s.endsWith('.HK')) tickerCurrency = 'HKD';
        else if (s.endsWith('.PA') || s.endsWith('.DE')) tickerCurrency = 'EUR';
        else if (s.endsWith('.SW')) tickerCurrency = 'CHF';
        else tickerCurrency = 'USD';
      }
      tickerCurrency = String(tickerCurrency).toUpperCase();

      // Convert to investment currency first, then to primary
      const priceInInvestCurrency = convertCurrency(fxRates, q, tickerCurrency, investCurrency);
      const priceConverted = convertCurrency(fxRates, priceInInvestCurrency, investCurrency, primaryCurrency);
      const changeConvertedPerShare = convertCurrency(fxRates, ch, tickerCurrency, primaryCurrency);

      const value = priceConverted * qty;
      const change = changeConvertedPerShare * qty;
      totalChangeConverted += change;

      if (value !== 0) {
        rows.push({ sym, value, qty, last: priceConverted, change: changeConvertedPerShare, changePct });
      }
    }

    // Sum cash from ALL tracked portfolios
    let totalCashConverted = 0;
    Object.values(portfolios || {}).forEach((p: any) => {
      // Skip portfolios with tracking disabled
      if (!p || typeof p.cash !== 'number' || (p.trackingEnabled === false)) return;
      const portfolioBaseCurrency = String(p.baseCurrency || 'USD').toUpperCase();
      const cashNative = Number(p.cash) || 0;
      // Convert to primary currency
      totalCashConverted += convertCurrency(fxRates, cashNative, portfolioBaseCurrency, primaryCurrency);
    });

    const totalUSD = rows.reduce((acc, row) => acc + row.value, 0) + totalCashConverted;
    const allocations =
      totalUSD > 0
        ? [
            ...rows.map(row => ({ sym: row.sym, wt: row.value / totalUSD, value: row.value })),
            ...(totalCashConverted ? [{ sym: 'CASH', wt: totalCashConverted / totalUSD, value: totalCashConverted }] : []),
          ].sort((a, b) => b.wt - a.wt)
        : [];

    return { totalUSD, changeUSD: totalChangeConverted, allocations, rows, cash: totalCashConverted };
  }, [portfolios, quotes, fxRates, profile.currency, profile.investCurrency]);

  // Animations
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 400 });
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const portfolioChangeLabel =
    portfolioCalc.changeUSD === 0
      ? 'No change today'
      : `${portfolioCalc.changeUSD > 0 ? '+' : ''}${formatCurrency(portfolioCalc.changeUSD)} today`;

  const changePct = portfolioCalc.totalUSD > 0
    ? (portfolioCalc.changeUSD / (portfolioCalc.totalUSD - portfolioCalc.changeUSD)) * 100
    : 0;

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
    >
      {/* Header */}
      <Animated.View style={[{ gap: spacing.s8 }, fadeStyle]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8 }}>
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
            <Icon name="chevron-left" size={28} color={text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Combined Portfolio
            </Text>
            <Text style={{ color: text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: spacing.s2 }}>
              Investments
            </Text>
            <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
              All your tracked portfolios in one view
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Summary Card */}
      <Animated.View style={fadeStyle}>
        <Card
          style={{
            backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.12),
            padding: spacing.s20,
            gap: spacing.s16,
          }}
        >
          <View>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Portfolio Value
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.s6 }}>
              <Text style={{ color: text, fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>
                {formatCurrency(portfolioCalc.totalUSD)}
              </Text>
              <Text style={{ color: muted, fontSize: 14, marginLeft: spacing.s6, fontWeight: '600' }}>
                {(profile.currency || 'USD').toUpperCase()}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginTop: spacing.s10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                <Text style={{
                  color: portfolioCalc.changeUSD > 0 ? successColor : portfolioCalc.changeUSD < 0 ? warningColor : muted,
                  fontSize: 16,
                  fontWeight: '700'
                }}>
                  {portfolioCalc.changeUSD > 0 ? '+' : ''}{formatCurrency(portfolioCalc.changeUSD)}
                </Text>
                {changePct !== 0 && (
                  <Text style={{
                    color: changePct > 0 ? successColor : changePct < 0 ? warningColor : muted,
                    fontSize: 14,
                    fontWeight: '600'
                  }}>
                    ({changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%)
                  </Text>
                )}
              </View>
              <Text style={{ color: muted, fontSize: 14 }}>•</Text>
              <Text style={{ color: muted, fontSize: 13 }}>Today</Text>
            </View>
          </View>

          {/* Breakdown */}
          {portfolioCalc.totalUSD > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: withAlpha(border, isDark ? 0.2 : 0.3) }} />
              <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Holdings
                  </Text>
                  <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                    {formatCurrency(portfolioCalc.totalUSD - portfolioCalc.cash)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Cash
                  </Text>
                  <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                    {formatCurrency(portfolioCalc.cash)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </Card>
      </Animated.View>

      {/* Top Holdings */}
      {portfolioCalc.allocations.filter(a => a.sym !== 'CASH').length > 0 && (
        <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
            Top Holdings
          </Text>
          <Card style={{ backgroundColor: cardBg, padding: spacing.s16, gap: spacing.s10 }}>
            {portfolioCalc.allocations.filter(item => item.sym !== 'CASH').slice(0, 5).map((item, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.s8,
                  borderBottomWidth: idx < Math.min(4, portfolioCalc.allocations.filter(a => a.sym !== 'CASH').length - 1) ? 1 : 0,
                  borderBottomColor: withAlpha(border, 0.4),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: idx === 0 ? accentPrimary : idx === 1 ? accentSecondary : successColor,
                    }}
                  />
                  <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>{item.sym}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                    {(item.wt * 100).toFixed(1)}%
                  </Text>
                  <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                    {formatCurrency(item.value)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {/* Holdings List */}
      {portfolioCalc.rows.length === 0 ? (
        <Animated.View style={fadeStyle}>
          <Card style={{ backgroundColor: cardBg, padding: spacing.s20 }}>
            <View style={{ gap: spacing.s16, alignItems: 'center' }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius.xl,
                  backgroundColor: withAlpha(accentSecondary, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="trending-up" size={32} color={accentSecondary} />
              </View>
              <View style={{ alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                  No investments yet
                </Text>
                <Text style={{ color: muted, textAlign: 'center', lineHeight: 20 }}>
                  Start building your portfolio by adding your first holding
                </Text>
              </View>
              <Button
                title="Open Portfolio"
                onPress={() => nav.navigate('Invest', { screen: 'InvestHome' })}
                style={{ width: '100%' }}
              />
            </View>
          </Card>
        </Animated.View>
      ) : (
        <>
          {/* Holdings */}
          <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              Holdings ({portfolioCalc.rows.length})
            </Text>
            <View style={{ gap: spacing.s10 }}>
              {portfolioCalc.rows.sort((a, b) => b.value - a.value).map(holding => (
                <Card
                  key={holding.sym}
                  style={{
                    backgroundColor: cardBg,
                    padding: spacing.s16,
                    borderWidth: 1,
                    borderColor: border,
                  }}
                >
                  <View style={{ gap: spacing.s12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: radius.lg,
                            backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.15),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: accentSecondary, fontWeight: '800', fontSize: 16 }}>
                            {holding.sym.slice(0, 2)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>{holding.sym}</Text>
                          <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                            {holding.qty.toFixed(4)} shares @ {formatCurrency(holding.last)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: text, fontWeight: '800', fontSize: 20 }}>
                          {formatCurrency(holding.value)}
                        </Text>
                        {holding.change !== 0 && (
                          <Text style={{
                            color: holding.change > 0 ? successColor : holding.change < 0 ? warningColor : muted,
                            fontSize: 13,
                            fontWeight: '600',
                            marginTop: 2
                          }}>
                            {holding.change > 0 ? '+' : ''}{formatCurrency(holding.change * holding.qty)} ({holding.changePct > 0 ? '+' : ''}{holding.changePct.toFixed(2)}%)
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </Animated.View>

          {/* Cash */}
          {portfolioCalc.cash > 0 && (
            <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
                Cash Balance
              </Text>
              <Card
                style={{
                  backgroundColor: cardBg,
                  padding: spacing.s16,
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: radius.lg,
                        backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.15),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="dollar-sign" size={24} color={successColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>Cash</Text>
                      <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                        Available for trading
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: text, fontWeight: '800', fontSize: 20 }}>
                    {formatCurrency(portfolioCalc.cash)}
                  </Text>
                </View>
              </Card>
            </Animated.View>
          )}
        </>
      )}

      {/* Quick Actions */}
      <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
        <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
          Quick Actions
        </Text>
        <View style={{ gap: spacing.s8 }}>
          <Button
            title="Open full portfolio"
            onPress={() => nav.navigate('Invest', { screen: 'InvestHome' })}
            variant="secondary"
            icon="trending-up"
          />
          {portfolioCalc.totalUSD > 0 && (
            <Button
              title="Plan DCA"
              onPress={() => nav.navigate('Invest', { screen: 'DCAPlanner' })}
              variant="secondary"
              icon="calendar"
            />
          )}
        </View>
      </Animated.View>
    </ScreenScroll>
  );
};

export default PortfolioList;
