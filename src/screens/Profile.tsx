import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useProfileStore } from '../store/profile';
import { useTxStore } from '../store/transactions';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Button from '../components/Button';
import { Card } from '../components/Card';
import { Feather } from '@expo/vector-icons';
import { formatCurrency } from '../lib/format';
import { useAccountsStore } from '../store/accounts';
import { useRecurringStore, computeNextDue, type Recurring } from '../store/recurring';
import { useDebtsStore } from '../store/debts';
import { useInvestStore } from '../store/invest';

const DAY_MS = 24 * 60 * 60 * 1000;

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB | null {
  const normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return { r, g, b };
  }
  if (normalized.length === 6 || normalized.length === 8) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function rgbaToRgb(input: string): RGB | null {
  const match = input.match(/rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (!match) return null;
  const r = Math.min(255, parseInt(match[1], 10));
  const g = Math.min(255, parseInt(match[2], 10));
  const b = Math.min(255, parseInt(match[3], 10));
  return { r, g, b };
}

function toRgb(color: string): RGB | null {
  if (!color) return null;
  if (color.startsWith('#')) return hexToRgb(color);
  if (color.startsWith('rgb')) return rgbaToRgb(color);
  return null;
}

function mixColor(color: string, base: string, weight: number): string {
  const a = toRgb(color);
  const b = toRgb(base);
  if (!a || !b) return color;
  const w = Math.min(Math.max(weight, 0), 1);
  const r = Math.round(a.r * w + b.r * (1 - w));
  const g = Math.round(a.g * w + b.g * (1 - w));
  const bCh = Math.round(a.b * w + b.b * (1 - w));
  return `rgb(${r},${g},${bCh})`;
}

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

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type Highlight = { key: string; label: string; value: string; hint?: string };
type HeroChip = { label: string; value: string };

const ProfileAvatar: React.FC<{ uri?: string; initials: string; size: number; backgroundColor: string; textColor: string }> = ({
  uri,
  initials,
  size,
  backgroundColor,
  textColor
}) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
      backgroundColor,
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    {uri ? (
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    ) : (
      <Text style={{ color: textColor, fontSize: size / 2, fontWeight: '700' }}>{initials}</Text>
    )}
  </View>
);

type HeroVariantProps = {
  name: string;
  handle?: string;
  email: string;
  avatarUri?: string;
  initials: string;
  chips: HeroChip[];
  highlights: Highlight[];
  accentPrimary: string;
  accentSecondary: string;
  background: string;
  surfaceAlt: string;
  onEdit: () => void;
  heroTextOnPrimary: string;
};

