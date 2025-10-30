import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, withRepeat, Easing, FadeIn, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { Card } from '../components/Card';
import Button from '../components/Button';
import Icon from '../components/Icon';
import BottomSheet from '../components/BottomSheet';
import LineChart from '../components/LineChart';
import { StackedAreaChart } from '../components/StackedAreaChart';
import { CompoundBarChart } from '../components/CompoundBarChart';
import { BarLineComboChart } from '../components/BarLineComboChart';
import { SegmentedControl } from '../components/SegmentedControl';
import { WealthJourneySheet } from '../components/WealthJourneySheet';
import { useAccountsStore } from '../store/accounts';
import { useInvestStore } from '../store/invest';
import { formatCurrency } from '../lib/format';
import { useNavigation } from '@react-navigation/native';
import { useRecurringStore, computeNextDue, Recurring } from '../store/recurring';
import { usePlansStore } from '../store/plans';
import { useDebtsStore } from '../store/debts';
import { useTxStore } from '../store/transactions';
import { useIncomeSplittingStore } from '../store/incomeSplitting';
import { calculateHistoricalNetWorth, aggregateNetWorthData } from '../lib/netWorthHistory';

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

// Milestone definitions with icons and motivational messages
type Milestone = {
  threshold: number;
  label: string;
  icon: 'target' | 'star' | 'award' | 'trophy' | 'zap' | 'trending-up';
  message: string;
  color: string;
};

const MILESTONES: Milestone[] = [
  { threshold: 1000, label: 'First 1K', icon: 'target', message: 'Great start! Every journey begins with a single step.', color: '#3B82F6' },
  { threshold: 5000, label: 'Five Grand', icon: 'star', message: 'Building momentum! Keep it up!', color: '#8B5CF6' },
  { threshold: 10000, label: 'Five Figures', icon: 'award', message: 'You\'re crushing it! 10K achieved!', color: '#F59E0B' },
  { threshold: 25000, label: 'Quarter Million Path', icon: 'zap', message: 'On fire! 25% to 100K!', color: '#EC4899' },
  { threshold: 50000, label: 'Halfway to 100K', icon: 'trending-up', message: 'Halfway there! The momentum is real!', color: '#10B981' },
  { threshold: 100000, label: 'Six Figures', icon: 'trophy', message: 'LEGENDARY! 100K club member!', color: '#EF4444' },
  { threshold: 250000, label: 'Quarter Million', icon: 'trophy', message: 'Elite status! Quarter million achieved!', color: '#DC2626' },
  { threshold: 500000, label: 'Half Million', icon: 'trophy', message: 'Exceptional! You\'re in rare territory!', color: '#991B1B' },
  { threshold: 1000000, label: 'Millionaire', icon: 'trophy', message: 'MILLIONAIRE! You made it to the top!', color: '#FFD700' },
];

function getMilestoneProgress(netWorth: number): {
  current: Milestone | null;
  next: Milestone | null;
  progress: number;
  recentlyAchieved: Milestone | null;
} {
  let current: Milestone | null = null;
  let next: Milestone | null = null;

  for (let i = 0; i < MILESTONES.length; i++) {
    if (netWorth >= MILESTONES[i].threshold) {
      current = MILESTONES[i];
    } else {
      next = MILESTONES[i];
      break;
    }
  }

  const prevThreshold = current?.threshold || 0;
  const nextThreshold = next?.threshold || (current?.threshold || 0) * 2;
  const progress = ((netWorth - prevThreshold) / (nextThreshold - prevThreshold)) * 100;

  return { current, next, progress: Math.min(100, Math.max(0, progress)), recentlyAchieved: current };
}

