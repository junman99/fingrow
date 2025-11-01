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
  const { holdings, quotes, hydrate } = useInvestStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successColor = get('semantic.success') as string;
  const errorColor = get('semantic.error') as string;

  const portfolioCalc = useMemo(() => {
    const symbols = Object.keys(holdings || {});
    let changeUSD = 0;
    const rows: { sym: string; value: number; qty: number; last: number; change: number; changePct: number }[] = [];

    for (const sym of symbols) {
      const q = quotes[sym]?.last || 0;
      const ch = quotes[sym]?.change || 0;
      const changePct = quotes[sym]?.changePercent || 0;
      const qty = (holdings[sym]?.lots || []).reduce(
        (acc, l) => acc + (l.side === 'buy' ? l.qty : -l.qty),
        0
      );
      const value = q * qty;
      changeUSD += ch * qty;

      if (value !== 0 || qty !== 0) {
        rows.push({ sym, value, qty, last: q, change: ch, changePct });
      }
    }

    let cash = 0;
    try {
      const portfolio = (useInvestStore.getState().activePortfolio?.() as any);
      if (portfolio && typeof portfolio.cash === 'number') {
        cash = Number(portfolio.cash) || 0;
      }
    } catch {}

    const totalUSD = rows.reduce((acc, row) => acc + row.value, 0) + cash;
    const allocations =
      totalUSD > 0
        ? [
            ...rows.map(row => ({ sym: row.sym, wt: row.value / totalUSD, value: row.value })),
            ...(cash ? [{ sym: 'CASH', wt: cash / totalUSD, value: cash }] : []),
          ].sort((a, b) => b.wt - a.wt)
        : [];

    return { totalUSD, changeUSD, allocations, rows, cash };
  }, [holdings, quotes]);

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
            <Text style={{ color: muted, fontSize: 14, fontWeight: '600' }}>
              Your Portfolio
            </Text>
            <Text style={{ color: text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: spacing.s2 }}>
              Investments
            </Text>
            <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
              Track your investments and performance
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Summary Card */}
      <Animated.View style={fadeStyle}>
        <Card
          style={{
            backgroundColor: withAlpha(accentSecondary, isDark ? 0.22 : 0.14),
            padding: spacing.s20,
            borderWidth: 2,
            borderColor: withAlpha(accentSecondary, 0.3),
          }}
        >
          <View style={{ gap: spacing.s16 }}>
            <View>
              <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Total value</Text>
              <Text style={{ color: text, fontSize: 32, fontWeight: '800', marginTop: spacing.s6, letterSpacing: -0.8 }}>
                {formatCurrency(portfolioCalc.totalUSD)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginTop: spacing.s8 }}>
                <Text style={{
                  color: portfolioCalc.changeUSD >= 0 ? successColor : errorColor,
                  fontSize: 16,
                  fontWeight: '700'
                }}>
                  {portfolioChangeLabel}
                </Text>
                {changePct !== 0 && (
                  <Text style={{
                    color: changePct >= 0 ? successColor : errorColor,
                    fontSize: 14,
                    fontWeight: '600'
                  }}>
                    ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                  </Text>
                )}
              </View>
            </View>

            {portfolioCalc.allocations.length > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: withAlpha(border, 0.3) }} />
                <View>
                  <Text style={{ color: muted, fontSize: 13, fontWeight: '600', marginBottom: spacing.s10 }}>
                    Top Holdings
                  </Text>
                  <View style={{ gap: spacing.s8 }}>
                    {portfolioCalc.allocations.slice(0, 5).map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, flex: 1 }}>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: radius.sm,
                              backgroundColor: withAlpha(accentSecondary, 0.3),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: text, fontWeight: '700', fontSize: 12 }}>
                              {item.sym === 'CASH' ? '$' : item.sym.slice(0, 2)}
                            </Text>
                          </View>
                          <Text style={{ color: onSurface, fontWeight: '600', fontSize: 14 }}>{item.sym}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
                            {(item.wt * 100).toFixed(1)}%
                          </Text>
                          <Text style={{ color: muted, fontSize: 12 }}>
                            {formatCurrency(item.value)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        </Card>
      </Animated.View>

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
                            color: holding.change >= 0 ? successColor : errorColor,
                            fontSize: 13,
                            fontWeight: '600',
                            marginTop: 2
                          }}>
                            {holding.change >= 0 ? '+' : ''}{formatCurrency(holding.change * holding.qty)} ({holding.changePct >= 0 ? '+' : ''}{holding.changePct.toFixed(2)}%)
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
