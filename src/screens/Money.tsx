import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { Card } from '../components/Card';
import Button from '../components/Button';
import Icon from '../components/Icon';
import BottomSheet from '../components/BottomSheet';
import { useAccountsStore } from '../store/accounts';
import { useInvestStore } from '../store/invest';
import { formatCurrency } from '../lib/format';
import { useNavigation } from '@react-navigation/native';
import { useRecurringStore, computeNextDue, Recurring } from '../store/recurring';
import { usePlansStore } from '../store/plans';
import { useDebtsStore } from '../store/debts';
import { useTxStore } from '../store/transactions';

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

function sumUpcoming(recurring: Recurring[], now: Date, withinDays: number) {
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  let total = 0;
  const list: { id: string; label: string; amount: number; due: Date }[] = [];
  for (const r of recurring) {
    const due = computeNextDue(r, now);
    if (due && due <= cutoff) {
      total += Number(r.amount || 0);
      list.push({ id: r.id, label: r.label || r.category, amount: r.amount, due });
    }
  }
  list.sort((a, b) => a.due.getTime() - b.due.getTime());
  return { total, list };
}

type MetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: 'wallet' | 'trending-up' | 'receipt' | 'target';
  bgColor: string;
  onPress: () => void;
  badge?: { text: string; variant: 'neutral' | 'warning' | 'success' };
};

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, bgColor, onPress, badge }) => {
  const { get, isDark } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: '48%',
        backgroundColor: bgColor,
        borderRadius: radius.lg,
        padding: spacing.s16,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Icon name={icon} size={24} colorToken="text.primary" />
        {badge && (
          <View
            style={{
              paddingHorizontal: spacing.s8,
              paddingVertical: spacing.s4,
              borderRadius: radius.sm,
              backgroundColor:
                badge.variant === 'warning'
                  ? withAlpha(get('semantic.warning') as string, isDark ? 0.3 : 0.2)
                  : badge.variant === 'success'
                  ? withAlpha(get('semantic.success') as string, isDark ? 0.3 : 0.2)
                  : withAlpha(text, isDark ? 0.15 : 0.1),
            }}
          >
            <Text style={{ color: text, fontSize: 11, fontWeight: '700' }}>{badge.text}</Text>
          </View>
        )}
      </View>
      <Text style={{ color: muted, fontSize: 13, fontWeight: '600', marginTop: spacing.s12 }}>
        {title}
      </Text>
      <Text style={{ color: text, fontSize: 24, fontWeight: '800', marginTop: spacing.s4 }}>
        {value}
      </Text>
      <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s6 }}>{subtitle}</Text>
    </Pressable>
  );
};

