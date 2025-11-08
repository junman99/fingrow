import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../../components/ScreenScroll';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import Icon from '../../../components/Icon';
import { Card } from '../../../components/Card';
import Button from '../../../components/Button';
import BottomSheet from '../../../components/BottomSheet';
import { useAccountsStore } from '../../../store/accounts';
import { useInvestStore } from '../store/invest';
import { useProfileStore } from '../../../store/profile';
import { formatCurrency } from '../../../lib/format';
import { convertCurrency } from '../../../lib/fx';

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

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string;
  icon: string;
  count: number;
  total: number;
  color: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}> = ({ title, icon, count, total, color, children, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const { get, isDark } = useThemeTokens();

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (count === 0) return null;

  return (
    <Card
      style={{
        backgroundColor: cardBg,
        padding: 0,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: border,
      }}
    >
      {/* Header - Always visible */}
      <View style={{ backgroundColor: withAlpha(color, isDark ? 0.15 : 0.1), overflow: 'hidden' }}>
        <AnimatedPressable onPress={toggleExpand}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: spacing.s16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(color, isDark ? 0.3 : 0.2),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={icon as any} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
                <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                  {count} account{count === 1 ? '' : 's'} • {formatCurrency(total)}
                </Text>
              </View>
            </View>
            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={muted} />
          </View>
        </AnimatedPressable>
      </View>

      {/* Expandable Content - Account cards inside */}
      {isExpanded && (
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s4, paddingBottom: spacing.s8 }}>
          {children}
        </View>
      )}
    </Card>
  );
};