const HeroVariantBanner: React.FC<HeroVariantProps> = ({
  name,
  handle,
  email,
  avatarUri,
  initials,
  chips,
  highlights,
  accentPrimary,
  accentSecondary,
  background,
  surfaceAlt,
  onEdit,
  heroTextOnPrimary
}) => {
  const backgroundDepth = mixColor(background, '#05070f', 0.7);
  const gradientStart = mixColor(backgroundDepth, accentSecondary, 0.45);
  const gradientEnd = mixColor(backgroundDepth, accentPrimary, 0.55);
  const overlay = 'rgba(5,7,15,0.58)';
  const mutedOnOverlay = 'rgba(239,242,255,0.78)';
  return (
    <LinearGradient
      colors={[gradientStart, gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: radius.xl,
        overflow: 'hidden',
        marginHorizontal: -spacing.s16,
        paddingHorizontal: spacing.s16,
        paddingVertical: spacing.s16
      }}
    >
      <View
        style={{
          backgroundColor: overlay,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12
        }}
      >
        <View style={{ flexDirection: 'row', gap: spacing.s12, alignItems: 'center' }}>
          <ProfileAvatar
            uri={avatarUri}
            initials={initials}
            size={88}
            backgroundColor={mixColor(accentPrimary, surfaceAlt, 0.18)}
            textColor={heroTextOnPrimary}
          />
          <View style={{ flex: 1, gap: spacing.s4 }}>
            <Text style={{ color: heroTextOnPrimary, fontSize: 24, fontWeight: '800' }}>{name}</Text>
            {handle ? <Text style={{ color: mutedOnOverlay }}>{handle.startsWith('@') ? handle : `@${handle}`}</Text> : null}
            <Text style={{ color: mutedOnOverlay }}>{email}</Text>
          </View>
          <Button
            size="sm"
            variant="secondary"
            onPress={onEdit}
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0 }}
          >
            Edit profile
          </Button>
        </View>
        {chips.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s6 }}>
            {chips.map((chip) => (
              <View
                key={chip.label}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  paddingVertical: spacing.s4,
                  paddingHorizontal: spacing.s8,
                  borderRadius: radius.pill
                }}
              >
                <Text style={{ color: heroTextOnPrimary, fontSize: 12, fontWeight: '600' }}>
                  {chip.label}: {chip.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
          {highlights.map((item) => (
            <View
              key={item.key}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                backgroundColor: 'rgba(255,255,255,0.12)',
                paddingVertical: spacing.s10,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.lg
              }}
            >
              <Text style={{ color: mutedOnOverlay, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {item.label}
              </Text>
              <Text style={{ color: heroTextOnPrimary, fontWeight: '700', fontSize: 16, marginTop: spacing.s4 }}>
                {item.value}
              </Text>
              {item.hint ? (
                <Text style={{ color: mutedOnOverlay, fontSize: 12, marginTop: spacing.s4 }}>{item.hint}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
};


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

  const heroAccentPrimary = get('accent.primary') as string;
  const heroAccentSecondary = get('accent.secondary') as string;
  const heroSurfaceAlt = get('surface.level2') as string;
  const heroOnPrimary = get('text.onPrimary') as string;
  const backgroundDefault = get('background.default') as string;
  const muted = get('text.muted') as string;
  const primaryText = get('text.primary') as string;

  const avatarInitials = useMemo(() => {
    const name = profile?.name?.trim();
    if (!name) return '👤';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '👤';
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [profile?.name]);

  const memberSince = useMemo(() => {
    try {
      return new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  }, [profile.createdAt]);

  const lastUpdated = useMemo(() => {
    try {
      return new Date(profile.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  }, [profile.updatedAt]);

  const heroChips = useMemo<HeroChip[]>(() => ([
    { label: 'Tier', value: profile.tier ?? 'Starter' },
    { label: 'Member since', value: memberSince },
    { label: 'Language', value: profile.language ?? 'en' },
  ]), [memberSince, profile.language, profile.tier]);

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
    return (accounts || []).reduce((sum, account) => sum + (account.balance || 0), 0);
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

  const heroHighlights = useMemo<Highlight[]>(() => {
    const formatValue = (value?: number) => {
      if (value == null || !Number.isFinite(value)) return '—';
      return formatCurrency(value, userCurrency);
    };
    const upcomingHint = upcomingTotal > 0 ? `${formatValue(upcomingTotal)} in upcoming bills` : 'All bills covered';
    const debtHint = totalDebtBalance > 0 ? `${formatValue(totalDebtBalance)} in liabilities` : 'No debts yet';
    const portfolioHint = Math.abs(portfolioSnapshot.changeUSD) >= 1
      ? `${portfolioSnapshot.changeUSD >= 0 ? '+' : '-'}${formatValue(Math.abs(portfolioSnapshot.changeUSD))} today`
      : 'Holding steady';
    const runwayHint = avgDaily30 > 0 ? `${formatValue(avgDaily30)} daily burn` : 'Need 30 days of activity';
    return [
      { key: 'netWorth', label: 'Net worth', value: formatValue(netWorth), hint: debtHint },
      { key: 'spendable', label: 'Spendable (30d)', value: formatValue(spendable), hint: upcomingHint },
      { key: 'portfolio', label: 'Portfolio', value: formatValue(portfolioSnapshot.totalUSD), hint: portfolioHint },
      { key: 'runway', label: 'Runway', value: runwayDays > 0 ? `${runwayDays} day${runwayDays === 1 ? '' : 's'}` : 'Add recent spending', hint: runwayHint },
    ];
  }, [avgDaily30, netWorth, portfolioSnapshot, runwayDays, spendable, totalDebtBalance, upcomingTotal, userCurrency]);

  const heroBaseProps: HeroVariantProps = {
    name: profile.name || 'Add your name',
    handle: profile.handle,
    email: profile.email || 'Add your email',
    avatarUri: profile.avatarUri,
    initials: avatarInitials,
    chips: heroChips,
    highlights: heroHighlights,
    accentPrimary: heroAccentPrimary,
    accentSecondary: heroAccentSecondary,
    background: backgroundDefault,
    surfaceAlt: heroSurfaceAlt,
    onEdit: () => navigation.navigate('ProfileEdit'),
    heroTextOnPrimary: heroOnPrimary
  };

  const formatAmount = (value?: number) => {
    if (value == null || Number.isNaN(value)) return 'Add details';
    const amount = Math.max(0, value);
    const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: amount < 100 ? 2 : 0 });
    return `${profile.currency || ''} ${formatted}`.trim();
  };

  const stats = [
    {
      label: 'Spent this month',
      value: formatAmount(mtd),
      icon: 'activity' as FeatherName,
      hint: activeDays ? `${activeDays} logged day${activeDays === 1 ? '' : 's'}` : 'Log an expense to get started'
    },
    {
      label: 'Average per day',
      value: activeDays ? formatAmount(avgPerDay) : '—',
      icon: 'calendar' as FeatherName,
      hint: activeDays ? 'Across your active days' : 'We need more entries'
    },
    {
      label: 'Budget remaining',
      value: budgetLeft != null ? formatAmount(budgetLeft) : 'Set a budget target',
      icon: 'target' as FeatherName,
      hint: profile.monthlyBudget ? `Goal ${formatAmount(profile.monthlyBudget)}` : 'Add a monthly budget'
    },
    {
      label: 'Savings goal',
      value: profile.monthlySavingsGoal != null ? formatAmount(profile.monthlySavingsGoal) : 'Add a savings goal',
      icon: 'pie-chart' as FeatherName,
      hint: profile.monthlySavingsGoal && profile.monthlyBudget
        ? `${Math.round((profile.monthlySavingsGoal / profile.monthlyBudget) * 100)}% of budget`
        : 'Set a target to stay motivated'
    }
  ];

  const financialRows: { icon: FeatherName; label: string; value: string }[] = [
    { icon: 'dollar-sign', label: 'Primary currency', value: profile.currency || 'Add a currency' },
    { icon: 'calendar', label: 'Budget cycle day', value: profile.budgetCycleDay ? `Day ${profile.budgetCycleDay}` : 'Pick a day' },
    { icon: 'trending-up', label: 'Monthly budget', value: profile.monthlyBudget != null ? formatAmount(profile.monthlyBudget) : 'Not set' },
    { icon: 'shield', label: 'Savings goal', value: profile.monthlySavingsGoal != null ? formatAmount(profile.monthlySavingsGoal) : 'Not set' },
  ];

  const preferenceRows: { icon: FeatherName; label: string; value: string }[] = [
    { icon: 'moon', label: 'Theme mode', value: profile.themeMode },
    { icon: 'globe', label: 'Language', value: profile.language ?? 'en' },
    { icon: 'bell', label: 'Budget alerts', value: profile.alerts?.budgetWarnings ? 'On' : 'Off' },
  ];

  const dataRows: { icon: FeatherName; label: string; value: string }[] = [
    { icon: 'bar-chart-2', label: 'Analytics opt-in', value: profile.analyticsOptIn ? 'Sharing insights' : 'Private' },
    { icon: 'clock', label: 'Last updated', value: lastUpdated },
    { icon: 'hash', label: 'Profile ID', value: profile.id },
  ];

  return (
    <ScreenScroll contentStyle={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: spacing.s12 }}>
        <View style={{ flex: 1, paddingRight: spacing.s12 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: primaryText }}>Profile</Text>
          <Text style={{ color: muted, marginTop: spacing.s4 }}>Personalise FinGrow across every workspace.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close profile"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: spacing.s6 })}
        >
          <Feather name="x" size={22} color={muted} />
        </Pressable>
      </View>

      <View style={{ marginTop: spacing.s16 }}>
        <Text
          style={{
            color: muted,
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: spacing.s8
          }}
        >
          Hero preview
        </Text>
        <HeroVariantBanner {...heroBaseProps} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12, marginTop: spacing.s16 }}>
        {stats.map((stat) => (
          <Card key={stat.label} padding={spacing.s16} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: get('surface.level2') as string, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={stat.icon} size={18} color={get('accent.primary') as string} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>{stat.label}</Text>
                <Text style={{ color: primaryText, fontWeight: '700', marginTop: spacing.s4 }}>{stat.value}</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s4 }}>{stat.hint}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <Card style={{ marginTop: spacing.s16 }}>
        <View style={{ gap: spacing.s12 }}>
          <View>
            <Text style={{ color: primaryText, fontWeight: '700', fontSize: 18 }}>Financial setup</Text>
            <Text style={{ color: muted, marginTop: spacing.s4 }}>These settings power budgets, goals and currency formatting.</Text>
          </View>
          {financialRows.map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.s8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: get('surface.level2') as string, alignItems: 'center', justifyContent: 'center', marginRight: spacing.s12 }}>
                <Feather name={row.icon} size={18} color={get('accent.primary') as string} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: primaryText, fontWeight: '600' }}>{row.label}</Text>
                <Text style={{ color: muted }}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.s16 }}>
        <View style={{ gap: spacing.s12 }}>
          <View>
            <Text style={{ color: primaryText, fontWeight: '700', fontSize: 18 }}>App preferences</Text>
            <Text style={{ color: muted, marginTop: spacing.s4 }}>Control how FinGrow looks and feels across devices.</Text>
          </View>
          {preferenceRows.map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.s8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: get('surface.level2') as string, alignItems: 'center', justifyContent: 'center', marginRight: spacing.s12 }}>
                <Feather name={row.icon} size={18} color={get('accent.secondary') as string} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: primaryText, fontWeight: '600' }}>{row.label}</Text>
                <Text style={{ color: muted }}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.s16 }}>
        <View style={{ gap: spacing.s12 }}>
          <View>
            <Text style={{ color: primaryText, fontWeight: '700', fontSize: 18 }}>Data & activity</Text>
            <Text style={{ color: muted, marginTop: spacing.s4 }}>Keep tabs on how your profile powers insights.</Text>
          </View>
          {dataRows.map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.s8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: get('surface.level2') as string, alignItems: 'center', justifyContent: 'center', marginRight: spacing.s12 }}>
                <Feather name={row.icon} size={18} color={get('text.primary') as string} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: primaryText, fontWeight: '600' }}>{row.label}</Text>
                <Text style={{ color: muted }}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </ScreenScroll>
  );
};

export default Profile;
