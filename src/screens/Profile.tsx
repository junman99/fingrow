import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useProfileStore } from '../store/profile';
import { useTxStore } from '../store/transactions';
import { useNavigation } from '@react-navigation/native';
import Icon from '../components/Icon';
import { formatCurrency } from '../lib/format';
import { useAccountsStore } from '../store/accounts';
import { useRecurringStore, computeNextDue, type Recurring } from '../store/recurring';
import { useDebtsStore } from '../store/debts';
import { useInvestStore } from '../store/invest';

const DAY_MS = 24 * 60 * 60 * 1000;

function sumUpcomingAmount(items: Recurring[] | undefined, withinDays: number): number {
  if (!items || !items.length) return 0;
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * DAY_MS);
  return items.reduce((total, item) => {
    const due = computeNextDue(item, now);
    if (!due) return total;
    if (due <= cutoff) return total + Number(item.amount || 0);
    return total;
  }, 0);
}


const Profile: React.FC = () => {
  const { get } = useThemeTokens();
  const navigation = useNavigation<any>();
  const { profile, hydrate } = useProfileStore();
  const { transactions, hydrate: hydrateTx } = useTxStore();
  const { accounts, hydrate: hydrateAccounts } = useAccountsStore();
  const { items: recurring, hydrate: hydrateRecurring } = useRecurringStore();
  const { items: debts, hydrate: hydrateDebts } = useDebtsStore();
  const { holdings, quotes, hydrate: hydrateInvest } = useInvestStore();

  useEffect(() => {
    hydrate();
    hydrateTx();
    hydrateAccounts();
    hydrateRecurring();
    hydrateDebts();
    hydrateInvest();
  }, [hydrate, hydrateAccounts, hydrateDebts, hydrateInvest, hydrateRecurring, hydrateTx]);

  const accentPrimary = get('accent.primary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const muted = get('text.muted') as string;
  const primaryText = get('text.primary') as string;
  const borderSubtle = get('border.subtle') as string;

  const avatarInitials = useMemo(() => {
    const name = profile?.name?.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [profile?.name]);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  let mtd = 0; const daysLogged = new Set<number>();
  transactions.forEach(t => {
    const d = new Date(t.date);
    if (t.type === 'expense' && d >= start) {
      mtd += Math.abs(t.amount);
      daysLogged.add(d.getDate());
    }
  });
  const activeDays = daysLogged.size;
  const avgPerDay = activeDays ? (mtd / activeDays) : 0;
  const budgetLeft = profile.monthlyBudget != null ? profile.monthlyBudget - mtd : undefined;
  const userCurrency = (profile?.currency || 'USD').toUpperCase();

  const totalCash = useMemo(() => {
    return (accounts || [])
      .filter(account => account.includeInNetWorth !== false)
      .reduce((sum, account) => sum + (account.balance || 0), 0);
  }, [accounts]);

  const upcomingTotal = useMemo(() => sumUpcomingAmount(recurring, 30), [recurring]);

  const debtDueTotal = useMemo(() => {
    if (!debts || !debts.length) return 0;
    const nowLocal = new Date();
    const cutoff = new Date(nowLocal.getTime() + 30 * DAY_MS);
    return debts.reduce((total, debt) => {
      const due = new Date(debt.dueISO);
      if (!isNaN(due.getTime()) && due <= cutoff) {
        return total + Number(debt.minDue || 0);
      }
      return total;
    }, 0);
  }, [debts]);

  const totalDebtBalance = useMemo(() => {
    return (debts || []).reduce((sum, debt) => sum + (debt.balance || 0), 0);
  }, [debts]);

  const avgDaily30 = useMemo(() => {
    if (!transactions || !transactions.length) return 0;
    const nowLocal = new Date();
    const cutoff = new Date(nowLocal.getTime() - 30 * DAY_MS);
    const spent = transactions
      .filter(t => t.type === 'expense' && new Date(t.date) >= cutoff)
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);
    return spent / 30;
  }, [transactions]);

  const runwayDays = avgDaily30 > 0 ? Math.floor(totalCash / avgDaily30) : 0;

  const portfolioSnapshot = useMemo(() => {
    const symbols = Object.keys(holdings || {});
    let totalUSD = 0;
    let changeUSD = 0;
    symbols.forEach(sym => {
      const price = quotes[sym]?.last || 0;
      const change = quotes[sym]?.change || 0;
      const qty = (holdings[sym]?.lots || []).reduce((acc, lot) => acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
      totalUSD += price * qty;
      changeUSD += change * qty;
    });
    try {
      const activePortfolio = useInvestStore.getState().activePortfolio?.();
      if (activePortfolio && typeof activePortfolio.cash === 'number') {
        totalUSD += Number(activePortfolio.cash || 0);
      }
    } catch {}
    return { totalUSD, changeUSD };
  }, [holdings, quotes]);

  const spendable = useMemo(() => Math.max(0, totalCash - upcomingTotal - debtDueTotal), [totalCash, upcomingTotal, debtDueTotal]);

  const netWorth = useMemo(
    () => totalCash + portfolioSnapshot.totalUSD - totalDebtBalance,
    [portfolioSnapshot.totalUSD, totalCash, totalDebtBalance]
  );


  const menuItems = [
    { key: 'budget', icon: 'dollar-sign' as const, label: 'Budget Settings', value: profile.monthlyBudget ? formatCurrency(profile.monthlyBudget, profile.currency || 'USD') : 'Not set', onPress: () => navigation.navigate('ProfileEdit') },
    { key: 'currency', icon: 'globe' as const, label: 'Currency', value: profile.currency || 'USD' },
    { key: 'theme', icon: 'moon' as const, label: 'Theme', value: profile.themeMode === 'dark' ? 'Dark' : 'Light' },
  ];

  return (
    <ScreenScroll contentStyle={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s24 }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: primaryText, letterSpacing: -0.5 }}>
          Profile
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Icon name="x" size={24} color={muted} />
        </Pressable>
      </View>

      {/* Profile Card */}
      <View
        style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          paddingTop: spacing.s24,
          paddingBottom: spacing.s20,
          paddingHorizontal: spacing.s20,
          marginBottom: spacing.s16,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            overflow: 'hidden',
            backgroundColor: accentPrimary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.s16,
          }}
        >
          {profile?.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={{ width: 96, height: 96 }} />
          ) : (
            <Text style={{ color: textOnPrimary, fontWeight: '800', fontSize: 38 }}>
              {avatarInitials}
            </Text>
          )}
        </View>
        <Text style={{ color: primaryText, fontSize: 24, fontWeight: '800', marginBottom: spacing.s4 }}>
          {profile.name || 'Add your name'}
        </Text>
        <Text style={{ color: muted, fontSize: 14, marginBottom: spacing.s16 }}>
          {profile.email || 'Add your email'}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('ProfileEdit')}
          style={({ pressed }) => ({
            backgroundColor: accentPrimary,
            paddingHorizontal: spacing.s20,
            paddingVertical: spacing.s12,
            borderRadius: radius.pill,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: textOnPrimary, fontWeight: '700', fontSize: 14 }}>
            Edit Profile
          </Text>
        </Pressable>
      </View>

      {/* Financial Overview */}
      <View style={{ marginBottom: spacing.s16 }}>
        <Text style={{ color: primaryText, fontWeight: '700', fontSize: 18, marginBottom: spacing.s12 }}>
          Overview
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
          <View style={{ flex: 1, backgroundColor: surface1, borderRadius: radius.lg, padding: spacing.s16 }}>
            <Text style={{ color: muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' }}>
              Net Worth
            </Text>
            <Text style={{ color: primaryText, fontSize: 22, fontWeight: '800', marginTop: spacing.s6 }}>
              {formatCurrency(netWorth, profile.currency || 'USD')}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: surface1, borderRadius: radius.lg, padding: spacing.s16 }}>
            <Text style={{ color: muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' }}>
              Spendable
            </Text>
            <Text style={{ color: primaryText, fontSize: 22, fontWeight: '800', marginTop: spacing.s6 }}>
              {formatCurrency(spendable, profile.currency || 'USD')}
            </Text>
          </View>
        </View>
      </View>

      {/* This Month Stats */}
      <View style={{ marginBottom: spacing.s16 }}>
        <Text style={{ color: primaryText, fontWeight: '700', fontSize: 18, marginBottom: spacing.s12 }}>
          This Month
        </Text>
        <View style={{ backgroundColor: surface1, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s16 }}>
          <View>
            <Text style={{ color: muted, fontSize: 12 }}>Total Spent</Text>
            <Text style={{ color: primaryText, fontSize: 20, fontWeight: '700', marginTop: spacing.s4 }}>
              {formatCurrency(mtd, profile.currency || 'USD')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, fontSize: 12 }}>Avg/Day</Text>
              <Text style={{ color: primaryText, fontSize: 16, fontWeight: '700', marginTop: spacing.s4 }}>
                {activeDays ? formatCurrency(avgPerDay, profile.currency || 'USD') : '—'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, fontSize: 12 }}>Active Days</Text>
              <Text style={{ color: primaryText, fontSize: 16, fontWeight: '700', marginTop: spacing.s4 }}>
                {activeDays}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Settings Menu */}
      <View style={{ marginBottom: spacing.s16 }}>
        <Text style={{ color: primaryText, fontWeight: '700', fontSize: 18, marginBottom: spacing.s12 }}>
          Settings
        </Text>
        <View style={{ backgroundColor: surface1, borderRadius: radius.lg, overflow: 'hidden' }}>
          {menuItems.map((item, index) => (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              disabled={!item.onPress}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.s16,
                backgroundColor: pressed ? surface2 : 'transparent',
                borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
                borderBottomColor: borderSubtle,
              })}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.s12,
                }}
              >
                <Icon name={item.icon} size={20} color={accentPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: primaryText, fontWeight: '600', fontSize: 15 }}>
                  {item.label}
                </Text>
                {item.value && (
                  <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s2 }}>
                    {item.value}
                  </Text>
                )}
              </View>
              {item.onPress && <Icon name="chevron-right" size={20} color={muted} />}
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenScroll>
  );
};

export default Profile;