function getMotivationalMessage(netWorth: number, change: number): { message: string; emoji: string } {
  if (change > 1000) {
    return { message: 'Crushing it! Big gains today!', emoji: '🚀' };
  } else if (change > 100) {
    return { message: 'Nice work! Keep building!', emoji: '💪' };
  } else if (change > 0) {
    return { message: 'Every step counts!', emoji: '⭐' };
  } else if (change < -1000) {
    return { message: 'Stay strong. Markets fluctuate.', emoji: '🛡️' };
  } else if (change < -100) {
    return { message: 'Keep the long-term view.', emoji: '🎯' };
  } else if (change < 0) {
    return { message: 'Small dips are normal.', emoji: '📊' };
  } else {
    return { message: 'Steady progress wins!', emoji: '🏆' };
  }
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

type MetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: 'wallet' | 'trending-up' | 'receipt' | 'target' | 'dollar-sign';
  bgColor: string;
  onPress: () => void;
  badge?: { text: string; variant: 'neutral' | 'warning' | 'success' };
};

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, bgColor, onPress, badge }) => {
  const { get, isDark } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
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
      style={{
        flex: 1,
        minWidth: '48%',
      }}
    >
      <Animated.View
        style={[
          {
            backgroundColor: bgColor,
            borderRadius: radius.lg,
            padding: spacing.s16,
          },
          animatedStyle,
        ]}
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
      </Animated.View>
    </Pressable>
  );
};

