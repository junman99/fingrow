import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

  const muted = get('text.muted') as string;
  const text = get('text.primary') as string;
  const onSurface = get('text.onSurface') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const warningColor = get('semantic.warning') as string;
  const successColor = get('semantic.success') as string;

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

  const netWorth =
    totalCash +
    portfolioCalc.totalUSD -
    debtsList.reduce((s, d) => s + (d.balance || 0), 0);

  const nextActions: string[] = [];
  if (upcoming.total > 0 && totalCash < upcoming.total) {
    nextActions.push(
      `Top up cash by ${formatCurrency(upcoming.total - totalCash)} to cover the upcoming bills runway.`
    );
  } else if (spendable > 0 && portfolioCalc.totalUSD > 0) {
    const suggest = Math.max(0, Math.floor(spendable * 0.25));
    if (suggest > 0) {
      nextActions.push(`Deploy about ${formatCurrency(suggest)} into an auto-DCA this week.`);
    }
  }
  if (portfolioCalc.totalUSD > 0 && Math.abs(portfolioCalc.changeUSD) > 1) {
    const changeLabel =
      portfolioCalc.changeUSD >= 0
        ? `up ${formatCurrency(Math.abs(portfolioCalc.changeUSD))}`
        : `down ${formatCurrency(Math.abs(portfolioCalc.changeUSD))}`;
    nextActions.push(`Portfolio moved ${changeLabel} today — check allocations.`);
  }
  if (debtDue.total > 0 && debtDue.total > totalCash) {
    nextActions.push('Debt minimums exceed cash on hand — shuffle funds or adjust your plan.');
  }
  if ((recurring || []).length === 0) {
    nextActions.push('Add your recurring bills so Spendable stays honest.');
  }
  if (accountsList.length === 0) {
    nextActions.push('Add a bank account to unlock cash tracking & runway.');
  }

  const heroInsight =
    nextActions[0] || 'Everything looks calm — keep growing your money garden 🌱';
  const heroColors: [string, string] = isDark
    ? [withAlpha(accentPrimary, 0.45), withAlpha(accentSecondary, 0.65)]
    : [accentPrimary, accentSecondary];
  const heroText = isDark ? text : textOnPrimary;
  const heroMuted = withAlpha(heroText, isDark ? 0.68 : 0.78);
  const heroChipBg = withAlpha(heroText, isDark ? 0.16 : 0.22);

  const quickActions = [
    {
      key: 'accounts',
      label: 'Accounts',
      icon: 'wallet' as const,
      accent: accentPrimary,
      textColor: textOnPrimary,
      iconColorToken: 'text.onPrimary',
      onPress: () => setShowAccountsSheet(true),
    },
    {
      key: 'portfolio',
      label: 'Portfolio',
      icon: 'trending-up' as const,
      accent: accentSecondary,
      textColor: textOnPrimary,
      iconColorToken: 'text.onPrimary',
      onPress: () => setShowPortfolioSheet(true),
    },
    {
      key: 'debts',
      label: 'Debts',
      icon: 'target' as const,
      accent: warningColor,
      textColor: isDark ? textOnPrimary : text,
      iconColorToken: isDark ? 'text.onPrimary' : 'text.primary',
      onPress: () => setShowDebtsSheet(true),
    },
    {
      key: 'bills',
      label: 'Bills',
      icon: 'receipt' as const,
      accent: successColor,
      textColor: textOnPrimary,
      iconColorToken: 'text.onPrimary',
      onPress: () => nav.navigate('Bills'),
    },
  ];

  const portfolioChangeLabel =
    portfolioCalc.changeUSD === 0
      ? 'Today: flat'
      : `Today: ${
          portfolioCalc.changeUSD > 0
            ? '+' + formatCurrency(Math.abs(portfolioCalc.changeUSD))
            : formatCurrency(portfolioCalc.changeUSD)
        }`;

  return (
    <ScreenScroll
      inTab
      contentStyle={{
        paddingHorizontal: spacing.s16,
        paddingTop: spacing.s16,
        paddingBottom: spacing.s32,
        gap: spacing.s16,
      }}
    >
      <View style={{ gap: spacing.s16 }}>
        <Text style={{ color: text, fontSize: 28, fontWeight: '800' }}>Money</Text>

        <LinearGradient
          colors={heroColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.s16,
            paddingBottom: spacing.s24,
          }}
        >
          <Text style={{ color: heroMuted, fontWeight: '600', marginBottom: spacing.s4 }}>
            Money HQ
          </Text>
          <Text style={{ color: heroText, fontSize: 32, fontWeight: '800' }}>
            {formatCurrency(netWorth)}
          </Text>
          <Text style={{ color: heroMuted, marginTop: spacing.s6 }}>{heroInsight}</Text>
          <View
            style={{
              marginTop: spacing.s12,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.s8,
            }}
          >
            <View
              style={{
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: heroChipBg,
              }}
            >
              <Text style={{ color: heroText, fontWeight: '700' }}>
                Spendable {formatCurrency(spendable)}
              </Text>
            </View>
            <View
              style={{
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: heroChipBg,
              }}
            >
              <Text style={{ color: heroText, fontWeight: '700' }}>{runwayDays} day runway</Text>
            </View>
            <View
              style={{
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: heroChipBg,
              }}
            >
              <Text style={{ color: heroText, fontWeight: '700' }}>
                Bills {formatCurrency(upcoming.total)}
              </Text>
            </View>
            {portfolioCalc.totalUSD > 0 ? (
              <View
                style={{
                  paddingVertical: spacing.s6,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.pill,
                  backgroundColor: heroChipBg,
                }}
              >
                <Text style={{ color: heroText, fontWeight: '700' }}>
                  Portfolio {formatCurrency(portfolioCalc.totalUSD)}
                </Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <View style={{ gap: spacing.s8 }}>
          <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>Quick launches</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
            {quickActions.map(action => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                onPress={action.onPress}
                style={({ pressed }) => ({
                  width: '48%',
                  borderRadius: radius.lg,
                  backgroundColor: action.accent,
                  paddingVertical: spacing.s12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <Icon name={action.icon} size={26} colorToken={action.iconColorToken} />
                <Text
                  style={{
                    color: action.textColor,
                    fontWeight: '700',
                    marginTop: spacing.s6,
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>Summary</Text>
          <View style={{ gap: spacing.s12 }}>
            <Card
              style={{
                backgroundColor: withAlpha(accentSecondary, isDark ? 0.28 : 0.14),
              }}
            >
              <Text style={{ color: text, fontWeight: '700', marginBottom: spacing.s4 }}>
                Cash momentum
              </Text>
              <Text style={{ color: onSurface, fontSize: 22, fontWeight: '800' }}>
                {formatCurrency(totalCash)}
              </Text>
              <Text style={{ color: muted, marginTop: spacing.s4 }}>Across all accounts</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.s8,
                  marginTop: spacing.s12,
                }}
              >
                <View
                  style={{
                    paddingVertical: spacing.s6,
                    paddingHorizontal: spacing.s12,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(text, isDark ? 0.12 : 0.08),
                  }}
                >
                  <Text style={{ color: onSurface, fontWeight: '600' }}>
                    Spendable {formatCurrency(spendable)}
                  </Text>
                </View>
                <View
                  style={{
                    paddingVertical: spacing.s6,
                    paddingHorizontal: spacing.s12,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(text, isDark ? 0.12 : 0.08),
                  }}
                >
                  <Text style={{ color: onSurface, fontWeight: '600' }}>
                    {runwayDays} day runway
                  </Text>
                </View>
                <View
                  style={{
                    paddingVertical: spacing.s6,
                    paddingHorizontal: spacing.s12,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(text, isDark ? 0.12 : 0.08),
                  }}
                >
                  <Text style={{ color: onSurface, fontWeight: '600' }}>
                    Avg daily {formatCurrency(avgDaily)}
                  </Text>
                </View>
              </View>
              <Text style={{ color: muted, marginTop: spacing.s12 }}>
                {upcoming.total > 0
                  ? `You have ${formatCurrency(upcoming.total)} in bills arriving within 30 days.`
                  : 'No upcoming bills in the next 30 days — enjoy the breathing room!'}
              </Text>
              {excludedAccountCount > 0 ? (
                <Text style={{ color: muted, marginTop: spacing.s8 }}>
                  {excludedAccountCount} account{excludedAccountCount === 1 ? '' : 's'} hidden from totals.
                </Text>
              ) : null}
            </Card>

            <Card
              style={{
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.26 : 0.12),
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.s8,
                }}
              >
                <Text style={{ color: text, fontWeight: '700' }}>Portfolio pulse</Text>
                <Button
                  title="Open portfolio"
                  variant="secondary"
                  onPress={() => nav.navigate('Invest', { screen: 'InvestHome' })}
                  size="sm"
                />
              </View>
              <Text style={{ color: onSurface, fontSize: 22, fontWeight: '800' }}>
                {formatCurrency(portfolioCalc.totalUSD)}
              </Text>
              <Text style={{ color: muted, marginTop: spacing.s4 }}>{portfolioChangeLabel}</Text>
              {portfolioCalc.allocations.length > 0 ? (
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
                        borderWidth: 1,
                        borderColor: withAlpha(onSurface, 0.2),
                      }}
                    >
                      <Text style={{ color: onSurface, fontWeight: '600' }}>
                        {item.sym} {(item.wt * 100).toFixed(0)}%
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: muted, marginTop: spacing.s12 }}>
                  Add holdings to light up your portfolio snapshot.
                </Text>
              )}
            </Card>

            <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.s8,
                }}
              >
                <Text style={{ color: text, fontWeight: '700' }}>
                  Upcoming bills (30 days)
                </Text>
                <Button
                  title="Manage"
                  variant="ghost"
                  size="sm"
                  onPress={() => nav.navigate('Bills')}
                />
              </View>
              {upcoming.list.length === 0 ? (
                <Text style={{ color: muted }}>
                  No bills due soon. Schedule recurring bills to keep Spendable precise.
                </Text>
              ) : (
                <View style={{ gap: spacing.s8 }}>
                  {upcoming.list.slice(0, 4).map(item => (
                    <View
                      key={item.id}
                      style={{
                        paddingVertical: spacing.s8,
                        borderBottomWidth: 1,
                        borderBottomColor: withAlpha(border, 0.6),
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View>
                        <Text style={{ color: text, fontWeight: '600' }}>{item.label}</Text>
                        <Text style={{ color: muted }}>{item.due.toDateString()}</Text>
                      </View>
                      <Text style={{ color: onSurface, fontWeight: '600' }}>
                        {formatCurrency(item.amount)}
                      </Text>
                    </View>
                  ))}
                  {upcoming.list.length > 4 ? (
                    <Text style={{ color: muted }}>
                      +{upcoming.list.length - 4} more scheduled after these.
                    </Text>
                  ) : null}
                </View>
              )}
            </Card>

            <Card
              style={{
                backgroundColor: withAlpha(successColor, isDark ? 0.26 : 0.16),
              }}
            >
              <Text style={{ color: text, fontWeight: '700' }}>Action center</Text>
              <Text style={{ color: muted, marginTop: spacing.s4 }}>
                Pick one mini-win to keep the momentum going.
              </Text>
              <View style={{ marginTop: spacing.s12 }}>
                <Button
                  title="Plan a DCA"
                  variant="secondary"
                  onPress={() =>
                    nav.navigate('DCAPlanner', {
                      suggest: Math.max(0, Math.floor(spendable * 0.25)),
                    })
                  }
                />
              </View>
              <View style={{ marginTop: spacing.s12, gap: spacing.s8 }}>
                {nextActions.length === 0 ? (
                  <Text style={{ color: onSurface, fontWeight: '600' }}>
                    All caught up. Nice — keep it rolling 🎉
                  </Text>
                ) : (
                  nextActions.map((message, idx) => (
                    <View
                      key={idx}
                      style={{ flexDirection: 'row', gap: spacing.s8, alignItems: 'flex-start' }}
                    >
                      <Text style={{ color: onSurface, fontWeight: '700' }}>•</Text>
                      <Text style={{ color: onSurface, flex: 1 }}>{message}</Text>
                    </View>
                  ))
                )}
              </View>
            </Card>
          </View>
        </View>
      </View>

      <BottomSheet
        visible={showAccountsSheet}
        onClose={() => setShowAccountsSheet(false)}
        fullHeight
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.s16, gap: spacing.s12 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ color: text, fontSize: 20, fontWeight: '700' }}>Accounts overview</Text>
          <Text style={{ color: muted }}>
            Connected accounts, manual cash, and cards — all tracked in one vault.
          </Text>
          <Card
            style={{
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.26 : 0.12),
            }}
          >
            <Text style={{ color: text, fontWeight: '700' }}>Cash on hand</Text>
            <Text style={{ color: onSurface, fontSize: 22, fontWeight: '800', marginTop: spacing.s4 }}>
              {formatCurrency(totalCash)}
            </Text>
            <Text style={{ color: muted, marginTop: spacing.s8 }}>
              Average daily spend {formatCurrency(avgDaily)}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.s8,
                marginTop: spacing.s12,
              }}
            >
              <View
                style={{
                  paddingVertical: spacing.s6,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(text, isDark ? 0.12 : 0.08),
                }}
              >
                <Text style={{ color: onSurface, fontWeight: '600' }}>
                  Spendable {formatCurrency(spendable)}
                </Text>
              </View>
              <View
                style={{
                  paddingVertical: spacing.s6,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(text, isDark ? 0.12 : 0.08),
                }}
              >
                <Text style={{ color: onSurface, fontWeight: '600' }}>
                  {runwayDays} day runway
                </Text>
              </View>
              {upcoming.total > 0 ? (
                <View
                  style={{
                    paddingVertical: spacing.s6,
                    paddingHorizontal: spacing.s12,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(text, isDark ? 0.12 : 0.08),
                  }}
                >
                  <Text style={{ color: onSurface, fontWeight: '600' }}>
                    Bills {formatCurrency(upcoming.total)}
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>
          <Card style={{ backgroundColor: cardBg }}>
            <Text style={{ color: text, fontWeight: '700', marginBottom: spacing.s8 }}>
              Accounts
            </Text>
            {accountsList.length === 0 ? (
              <View style={{ gap: spacing.s12 }}>
                <Text style={{ color: muted }}>
                  Link a bank or add a manual account to see your balances together.
                </Text>
                <Button
                  title="Add account"
                  onPress={() => closeSheetThen(setShowAccountsSheet, () => nav.navigate('AddAccount'), { immediate: true })}
                />
              </View>
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
                        paddingVertical: spacing.s12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottomWidth: 1,
                        borderBottomColor: withAlpha(border, 0.5),
                        opacity: pressed ? 0.8 : excluded ? 0.7 : 1,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.s12,
                        }}
                      >
                        <Icon name="wallet" size={20} />
                        <View>
                          <Text style={{ color: text, fontWeight: '700' }}>{account.name}</Text>
                          <Text style={{ color: muted }}>
                            {account.institution ?? 'Manual'}
                            {account.mask ? ` • ${account.mask}` : ''}
                            {excluded ? ' • Excluded' : ''}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: onSurface, fontWeight: '600' }}>
                        {formatCurrency(account.balance)}
                      </Text>
                    </Pressable>
                  );
                })}
                <View style={{ marginTop: spacing.s12 }}>
                  <Button
                    title="Add account"
                    onPress={() => closeSheetThen(setShowAccountsSheet, () => nav.navigate('AddAccount'), { immediate: true })}
                  />
                </View>
              </View>
            )}
          </Card>
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={showPortfolioSheet}
        onClose={() => setShowPortfolioSheet(false)}
        fullHeight
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.s16, gap: spacing.s12 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ color: text, fontSize: 20, fontWeight: '700' }}>Portfolio snapshot</Text>
          <Text style={{ color: muted }}>
            Track your market moves and cash in one glance. Tap through to rebalance or add new
            holdings.
          </Text>
          <Card
            style={{
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.28 : 0.14),
            }}
          >
            <Text style={{ color: text, fontWeight: '700' }}>Portfolio value</Text>
            <Text style={{ color: onSurface, fontSize: 22, fontWeight: '800', marginTop: spacing.s4 }}>
              {formatCurrency(portfolioCalc.totalUSD)}
            </Text>
            <Text style={{ color: muted, marginTop: spacing.s6 }}>{portfolioChangeLabel}</Text>
            <Button
              title="Open portfolio"
              variant="secondary"
              onPress={() => {
                closeSheetThen(setShowPortfolioSheet, () => nav.navigate('Invest', { screen: 'InvestHome' }));
              }}
              style={{ marginTop: spacing.s12 }}
            />
            {portfolioCalc.allocations.length > 0 ? (
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
                      borderWidth: 1,
                      borderColor: withAlpha(onSurface, 0.2),
                    }}
                  >
                    <Text style={{ color: onSurface, fontWeight: '600' }}>
                      {item.sym} {(item.wt * 100).toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: muted, marginTop: spacing.s12 }}>
                Nothing invested yet — tap “Open portfolio” to add your first holding.
              </Text>
            )}
          </Card>
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={showDebtsSheet}
        onClose={() => setShowDebtsSheet(false)}
        fullHeight
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.s16, gap: spacing.s12 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ color: text, fontSize: 20, fontWeight: '700' }}>Debt control center</Text>
          <Text style={{ color: muted }}>
            Stay ahead of every due date and minimum payment to shrink balances faster.
          </Text>
          <Card
            style={{
              backgroundColor: withAlpha(warningColor, isDark ? 0.28 : 0.16),
            }}
          >
            <Text style={{ color: text, fontWeight: '700' }}>Overview</Text>
            <Text style={{ color: muted, marginTop: spacing.s4 }}>Total balance</Text>
            <Text style={{ color: onSurface, fontSize: 22, fontWeight: '800' }}>
              {formatCurrency(debtsList.reduce((s, d) => s + (d.balance || 0), 0))}
            </Text>
            <Text style={{ color: muted, marginTop: spacing.s8 }}>Minimum due (30d)</Text>
            <Text style={{ color: onSurface, fontSize: 20, fontWeight: '700' }}>
              {formatCurrency(debtDue.total)}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s12 }}>
              <Button
                title="Add debt"
                onPress={() => {
                  closeSheetThen(setShowDebtsSheet, () => nav.navigate('AddDebt'), { immediate: true });
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Simulate payoff"
                variant="secondary"
                onPress={() => {
                  closeSheetThen(setShowDebtsSheet, () => nav.navigate('PayoffSimulator'));
                }}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
          <Card style={{ backgroundColor: cardBg }}>
            {debtsList.length === 0 ? (
              <Text style={{ color: muted }}>
                No debts yet. Add your first debt to track due dates and payoff progress.
              </Text>
            ) : (
              <View style={{ gap: spacing.s10 }}>
                {debtsList.map(debt => {
                  const dueDate = debt.dueISO ? new Date(debt.dueISO) : null;
                  const dueLabel =
                    dueDate && !isNaN(dueDate.getTime())
                      ? dueDate.toDateString()
                      : 'No due date set';
                  return (
                    <Pressable
                      key={debt.id}
                    onPress={() => {
                      closeSheetThen(setShowDebtsSheet, () => nav.navigate('DebtDetail', { id: debt.id }));
                    }}
                      style={({ pressed }) => ({
                        paddingVertical: spacing.s12,
                        borderBottomWidth: 1,
                        borderBottomColor: withAlpha(border, 0.5),
                        opacity: pressed ? 0.86 : 1,
                      })}
                    >
                      <Text style={{ color: text, fontWeight: '700' }}>{debt.name}</Text>
                      <Text style={{ color: muted, marginTop: spacing.s4 }}>
                        {debt.type?.toUpperCase() || 'DEBT'} • APR {debt.apr ?? 0}% • Due {dueLabel}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginTop: spacing.s8,
                        }}
                      >
                        <Text style={{ color: muted }}>Balance</Text>
                        <Text style={{ color: onSurface, fontWeight: '600' }}>
                          {formatCurrency(debt.balance)}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginTop: spacing.s4,
                        }}
                      >
                        <Text style={{ color: muted }}>Min due</Text>
                        <Text style={{ color: onSurface, fontWeight: '600' }}>
                          {formatCurrency(debt.minDue)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>
        </ScrollView>
      </BottomSheet>
    </ScreenScroll>
  );
};

export default Money;