const InvestmentsList: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const { accounts, hydrate: hydrateAcc } = useAccountsStore();
  const { quotes, hydrate: hydrateInvest } = useInvestStore();
  const { profile, update: updateProfile } = useProfileStore();
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);

  useEffect(() => {
    hydrateAcc();
    hydrateInvest();
  }, [hydrateAcc, hydrateInvest]);

  const accountsList = accounts || [];

  const retirementAccounts = useMemo(
    () => accountsList.filter(acc => acc.kind === 'retirement' && acc.includeInNetWorth !== false),
    [accountsList]
  );

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;

  // Calculate portfolio value
  const portfolioCalc = useMemo(() => {
    const { fxRates, portfolios } = useInvestStore.getState();
    const investCurrency = (profile.investCurrency || profile.currency || 'USD').toUpperCase();
    const primaryCurrency = (profile.currency || 'USD').toUpperCase();

    // Build aggregated holdings across ALL portfolios (excluding disabled tracking)
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

    for (const sym of symbols) {
      const h = aggregatedHoldings[sym];
      const q = quotes[sym]?.last || 0;
      const ch = quotes[sym]?.change || 0;
      const qty = (h?.lots || []).reduce(
        (acc, l) => acc + (l.side === 'buy' ? l.qty : -l.qty),
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

      // Convert to investment currency
      const changeConvertedPerShare = convertCurrency(fxRates, ch, tickerCurrency, investCurrency);
      totalChangeConverted += changeConvertedPerShare * qty;
    }

    // Sum cash from ALL portfolios (excluding disabled tracking)
    let totalCashInInvestCurrency = 0;
    Object.values(portfolios || {}).forEach((p: any) => {
      // Skip portfolios with tracking disabled
      if (!p || typeof p.cash !== 'number' || (p.trackingEnabled === false)) return;
      const portfolioBaseCurrency = String(p.baseCurrency || 'USD').toUpperCase();
      const cashNative = Number(p.cash) || 0;
      // Convert cash to investment currency
      totalCashInInvestCurrency += convertCurrency(fxRates, cashNative, portfolioBaseCurrency, investCurrency);
    });

    // Total value in investment currency
    const totalInInvestCurrency = symbols.reduce((acc, sym) => {
      const h = aggregatedHoldings[sym];
      const q = quotes[sym]?.last || 0;
      const qty = (h?.lots || []).reduce((a, l) => a + (l.side === 'buy' ? l.qty : -l.qty), 0);
      if (qty <= 0) return acc;
      let tickerCurrency = h?.currency || 'USD';
      const priceConverted = convertCurrency(fxRates, q, String(tickerCurrency).toUpperCase(), investCurrency);
      return acc + priceConverted * qty;
    }, 0) + totalCashInInvestCurrency;

    // Convert total portfolio value from investment currency to primary currency
    const totalInPrimaryCurrency = convertCurrency(fxRates, totalInInvestCurrency, investCurrency, primaryCurrency);

    // Also convert change to primary currency
    const changeInPrimaryCurrency = convertCurrency(fxRates, totalChangeConverted, investCurrency, primaryCurrency);

    // Calculate retirement accounts total
    const retirementAccountsTotal = retirementAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // Combined total = active portfolios + retirement accounts (if enabled)
    const includeRetirement = profile.includeRetirementInInvestments !== false; // Default to true
    const totalConverted = totalInPrimaryCurrency + (includeRetirement ? retirementAccountsTotal : 0);

    return {
      totalUSD: totalConverted,
      portfolioValue: totalInPrimaryCurrency,
      retirementValue: retirementAccountsTotal,
      changeUSD: changeInPrimaryCurrency,
    };
  }, [quotes, retirementAccounts, profile.investCurrency, profile.currency, profile.includeRetirementInInvestments]);

  // Animations
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 400 });
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const getAccountIcon = (kind?: string) => {
    switch (kind) {
      case 'retirement': return 'award';
      case 'investment': return 'trending-up';
      default: return 'shield';
    }
  };

  const renderAccount = (account: any, accentColor: string, isLast: boolean) => {
    const excluded = account.includeInNetWorth === false;

    return (
      <React.Fragment key={account.id}>
        <AnimatedPressable
          onPress={() => nav.navigate('AccountDetail', { id: account.id })}
          style={{
            paddingVertical: spacing.s8,
            opacity: excluded ? 0.7 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(accentColor, isDark ? 0.2 : 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={getAccountIcon(account.kind) as any} size={20} color={accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>{account.name}</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                  {account.institution ? `${account.institution}` : ''}
                  {account.mask ? ` • ${account.mask}` : ''}
                  {excluded ? ' • Hidden' : ''}
                </Text>
              </View>
            </View>
            <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>
              {formatCurrency(account.balance)}
            </Text>
          </View>
        </AnimatedPressable>
        {!isLast && (
          <View
            style={{
              height: 1,
              backgroundColor: withAlpha(border, 0.3),
              marginLeft: 52,
            }}
          />
        )}
      </React.Fragment>
    );
  };

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
    >
      {/* Header */}
      <Animated.View style={[{ gap: spacing.s8 }, fadeStyle]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8, flex: 1 }}>
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
              <Text style={{ color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 }}>
                Investments Overview
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setShowSettingsSheet(true)}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginRight: -spacing.s8,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="settings" size={24} color={text} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Summary - Direct on Background */}
      <Animated.View style={fadeStyle}>
        <View style={{ gap: spacing.s16 }}>
          <View>
            <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Total investments</Text>
            <Text style={{ color: text, fontSize: 36, fontWeight: '800', marginTop: spacing.s6, letterSpacing: -0.8 }}>
              {formatCurrency(portfolioCalc.totalUSD)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s20 }}>
            {portfolioCalc.changeUSD !== 0 && (
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, fontSize: 12 }}>Today's change</Text>
                <Text style={{
                  color: portfolioCalc.changeUSD >= 0 ? successColor : warningColor,
                  fontSize: 18,
                  fontWeight: '700',
                  marginTop: 4
                }}>
                  {portfolioCalc.changeUSD >= 0 ? '+' : ''}{formatCurrency(Math.abs(portfolioCalc.changeUSD))}
                </Text>
              </View>
            )}
            {portfolioCalc.portfolioValue > 0 && (
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, fontSize: 12 }}>Active portfolios</Text>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                  {formatCurrency(portfolioCalc.portfolioValue)}
                </Text>
              </View>
            )}
            {portfolioCalc.retirementValue > 0 && (
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, fontSize: 12 }}>Retirement</Text>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                  {formatCurrency(portfolioCalc.retirementValue)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {/* No Investments */}
      {portfolioCalc.totalUSD === 0 ? (
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
                  Start building your portfolio in the Invest tab
                </Text>
              </View>
              <Button
                title="Open Invest Tab"
                onPress={() => nav.navigate('Invest', { screen: 'InvestHome' })}
                style={{ width: '100%' }}
              />
            </View>
          </Card>
        </Animated.View>
      ) : (
        <>
          {/* Investments Section */}
          <Animated.View style={fadeStyle}>
            <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginBottom: 6 }}>
              Breakdown
            </Text>
          </Animated.View>

          {/* Investment Cards */}
          <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
            {/* Active Portfolios */}
            {portfolioCalc.portfolioValue > 0 && (
              <Card
                style={{
                  backgroundColor: cardBg,
                  padding: 0,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <View style={{ backgroundColor: withAlpha(accentSecondary, isDark ? 0.15 : 0.1), overflow: 'hidden' }}>
                  <AnimatedPressable onPress={() => nav.navigate('PortfolioList')}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: spacing.s16,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: radius.md,
                            backgroundColor: withAlpha(accentSecondary, isDark ? 0.3 : 0.2),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon name="trending-up" size={20} color={accentSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>Active Portfolios</Text>
                          <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                            Stocks, ETFs & cash • {formatCurrency(portfolioCalc.portfolioValue)}
                          </Text>
                        </View>
                      </View>
                      <Icon name="chevron-right" size={20} color={muted} />
                    </View>
                  </AnimatedPressable>
                </View>
              </Card>
            )}

            {/* Retirement Accounts - Collapsible */}
            {portfolioCalc.retirementValue > 0 && retirementAccounts.length > 0 && (
              <CollapsibleSection
                title="Retirement Accounts"
                icon="shield"
                count={retirementAccounts.length}
                total={portfolioCalc.retirementValue}
                color={successColor}
                defaultExpanded={false}
              >
                {retirementAccounts.map((account, index) =>
                  renderAccount(account, successColor, index === retirementAccounts.length - 1)
                )}
              </CollapsibleSection>
            )}
          </Animated.View>
        </>
      )}

      {/* Quick Actions */}
      <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
        <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>
          Quick access
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <Pressable
            onPress={() => nav.navigate('Invest', { screen: 'InvestHome' })}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: cardBg,
              borderRadius: radius.xl,
              padding: spacing.s16,
              gap: spacing.s12,
              borderWidth: 1,
              borderColor: withAlpha(border, isDark ? 0.5 : 1),
              opacity: pressed ? 0.85 : 1
            })}
          >
            <View style={{
              width: 48,
              height: 48,
              borderRadius: radius.lg,
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.25 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="trending-up" size={24} color={accentSecondary} />
            </View>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Invest tab</Text>
            <Text style={{ color: muted, fontSize: 13 }}>Manage portfolios</Text>
          </Pressable>

          <Pressable
            onPress={() => nav.navigate('AddAccount')}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: cardBg,
              borderRadius: radius.xl,
              padding: spacing.s16,
              gap: spacing.s12,
              borderWidth: 1,
              borderColor: withAlpha(border, isDark ? 0.5 : 1),
              opacity: pressed ? 0.85 : 1
            })}
          >
            <View style={{
              width: 48,
              height: 48,
              borderRadius: radius.lg,
              backgroundColor: withAlpha(successColor, isDark ? 0.25 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="plus" size={24} color={successColor} />
            </View>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Add account</Text>
            <Text style={{ color: muted, fontSize: 13 }}>Track retirement funds</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Settings Bottom Sheet */}
      <BottomSheet
        visible={showSettingsSheet}
        onClose={() => setShowSettingsSheet(false)}
      >
        <View style={{ gap: spacing.s20, paddingBottom: spacing.s16 }}>
          <View>
            <Text style={{ color: text, fontSize: 24, fontWeight: '700' }}>Investment Settings</Text>
            <Text style={{ color: muted, marginTop: spacing.s6 }}>
              Customize how investments are displayed
            </Text>
          </View>

          <View style={{ gap: spacing.s16 }}>
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                padding: spacing.s16,
                borderWidth: 1,
                borderColor: border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.s12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s4 }}>
                    <Icon name="shield" size={20} color={successColor} />
                    <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>
                      Include retirement accounts
                    </Text>
                  </View>
                  <Text style={{ color: muted, fontSize: 14, lineHeight: 20 }}>
                    Show retirement accounts (CPF, 401k, etc.) in total investment value on Money tab
                  </Text>
                </View>
                <Switch
                  value={profile.includeRetirementInInvestments !== false}
                  onValueChange={(value) => {
                    updateProfile({ includeRetirementInInvestments: value });
                  }}
                  trackColor={{ false: withAlpha(border, 0.5), true: successColor }}
                  thumbColor={isDark ? '#FFFFFF' : '#F4F3F4'}
                />
              </View>
            </View>

            <View
              style={{
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.1 : 0.05),
                borderRadius: radius.lg,
                padding: spacing.s14,
                borderWidth: 1,
                borderColor: withAlpha(accentPrimary, 0.2),
              }}
            >
              <View style={{ flexDirection: 'row', gap: spacing.s10 }}>
                <Icon name="info" size={16} color={accentPrimary} style={{ marginTop: 2 }} />
                <Text style={{ color: muted, fontSize: 13, lineHeight: 18, flex: 1 }}>
                  When disabled, retirement accounts will still appear in the Investments list, but won't be counted in your net worth or investment totals on the Money tab.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </BottomSheet>
    </ScreenScroll>
  );
};

export default InvestmentsList;