const ChartBar: React.FC<{
  height: number;
  maxHeight: number;
  color: string;
  isSelected: boolean;
  onPress: () => void;
  delay: number;
}> = ({ height, maxHeight, color, isSelected, onPress, delay }) => {
  const scale = useSharedValue(1);
  const animatedHeight = useSharedValue(0);

  React.useEffect(() => {
    animatedHeight.value = withTiming(height, { duration: 600 }, () => {});
  }, [height]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(1.05, { damping: 12, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      }}
      style={{
        flex: 1,
        height: maxHeight,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 2,
      }}
    >
      <Animated.View
        entering={FadeIn.delay(delay)}
        style={[
          {
            width: '100%',
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            overflow: 'hidden',
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={[color, withAlpha(color, 0.6)]}
          style={{
            flex: 1,
            borderWidth: isSelected ? 2 : 0,
            borderColor: 'white',
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
          }}
        />
      </Animated.View>
    </Pressable>
  );
};

const Money: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const [showAccountsSheet, setShowAccountsSheet] = useState(false);
  const [showPortfolioSheet, setShowPortfolioSheet] = useState(false);
  const [showDebtsSheet, setShowDebtsSheet] = useState(false);
  const [showWealthJourney, setShowWealthJourney] = useState(false);
  const { accounts, hydrate: hydrateAcc } = useAccountsStore();
  const { holdings, quotes, hydrate: hydrateInvest } = useInvestStore();
  const { items: recurring, hydrate: hydrateRecur } = useRecurringStore();
  const { hydrate: hydratePlan } = usePlansStore();
  const { transactions, hydrate: hydrateTx } = useTxStore();
  const { items: debts, hydrate: hydrateDebts } = useDebtsStore();
  const { config: paycheckConfig, splitHistory, hydrate: hydratePaycheck } = useIncomeSplittingStore();
  const sheetTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const sheetRafs = useRef<number[]>([]);

  useEffect(() => {
    hydrateAcc();
    hydrateInvest();
    hydrateRecur();
    hydrateTx();
    hydratePlan();
    hydrateDebts();
    hydratePaycheck();
  }, [hydrateAcc, hydrateInvest, hydrateRecur, hydrateTx, hydratePlan, hydrateDebts, hydratePaycheck]);

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

  // Separate credit cards from regular accounts
  const cashAccounts = useMemo(
    () => accountsList.filter(acc => acc.kind !== 'credit' && acc.kind !== 'investment' && acc.kind !== 'retirement' && acc.includeInNetWorth !== false),
    [accountsList]
  );

  const investmentAccounts = useMemo(
    () => accountsList.filter(acc => (acc.kind === 'investment' || acc.kind === 'retirement') && acc.includeInNetWorth !== false),
    [accountsList]
  );

  const creditCards = useMemo(
    () => accountsList.filter(acc => acc.kind === 'credit' && acc.includeInNetWorth !== false),
    [accountsList]
  );

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

  const totalCash = cashAccounts.reduce((s, a) => s + (a.balance || 0), 0);
  const runwayDays = avgDaily > 0 ? Math.floor(totalCash / avgDaily) : 0;
  const totalCreditCardDebt = creditCards.reduce((s, a) => s + Math.abs(a.balance || 0), 0);

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

    // Add investment and retirement account balances
    const investmentAccountBalance = investmentAccounts.reduce((s, a) => s + (a.balance || 0), 0);

    const totalUSD = rows.reduce((acc, row) => acc + row.value, 0) + cash + investmentAccountBalance;
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
  }, [holdings, quotes, investmentAccounts]);

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
  const totalDebt = debtsList.reduce((s, d) => s + (d.balance || 0), 0) + totalCreditCardDebt;

  const netWorth = totalCash + portfolioCalc.totalUSD - totalDebt;

  // Calculate real historical net worth data from transactions
  const netWorthHistoryData = useMemo(() => {
    return calculateHistoricalNetWorth(
      accountsList,
      transactions || [],
      portfolioCalc.totalUSD,
      180 // Last 180 days
    );
  }, [accountsList, transactions, portfolioCalc.totalUSD]);

  const [netWorthTimeframe, setNetWorthTimeframe] = useState<'1W'|'1M'|'3M'|'6M'|'1Y'|'ALL'>('3M');
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  // Aggregate chart data based on timeframe
  const aggregatedChartData = useMemo(() => {
    return aggregateNetWorthData(netWorthHistoryData, netWorthTimeframe);
  }, [netWorthHistoryData, netWorthTimeframe]);

  // Calculate net worth change
  const netWorthChange = useMemo(() => {
    if (aggregatedChartData.length < 2) return 0;
    const first = aggregatedChartData[0];
    const last = aggregatedChartData[aggregatedChartData.length - 1];
    const firstNW = first.cash + first.investments - first.debt;
    const lastNW = last.cash + last.investments - last.debt;
    return lastNW - firstNW;
  }, [aggregatedChartData]);

  const netWorthChangePercent = useMemo(() => {
    if (aggregatedChartData.length < 2) return 0;
    const first = aggregatedChartData[0];
    const last = aggregatedChartData[aggregatedChartData.length - 1];
    const firstNW = first.cash + first.investments - first.debt;
    const lastNW = last.cash + last.investments - last.debt;
    return firstNW !== 0 ? ((lastNW - firstNW) / Math.abs(firstNW)) * 100 : 0;
  }, [aggregatedChartData]);

  // Milestone progress
  const milestoneInfo = useMemo(() => getMilestoneProgress(netWorth), [netWorth]);
  const motivationalMsg = useMemo(() => getMotivationalMessage(netWorth, netWorthChange), [netWorth, netWorthChange]);

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
      action: { label: 'Plan DCA', onPress: () => nav.navigate('Invest', { screen: 'DCAPlanner', params: { suggest } }) },
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

  // Animation values for milestone achievement - subtle pulse effect
  const milestoneScale = useSharedValue(1);

  useEffect(() => {
    if (milestoneInfo.current) {
      milestoneScale.value = withRepeat(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [milestoneInfo.current]);

  const milestoneAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: milestoneScale.value }],
  }));

  return (
    <ScreenScroll
      inTab
      contentStyle={{
        paddingHorizontal: 0,
        paddingTop: spacing.s16,
        paddingBottom: spacing.s32,
        gap: spacing.s16,
      }}
    >
      {/* Header like Invest tab */}
      <View style={{ paddingHorizontal: spacing.s16, gap: spacing.s16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>
            Money
          </Text>
          {/* Milestone Badge - Tappable */}
          {milestoneInfo.current && (
            <AnimatedPressable onPress={() => setShowWealthJourney(true)}>
              <Animated.View style={[milestoneAnimStyle, {
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s8,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(milestoneInfo.current.color, isDark ? 0.3 : 0.2),
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s6,
                borderWidth: 2,
                borderColor: milestoneInfo.current.color,
              }]}>
                <Icon name={milestoneInfo.current.icon} size={16} color={milestoneInfo.current.color} />
                <Text style={{ color: milestoneInfo.current.color, fontSize: 12, fontWeight: '800' }}>
                  {milestoneInfo.current.label}
                </Text>
              </Animated.View>
            </AnimatedPressable>
          )}
        </View>

        {/* Net Worth Display with subtle label */}
        <View>
          <Text style={{ color: muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600', marginBottom: spacing.s4 }}>
            Net Worth
          </Text>
          <Text style={{ color: text, fontSize: 36, fontWeight: '800', letterSpacing: -1 }}>
            {formatCurrency(netWorth)}
          </Text>
          {/* Change indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6, marginTop: spacing.s6 }}>
            <Text style={{
              color: netWorthChange >= 0 ? successColor : warningColor,
              fontSize: 13,
              fontWeight: '600'
            }}>
              {netWorthChange >= 0 ? '+' : ''}{formatCurrency(Math.abs(netWorthChange))} ({netWorthChange >= 0 ? '+' : ''}{netWorthChangePercent.toFixed(1)}%)
            </Text>
            <Text style={{ color: muted, fontSize: 13 }}>•</Text>
            <Text style={{ color: muted, fontSize: 13 }}>
              {motivationalMsg.emoji} {motivationalMsg.message}
            </Text>
          </View>
        </View>

        {/* Bar Chart with Scroll Wheel Picker */}
        <View style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.s8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, fontSize: 13, fontWeight: '600', marginBottom: spacing.s6 }}>
                Balance over time
              </Text>
              {selectedBarIndex !== null && aggregatedChartData[selectedBarIndex] ? (
                <>
                  <Text style={{ color: text, fontSize: 24, fontWeight: '800' }}>
                    {formatCurrency(
                      aggregatedChartData[selectedBarIndex].cash +
                      aggregatedChartData[selectedBarIndex].investments -
                      aggregatedChartData[selectedBarIndex].debt
                    )}
                  </Text>
                  <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s4 }}>
                    {aggregatedChartData[selectedBarIndex].label}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: text, fontSize: 24, fontWeight: '800' }}>
                    {formatCurrency(netWorth)}
                  </Text>
                  <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s4 }}>Current</Text>
                </>
              )}
            </View>

            {/* Scroll Wheel Timeframe Picker */}
            <View style={{
              height: 40,
              width: 180,
              overflow: 'hidden',
              justifyContent: 'center',
            }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={60}
                decelerationRate="fast"
                contentContainerStyle={{
                  paddingHorizontal: 60,
                }}
                onScroll={(e) => {
                  const offsetX = e.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / 60);
                  const options: ('1W'|'1M'|'3M'|'6M'|'1Y'|'ALL')[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];
                  if (index >= 0 && index < options.length && options[index] !== netWorthTimeframe) {
                    setNetWorthTimeframe(options[index]);
                    setSelectedBarIndex(null);
                  }
                }}
                scrollEventThrottle={16}
              >
                {(['1W', '1M', '3M', '6M', '1Y', 'ALL'] as const).map((option, idx) => {
                  const isSelected = option === netWorthTimeframe;
                  return (
                    <View
                      key={option}
                      style={{
                        width: 60,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? accentPrimary : muted,
                          fontSize: isSelected ? 16 : 13,
                          fontWeight: isSelected ? '700' : '600',
                          opacity: isSelected ? 1 : 0.5,
                        }}
                      >
                        {option}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View>
            <View style={{ height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
              {aggregatedChartData.map((point, index) => {
                const netWorthValue = point.cash + point.investments - point.debt;
                const maxNW = Math.max(...aggregatedChartData.map(p => p.cash + p.investments - p.debt), 1);
                const barHeight = (netWorthValue / maxNW) * 120;
                const isSelected = selectedBarIndex === index;

                return (
                  <ChartBar
                    key={index}
                    height={barHeight}
                    maxHeight={130}
                    color={accentPrimary}
                    isSelected={isSelected}
                    onPress={() => setSelectedBarIndex(isSelected ? null : index)}
                    delay={index * 50}
                  />
                );
              })}
            </View>

            {/* Labels below bars */}
            <View style={{ flexDirection: 'row', marginTop: spacing.s4, gap: 4 }}>
              {aggregatedChartData.map((point, index) => (
                <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: muted, fontSize: 10, fontWeight: '600' }}>
                    {point.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Key Metrics Grid */}
      <View style={{ gap: spacing.s12, paddingHorizontal: spacing.s16, marginTop: spacing.s8 }}>
        <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>Overview</Text>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <MetricCard
            title="Cash"
            value={formatCurrency(totalCash)}
            subtitle={`${cashAccounts.length} account${cashAccounts.length === 1 ? '' : 's'}`}
            icon="wallet"
            bgColor={withAlpha(accentPrimary, isDark ? 0.2 : 0.12)}
            onPress={() => nav.navigate('AccountsList')}
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
            onPress={() => nav.navigate('PortfolioList')}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <MetricCard
            title="Bills due"
            value={formatCurrency(upcoming.total)}
            subtitle={`${upcoming.list.length} in next 30 days`}
            icon="receipt"
            bgColor={withAlpha(successColor, isDark ? 0.2 : 0.14)}
            onPress={() => nav.navigate('BillsList')}
            badge={
              upcoming.total > totalCash
                ? { text: 'Over cash', variant: 'warning' }
                : undefined
            }
          />
          <MetricCard
            title="Debts"
            value={formatCurrency(totalDebt)}
            subtitle={`${debtsList.length + creditCards.length} debt${(debtsList.length + creditCards.length) === 1 ? '' : 's'}${creditCards.length > 0 ? ` • ${creditCards.length} card${creditCards.length === 1 ? '' : 's'}` : ''}`}
            icon="target"
            bgColor={withAlpha(warningColor, isDark ? 0.2 : 0.14)}
            onPress={() => nav.navigate('DebtsList')}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <MetricCard
            title="Paycheck"
            value={
              paycheckConfig.enabled && splitHistory.length > 0
                ? formatCurrency(splitHistory[splitHistory.length - 1]?.netAmount || 0)
                : '—'
            }
            subtitle={
              paycheckConfig.enabled && splitHistory.length > 0
                ? `Last: ${new Date(splitHistory[splitHistory.length - 1]?.date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : 'Split income automatically'
            }
            icon="dollar-sign"
            bgColor={withAlpha(accentPrimary, isDark ? 0.18 : 0.1)}
            onPress={() => nav.navigate('PaycheckBreakdown')}
            badge={
              paycheckConfig.enabled && paycheckConfig.cpf.enabled
                ? { text: 'CPF Active', variant: 'success' }
                : !paycheckConfig.enabled
                ? { text: 'Setup', variant: 'neutral' }
                : undefined
            }
          />
        </View>
      </View>

      {/* Spendable Cash Highlight */}
      <View style={{ paddingHorizontal: spacing.s16 }}>
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
      </View>

      {/* Quick Access Cards */}
      <View style={{ gap: spacing.s12, paddingHorizontal: spacing.s16 }}>
        <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>Quick access</Text>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
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
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="plus" size={24} color={accentPrimary} />
            </View>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Add account</Text>
            <Text style={{ color: muted, fontSize: 13 }}>Track a new account</Text>
          </Pressable>

          <Pressable
            onPress={() => nav.navigate('TransactionsModal')}
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
              <Icon name="receipt" size={24} color={accentSecondary} />
            </View>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Transactions</Text>
            <Text style={{ color: muted, fontSize: 13 }}>View all activity</Text>
          </Pressable>
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

          {cashAccounts.length === 0 ? (
            <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
              <Text style={{ color: muted, marginBottom: spacing.s12 }}>
                No cash accounts yet. Add your first account to start tracking.
              </Text>
              <Button
                title="Add account"
                onPress={() => closeSheetThen(setShowAccountsSheet, () => nav.navigate('AddAccount'), { immediate: true })}
              />
            </Card>
          ) : (
            <View style={{ gap: spacing.s8 }}>
              {cashAccounts.map(account => {
                const kindIcon =
                  account.kind === 'savings' ? 'piggy-bank' :
                  account.kind === 'checking' ? 'building-2' :
                  account.kind === 'cash' ? 'wallet' :
                  account.kind === 'investment' ? 'trending-up' : 'wallet';
                const excluded = account.includeInNetWorth === false;

                return (
                  <AnimatedPressable
                    key={account.id}
                    onPress={() => {
                      closeSheetThen(setShowAccountsSheet, () => nav.navigate('AccountDetail', { id: account.id }));
                    }}
                    style={{
                      backgroundColor: cardBg,
                      borderRadius: radius.md,
                      padding: spacing.s16,
                      opacity: excluded ? 0.7 : 1,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
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
                        <Icon name={kindIcon as any} size={20} colorToken="accent.primary" />
                      </View>
                      <View>
                        <Text style={{ color: text, fontWeight: '700' }}>{account.name}</Text>
                        <Text style={{ color: muted, fontSize: 13 }}>
                          {account.kind ? account.kind.charAt(0).toUpperCase() + account.kind.slice(1) : 'Account'}
                          {account.institution ? ` • ${account.institution}` : ''}
                          {account.mask ? ` • ${account.mask}` : ''}
                          {excluded ? ' • Hidden' : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: onSurface, fontWeight: '700', fontSize: 16 }}>
                      {formatCurrency(account.balance)}
                    </Text>
                  </AnimatedPressable>
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
                <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Credit cards</Text>
                <Text style={{ color: text, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
                  {formatCurrency(totalCreditCardDebt)}
                </Text>
              </View>
            </View>
            {(debtsList.length > 0 || creditCards.length > 0) && (
              <View style={{ flexDirection: 'row', gap: spacing.s12, marginTop: spacing.s12 }}>
                {creditCards.length > 0 && (
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: muted, fontSize: 11 }}>{creditCards.length} card{creditCards.length === 1 ? '' : 's'}</Text>
                  </View>
                )}
                {debtsList.length > 0 && (
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: muted, fontSize: 11 }}>{debtsList.length} other debt{debtsList.length === 1 ? '' : 's'}</Text>
                  </View>
                )}
              </View>
            )}
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

          {debtsList.length === 0 && creditCards.length === 0 ? (
            <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
              <Text style={{ color: muted }}>
                No debts tracked. Add your debts or credit cards to monitor payoff progress and due dates.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.s12 }}>
              {creditCards.length > 0 && (
                <View style={{ gap: spacing.s8 }}>
                  <Text style={{ color: muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 }}>CREDIT CARDS</Text>
                  {creditCards.map(card => (
                    <AnimatedPressable
                      key={card.id}
                      onPress={() => {
                        closeSheetThen(setShowDebtsSheet, () => nav.navigate('AccountDetail', { id: card.id }));
                      }}
                      style={{
                        backgroundColor: cardBg,
                        borderRadius: radius.md,
                        padding: spacing.s16,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.s8, alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: radius.md,
                              backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.15),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon name="credit-card" size={18} colorToken="semantic.warning" />
                          </View>
                          <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>{card.name}</Text>
                        </View>
                        <Text style={{ color: onSurface, fontWeight: '700', fontSize: 15 }}>
                          {formatCurrency(Math.abs(card.balance))}
                        </Text>
                      </View>
                      <Text style={{ color: muted, fontSize: 13 }}>
                        {card.institution || 'Credit Card'}
                        {card.mask ? ` • ${card.mask}` : ''}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </View>
              )}

              {debtsList.length > 0 && (
                <View style={{ gap: spacing.s8 }}>
                  <Text style={{ color: muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 }}>OTHER DEBTS</Text>
                  {debtsList.map(debt => {
                    const dueDate = debt.dueISO ? new Date(debt.dueISO) : null;
                    const dueLabel =
                      dueDate && !isNaN(dueDate.getTime())
                        ? dueDate.toLocaleDateString()
                        : 'No due date';
                    return (
                      <AnimatedPressable
                        key={debt.id}
                        onPress={() => {
                          closeSheetThen(setShowDebtsSheet, () => nav.navigate('DebtDetail', { id: debt.id }));
                        }}
                        style={{
                          backgroundColor: cardBg,
                          borderRadius: radius.md,
                          padding: spacing.s16,
                        }}
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
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </BottomSheet>

      {/* Wealth Journey Sheet */}
      <WealthJourneySheet
        visible={showWealthJourney}
        onClose={() => setShowWealthJourney(false)}
        netWorth={netWorth}
        totalCash={totalCash}
        totalInvestments={portfolioCalc.totalUSD}
        totalDebt={totalDebt}
        netWorthHistory={netWorthHistoryData.map(d => ({ t: d.t, v: d.cash + d.investments - d.debt }))}
      />
    </ScreenScroll>
  );
};

export default Money;