const Money: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const [showAccountsSheet, setShowAccountsSheet] = useState(false);
  const [showPortfolioSheet, setShowPortfolioSheet] = useState(false);
  const [showDebtsSheet, setShowDebtsSheet] = useState(false);
  const { accounts, hydrate: hydrateAcc } = useAccountsStore();
  const { holdings, quotes, hydrate: hydrateInvest } = useInvestStore();
  const { items: recurring, hydrate: hydrateRecur } = useRecurringStore();
  const { hydrate: hydratePlan } = usePlansStore();
  const { transactions, hydrate: hydrateTx } = useTxStore();
  const { items: debts, hydrate: hydrateDebts } = useDebtsStore();
  const sheetTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const sheetRafs = useRef<number[]>([]);

  useEffect(() => {
    hydrateAcc();
    hydrateInvest();
    hydrateRecur();
    hydrateTx();
    hydratePlan();
    hydrateDebts();
  }, [hydrateAcc, hydrateInvest, hydrateRecur, hydrateTx, hydratePlan, hydrateDebts]);

  useEffect(() => () => {
    sheetTimers.current.forEach(clearTimeout);
    sheetTimers.current = [];
    sheetRafs.current.forEach(id => cancelAnimationFrame(id));
    sheetRafs.current = [];
  }, []);

  const closeSheetThen = (
    setter: (value: React.SetStateAction<boolean>) => void,
    cb: () => void,
    opts?: { immediate?: boolean }
  ) => {
    setter(false);
    if (opts?.immediate) {
      const id = requestAnimationFrame(() => {
        cb();
        sheetRafs.current = sheetRafs.current.filter(r => r !== id);
      });
      sheetRafs.current.push(id);
      return;
    }
    const timer = setTimeout(() => {
      cb();
      sheetTimers.current = sheetTimers.current.filter(t => t !== timer);
    }, 260);
    sheetTimers.current.push(timer);
  };

  const accountsList = accounts || [];
  const includedAccounts = useMemo(
    () => accountsList.filter(acc => acc.includeInNetWorth !== false),
    [accountsList]
  );
  const excludedAccountCount = accountsList.length - includedAccounts.length;
  const debtsList = debts || [];

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const warningColor = get('semantic.warning') as string;
  const successColor = get('semantic.success') as string;
  const bgDefault = get('background.default') as string;

  const avgDaily = useMemo(() => {
    if (!transactions || transactions.length === 0) return 0;
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const spent = transactions
      .filter(t => t.type === 'expense' && new Date(t.date) >= cutoff)
      .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    return spent / 30;
  }, [transactions]);

  const totalCash = includedAccounts.reduce((s, a) => s + (a.balance || 0), 0);
  const runwayDays = avgDaily > 0 ? Math.floor(totalCash / avgDaily) : 0;

  const portfolioCalc = useMemo(() => {
    const symbols = Object.keys(holdings || {});
    let changeUSD = 0;
    const rows: { sym: string; value: number }[] = [];
    for (const sym of symbols) {
      const q = quotes[sym]?.last || 0;
      const ch = quotes[sym]?.change || 0;
      const qty = (holdings[sym]?.lots || []).reduce(
        (acc, l) => acc + (l.side === 'buy' ? l.qty : -l.qty),
        0
      );
      const value = q * qty;
      changeUSD += ch * qty;
      if (value !== 0) {
        rows.push({ sym, value });
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
            ...rows.map(row => ({ sym: row.sym, wt: row.value / totalUSD })),
            ...(cash ? [{ sym: 'CASH', wt: cash / totalUSD }] : []),
          ]
            .sort((a, b) => b.wt - a.wt)
            .slice(0, 3)
        : [];
    return { totalUSD, changeUSD, allocations };
  }, [holdings, quotes]);

  const upcoming = useMemo(() => sumUpcoming(recurring || [], new Date(), 30), [recurring]);

  const debtDue = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let total = 0;
    const list: { id: string; name: string; minDue: number; due: Date }[] = [];
    for (const d of debtsList) {
      const due = d.dueISO ? new Date(d.dueISO) : null;
      if (due && !isNaN(due.getTime()) && due <= cutoff) {
        total += d.minDue || 0;
        list.push({ id: d.id, name: d.name, minDue: d.minDue || 0, due });
      }
    }
    list.sort((a, b) => a.due.getTime() - b.due.getTime());
    return { total, list };
  }, [debtsList]);

  const spendable = Math.max(0, totalCash - upcoming.total - debtDue.total);
  const totalDebt = debtsList.reduce((s, d) => s + (d.balance || 0), 0);

  const netWorth = totalCash + portfolioCalc.totalUSD - totalDebt;

  // Generate insights
  const insights: { message: string; action?: { label: string; onPress: () => void } }[] = [];

  if (accountsList.length === 0) {
    insights.push({
      message: 'Add your first account to start tracking your finances',
      action: { label: 'Add account', onPress: () => nav.navigate('AddAccount') },
    });
  } else if (runwayDays < 30 && runwayDays > 0) {
    insights.push({
      message: `Your runway is ${runwayDays} days. Consider building up your cash reserves.`,
    });
  } else if (upcoming.total > totalCash) {
    insights.push({
      message: `Upcoming bills (${formatCurrency(upcoming.total)}) exceed your cash. Top up by ${formatCurrency(upcoming.total - totalCash)}.`,
    });
  } else if (spendable > 500 && portfolioCalc.totalUSD === 0) {
    insights.push({
      message: `You have ${formatCurrency(spendable)} spendable. Consider starting your investment journey.`,
      action: { label: 'View portfolio', onPress: () => nav.navigate('Invest', { screen: 'InvestHome' }) },
    });
  } else if (spendable > 1000) {
    const suggest = Math.floor(spendable * 0.25);
    insights.push({
      message: `Strong cash position. Consider deploying ${formatCurrency(suggest)} into investments.`,
      action: { label: 'Plan DCA', onPress: () => nav.navigate('DCAPlanner', { suggest }) },
    });
  }

  if (totalDebt > 0 && debtDue.total > 0 && debtDue.total > totalCash * 0.5) {
    insights.push({
      message: `Debt payments (${formatCurrency(debtDue.total)}) are high relative to cash. Review your payoff plan.`,
      action: { label: 'Simulate payoff', onPress: () => nav.navigate('PayoffSimulator') },
    });
  }

  if (portfolioCalc.changeUSD > 100) {
    insights.push({
      message: `Portfolio up ${formatCurrency(portfolioCalc.changeUSD)} today. Nice gains!`,
    });
  } else if (portfolioCalc.changeUSD < -100) {
    insights.push({
      message: `Portfolio down ${formatCurrency(Math.abs(portfolioCalc.changeUSD))} today. Stay the course.`,
    });
  }

  if (insights.length === 0) {
    insights.push({ message: 'Everything looks healthy. Keep building your wealth.' });
  }

  // Health status for runway
  const runwayStatus: 'success' | 'warning' | 'neutral' =
    runwayDays >= 60 ? 'success' : runwayDays >= 30 ? 'neutral' : 'warning';

  const portfolioChangeLabel =
    portfolioCalc.changeUSD === 0
      ? 'No change today'
      : `${portfolioCalc.changeUSD > 0 ? '+' : ''}${formatCurrency(portfolioCalc.changeUSD)} today`;

  return (
    <ScreenScroll
      inTab
      contentStyle={{
        paddingHorizontal: spacing.s16,
        paddingTop: spacing.s16,
        paddingBottom: spacing.s32,
        gap: spacing.s24,
      }}
    >
      {/* Header */}
      <View>
        <Text style={{ color: muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.s4 }}>
          Net Worth
        </Text>
        <Text style={{ color: text, fontSize: 40, fontWeight: '800', letterSpacing: -0.5 }}>
          {formatCurrency(netWorth)}
        </Text>
      </View>

      {/* Key Metrics Grid */}
      <View style={{ gap: spacing.s12 }}>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <MetricCard
            title="Cash"
            value={formatCurrency(totalCash)}
            subtitle={`${includedAccounts.length} account${includedAccounts.length === 1 ? '' : 's'}`}
            icon="wallet"
            bgColor={withAlpha(accentPrimary, isDark ? 0.2 : 0.12)}
            onPress={() => setShowAccountsSheet(true)}
            badge={
              runwayDays > 0
                ? { text: `${runwayDays}d runway`, variant: runwayStatus }
                : undefined
            }
          />
          <MetricCard
            title="Portfolio"
            value={formatCurrency(portfolioCalc.totalUSD)}
            subtitle={portfolioChangeLabel}
            icon="trending-up"
            bgColor={withAlpha(accentSecondary, isDark ? 0.22 : 0.14)}
            onPress={() => setShowPortfolioSheet(true)}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <MetricCard
            title="Bills due"
            value={formatCurrency(upcoming.total)}
            subtitle={`${upcoming.list.length} in next 30 days`}
            icon="receipt"
            bgColor={withAlpha(successColor, isDark ? 0.2 : 0.14)}
            onPress={() => nav.navigate('Bills')}
            badge={
              upcoming.total > totalCash
                ? { text: 'Over cash', variant: 'warning' }
                : undefined
            }
          />
          <MetricCard
            title="Debts"
            value={formatCurrency(totalDebt)}
            subtitle={`${formatCurrency(debtDue.total)} due soon`}
            icon="target"
            bgColor={withAlpha(warningColor, isDark ? 0.2 : 0.14)}
            onPress={() => setShowDebtsSheet(true)}
          />
        </View>
      </View>

      {/* Spendable Cash Highlight */}
      <Card
        style={{
          backgroundColor: cardBg,
          padding: spacing.s16,
          borderWidth: 2,
          borderColor: withAlpha(accentPrimary, 0.3),
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Available to spend</Text>
            <Text style={{ color: text, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
              {formatCurrency(spendable)}
            </Text>
            <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s6 }}>
              After bills & debt payments
            </Text>
          </View>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.lg,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="wallet" size={28} colorToken="accent.primary" />
          </View>
        </View>
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>Insights</Text>
          {insights.slice(0, 3).map((insight, idx) => (
            <Card key={idx} style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
              <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                <View
                  style={{
                    width: 6,
                    borderRadius: 3,
                    backgroundColor: accentPrimary,
                  }}
                />
                <View style={{ flex: 1, gap: spacing.s12 }}>
                  <Text style={{ color: onSurface, fontSize: 14, lineHeight: 20 }}>
                    {insight.message}
                  </Text>
                  {insight.action && (
                    <Button
                      title={insight.action.label}
                      onPress={insight.action.onPress}
                      variant="secondary"
                      size="sm"
                    />
                  )}
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>Quick actions</Text>
        <View style={{ gap: spacing.s8 }}>
          <Button
            title="Add account"
            onPress={() => nav.navigate('AddAccount')}
            variant="secondary"
          />
          <Button
            title="Plan auto-DCA"
            onPress={() => nav.navigate('DCAPlanner', { suggest: Math.floor(spendable * 0.25) })}
            variant="secondary"
          />
        </View>
      </View>

      {/* Bottom Sheets */}
      <BottomSheet
        visible={showAccountsSheet}
        onClose={() => setShowAccountsSheet(false)}
        fullHeight
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.s16, gap: spacing.s16 }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={{ color: text, fontSize: 24, fontWeight: '700' }}>Accounts</Text>
            <Text style={{ color: muted, marginTop: spacing.s6 }}>
              Manage your bank accounts and balances
            </Text>
          </View>

          <Card
            style={{
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.12),
              padding: spacing.s16,
            }}
          >
            <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Total cash</Text>
            <Text style={{ color: text, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
              {formatCurrency(totalCash)}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.s16, marginTop: spacing.s12 }}>
              <View>
                <Text style={{ color: muted, fontSize: 12 }}>Spendable</Text>
                <Text style={{ color: onSurface, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                  {formatCurrency(spendable)}
                </Text>
              </View>
              <View>
                <Text style={{ color: muted, fontSize: 12 }}>Runway</Text>
                <Text style={{ color: onSurface, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                  {runwayDays} days
                </Text>
              </View>
              <View>
                <Text style={{ color: muted, fontSize: 12 }}>Daily avg</Text>
                <Text style={{ color: onSurface, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                  {formatCurrency(avgDaily)}
                </Text>
              </View>
            </View>
          </Card>

          {accountsList.length === 0 ? (
            <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
              <Text style={{ color: muted, marginBottom: spacing.s12 }}>
                No accounts yet. Add your first account to start tracking.
              </Text>
              <Button
                title="Add account"
                onPress={() => closeSheetThen(setShowAccountsSheet, () => nav.navigate('AddAccount'), { immediate: true })}
              />
            </Card>
          ) : (
            <View style={{ gap: spacing.s8 }}>
              {accountsList.map(account => {
                const excluded = account.includeInNetWorth === false;
                return (
                  <Pressable
                    key={account.id}
                    onPress={() => {
                      closeSheetThen(setShowAccountsSheet, () => nav.navigate('AccountDetail', { id: account.id }));
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: cardBg,
                      borderRadius: radius.md,
                      padding: spacing.s16,
                      opacity: pressed ? 0.8 : excluded ? 0.7 : 1,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radius.md,
                          backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="wallet" size={20} colorToken="accent.primary" />
                      </View>
                      <View>
                        <Text style={{ color: text, fontWeight: '700' }}>{account.name}</Text>
                        <Text style={{ color: muted, fontSize: 13 }}>
                          {account.institution ?? 'Manual'}
                          {account.mask ? ` • ${account.mask}` : ''}
                          {excluded ? ' • Hidden' : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: onSurface, fontWeight: '700', fontSize: 16 }}>
                      {formatCurrency(account.balance)}
                    </Text>
                  </Pressable>
                );
              })}
              <Button
                title="Add account"
                onPress={() => closeSheetThen(setShowAccountsSheet, () => nav.navigate('AddAccount'), { immediate: true })}
                variant="secondary"
                style={{ marginTop: spacing.s8 }}
              />
            </View>
          )}
          {excludedAccountCount > 0 && (
            <Text style={{ color: muted, fontSize: 12, textAlign: 'center' }}>
              {excludedAccountCount} account{excludedAccountCount === 1 ? '' : 's'} hidden from net worth
            </Text>
          )}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={showPortfolioSheet}
        onClose={() => setShowPortfolioSheet(false)}
        fullHeight
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.s16, gap: spacing.s16 }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={{ color: text, fontSize: 24, fontWeight: '700' }}>Portfolio</Text>
            <Text style={{ color: muted, marginTop: spacing.s6 }}>
              Track your investments and market performance
            </Text>
          </View>

          <Card
            style={{
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.22 : 0.14),
              padding: spacing.s16,
            }}
          >
            <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Total value</Text>
            <Text style={{ color: text, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
              {formatCurrency(portfolioCalc.totalUSD)}
            </Text>
            <Text style={{ color: muted, marginTop: spacing.s8 }}>{portfolioChangeLabel}</Text>
            {portfolioCalc.allocations.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.s8,
                  marginTop: spacing.s12,
                }}
              >
                {portfolioCalc.allocations.map(item => (
                  <View
                    key={item.sym}
                    style={{
                      paddingVertical: spacing.s6,
                      paddingHorizontal: spacing.s12,
                      borderRadius: radius.pill,
                      backgroundColor: withAlpha(text, isDark ? 0.12 : 0.08),
                    }}
                  >
                    <Text style={{ color: onSurface, fontWeight: '600', fontSize: 13 }}>
                      {item.sym} {(item.wt * 100).toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Button
            title="Open portfolio"
            onPress={() => {
              closeSheetThen(setShowPortfolioSheet, () => nav.navigate('Invest', { screen: 'InvestHome' }));
            }}
          />

          {portfolioCalc.totalUSD === 0 && (
            <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
              <Text style={{ color: muted }}>
                No investments yet. Start building your portfolio by adding your first holding.
              </Text>
            </Card>
          )}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={showDebtsSheet}
        onClose={() => setShowDebtsSheet(false)}
        fullHeight
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.s16, gap: spacing.s16 }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={{ color: text, fontSize: 24, fontWeight: '700' }}>Debts</Text>
            <Text style={{ color: muted, marginTop: spacing.s6 }}>
              Manage and track your debt payoff journey
            </Text>
          </View>

          <Card
            style={{
              backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.14),
              padding: spacing.s16,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Total balance</Text>
                <Text style={{ color: text, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
                  {formatCurrency(totalDebt)}
                </Text>
              </View>
              <View>
                <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Due soon</Text>
                <Text style={{ color: text, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
                  {formatCurrency(debtDue.total)}
                </Text>
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <Button
              title="Add debt"
              onPress={() => {
                closeSheetThen(setShowDebtsSheet, () => nav.navigate('AddDebt'), { immediate: true });
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="Payoff simulator"
              variant="secondary"
              onPress={() => {
                closeSheetThen(setShowDebtsSheet, () => nav.navigate('PayoffSimulator'));
              }}
              style={{ flex: 1 }}
            />
          </View>

          {debtsList.length === 0 ? (
            <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
              <Text style={{ color: muted }}>
                No debts tracked. Add your debts to monitor payoff progress and due dates.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.s8 }}>
              {debtsList.map(debt => {
                const dueDate = debt.dueISO ? new Date(debt.dueISO) : null;
                const dueLabel =
                  dueDate && !isNaN(dueDate.getTime())
                    ? dueDate.toLocaleDateString()
                    : 'No due date';
                return (
                  <Pressable
                    key={debt.id}
                    onPress={() => {
                      closeSheetThen(setShowDebtsSheet, () => nav.navigate('DebtDetail', { id: debt.id }));
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: cardBg,
                      borderRadius: radius.md,
                      padding: spacing.s16,
                      opacity: pressed ? 0.86 : 1,
                    })}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.s8 }}>
                      <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>{debt.name}</Text>
                      <Text style={{ color: onSurface, fontWeight: '700', fontSize: 15 }}>
                        {formatCurrency(debt.balance)}
                      </Text>
                    </View>
                    <Text style={{ color: muted, fontSize: 13 }}>
                      {debt.type?.toUpperCase() || 'DEBT'} • {debt.apr ?? 0}% APR • Due {dueLabel}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s8 }}>
                      <Text style={{ color: muted, fontSize: 13 }}>Minimum payment</Text>
                      <Text style={{ color: onSurface, fontWeight: '600', fontSize: 13 }}>
                        {formatCurrency(debt.minDue)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </BottomSheet>
    </ScreenScroll>
  );
};

export default Money;
