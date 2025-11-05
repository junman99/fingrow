import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Dimensions, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ScreenScroll } from '../components/ScreenScroll';
import { Card } from '../components/Card';
import Button from '../components/Button';
import Icon from '../components/Icon';
import BottomSheet from '../components/BottomSheet';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useAccountsStore } from '../store/accounts';
import { useTxStore } from '../store/transactions';
import { useRoute, useNavigation } from '@react-navigation/native';
import { formatCurrency } from '../lib/format';

type RouteParams = { id: string };

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
  disabled?: boolean;
}> = ({ onPress, children, style, disabled }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
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

export default function AccountDetail() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const accent = get('accent.primary') as string;
  const cardBg = get('surface.level1') as string;
  const cardBg2 = get('surface.level2') as string;
  const outline = get('border.subtle') as string;
  const successColor = get('semantic.success') as string;
  const errorColor = get('semantic.error') as string;
  const dangerColor = get('semantic.danger') as string;
  const bgDefault = get('background.default') as string;

  const { accounts, updateAccountBalance } = useAccountsStore();
  const { transactions, add: addTx } = useTxStore();
  const acc = useMemo(() => (accounts || []).find(a => a.id === (route.params as RouteParams)?.id), [accounts, route.params]);

  // Transaction form state
  const [showTransactionSheet, setShowTransactionSheet] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date());
  const [note, setNote] = useState('');

  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [chartOffset, setChartOffset] = useState(0); // 0 = current period, 1 = previous period, etc.

  // Calculate balance history - 7 bars for week, 7 bars for month
  const balanceHistory = useMemo(() => {
    if (!acc) return [];

    const accountTransactions = transactions.filter(tx => tx.account === acc.name);
    const now = new Date();
    const points: Array<{ date: Date; balance: number; label: string }> = [];

    if (chartPeriod === 'week') {
      // Show 7 weeks (each bar = 1 week ending on Sunday)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      for (let i = 6; i >= 0; i--) {
        const weeksBack = i + (chartOffset * 7);
        const weekEnd = new Date(now);

        // Find the most recent Sunday
        const dayOfWeek = weekEnd.getDay();
        weekEnd.setDate(weekEnd.getDate() - dayOfWeek);

        // Go back the required number of weeks
        weekEnd.setDate(weekEnd.getDate() - (weeksBack * 7));

        // Calculate balance at end of this week
        let weekBalance = acc.balance;
        accountTransactions.forEach(tx => {
          const txDate = new Date(tx.date);
          if (txDate > weekEnd) {
            if (tx.type === 'income') {
              weekBalance -= tx.amount;
            } else {
              weekBalance += tx.amount;
            }
          }
        });

        // Format as "25 May"
        const day = weekEnd.getDate();
        const month = monthNames[weekEnd.getMonth()];

        points.push({
          date: weekEnd,
          balance: weekBalance,
          label: `${day} ${month}`,
        });
      }
    } else {
      // Show 7 months (each bar = 1 month)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      for (let i = 6; i >= 0; i--) {
        const monthsBack = i + (chartOffset * 7);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0);

        // Calculate balance at end of this month
        let monthBalance = acc.balance;
        accountTransactions.forEach(tx => {
          const txDate = new Date(tx.date);
          if (txDate > monthEnd) {
            if (tx.type === 'income') {
              monthBalance -= tx.amount;
            } else {
              monthBalance += tx.amount;
            }
          }
        });

        // Format as "Jan 25"
        const month = monthNames[monthEnd.getMonth()];
        const year = String(monthEnd.getFullYear()).slice(-2);

        points.push({
          date: monthEnd,
          balance: monthBalance,
          label: `${month} ${year}`,
        });
      }
    }

    return points;
  }, [acc, transactions, chartPeriod, chartOffset]);

  // Calculate stats including last month comparison
  const stats = useMemo(() => {
    if (!acc) return {
      totalIn: 0,
      totalOut: 0,
      netChange: 0,
      transactionCount: 0,
      lastMonthBalance: 0,
      monthlyChange: 0,
      monthlyChangePercent: 0,
    };

    const accountTransactions = transactions.filter(tx => tx.account === acc.name);
    const now = new Date();

    // Last month's end date
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calculate balance at end of last month
    let lastMonthBalance = acc.balance;
    accountTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      if (txDate > lastMonthEnd) {
        if (tx.type === 'income') {
          lastMonthBalance -= tx.amount;
        } else {
          lastMonthBalance += tx.amount;
        }
      }
    });

    const monthlyChange = acc.balance - lastMonthBalance;
    const monthlyChangePercent = lastMonthBalance !== 0
      ? (monthlyChange / Math.abs(lastMonthBalance)) * 100
      : 0;

    // Stats for current period
    const daysToShow = chartPeriod === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToShow);

    const periodTxs = accountTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate;
    });

    const totalIn = periodTxs.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const totalOut = periodTxs.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const netChange = totalIn - totalOut;

    return {
      totalIn,
      totalOut,
      netChange,
      transactionCount: periodTxs.length,
      lastMonthBalance,
      monthlyChange,
      monthlyChangePercent,
    };
  }, [acc, transactions, chartPeriod]);

  // Get recent transactions for this account
  const recentAccountTransactions = useMemo(() => {
    return transactions
      .filter(tx => tx.account === acc?.name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions, acc?.name]);

  // Handle opening transaction sheet
  const openTransactionSheet = (type: 'deposit' | 'withdraw') => {
    setTransactionType(type);
    setAmount('');
    setNote('');
    setTransactionDate(new Date());
    setShowTransactionSheet(true);
  };

  // Handle transaction submission
  const handleSubmitTransaction = async () => {
    if (!acc || !amount || parseFloat(amount) <= 0) return;

    const amountNum = parseFloat(amount);
    const isDeposit = transactionType === 'deposit';

    // Create transaction
    await addTx({
      type: isDeposit ? 'income' : 'expense',
      amount: amountNum,
      category: isDeposit ? 'Deposit' : 'Withdrawal',
      account: acc.name,
      date: transactionDate.toISOString(),
      note: note || undefined,
    });

    // Update account balance
    // For deposits (income), isExpense = false; for withdrawals (expense), isExpense = true
    await updateAccountBalance(acc.name, amountNum, !isDeposit);

    // Close sheet and reset
    setShowTransactionSheet(false);
    setAmount('');
    setNote('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (!acc) {
    return (
      <ScreenScroll inTab contentStyle={{ padding: spacing.s16 }}>
        <Text style={{ color: text }}>Account not found.</Text>
      </ScreenScroll>
    );
  }

  const balanceTrend = acc.balance >= 0 ? 'positive' : 'negative';
  const trendColor = balanceTrend === 'positive' ? successColor : errorColor;

  // Chart rendering
  const chartWidth = Dimensions.get('window').width - spacing.s16 * 4;
  const chartHeight = 180;
  const maxBalance = Math.max(...balanceHistory.map(p => p.balance), 0);
  const minBalance = Math.min(...balanceHistory.map(p => p.balance), 0);
  const range = maxBalance - minBalance;
  const padding = range * 0.1 || 1;

  return (
    <ScreenScroll inTab contentStyle={{ padding: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
        <AnimatedPressable onPress={() => nav.goBack()}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              backgroundColor: cardBg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: outline,
            }}
          >
            <Icon name="chevron-left" size={20} color={text} />
          </View>
        </AnimatedPressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>
            {(acc.institution || 'Manual').toUpperCase()}
            {acc.mask ? ` • • • ${acc.mask}` : ''}
          </Text>
          <Text style={{ color: text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
            {acc.name}
          </Text>
        </View>
        <AnimatedPressable onPress={() => nav.navigate('AccountSettings', { id: acc.id })}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              backgroundColor: cardBg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: outline,
            }}
          >
            <Icon name="settings" size={20} color={text} />
          </View>
        </AnimatedPressable>
      </View>

      {/* Balance Section - Directly on Background */}
      <View style={{ gap: spacing.s16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ color: muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>
              CURRENT BALANCE
            </Text>
            <Text style={{ color: text, fontSize: 40, fontWeight: '900', marginTop: spacing.s6, letterSpacing: -1.2 }}>
              {formatCurrency(acc.balance)}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: spacing.s12,
              paddingVertical: spacing.s6,
              borderRadius: radius.pill,
              backgroundColor: withAlpha(trendColor, 0.15),
            }}
          >
            <Text style={{ color: trendColor, fontSize: 12, fontWeight: '700' }}>
              {acc.kind.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Critical Info Grid */}
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Last Month</Text>
            <Text style={{ color: text, fontSize: 18, fontWeight: '800', marginTop: spacing.s4 }}>
              {formatCurrency(stats.lastMonthBalance)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Monthly Change</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4, marginTop: spacing.s4 }}>
              <Icon
                name={stats.monthlyChange >= 0 ? 'trending-up' : 'trending-down'}
                size={16}
                color={stats.monthlyChange >= 0 ? successColor : dangerColor}
              />
              <Text
                style={{
                  color: stats.monthlyChange >= 0 ? successColor : dangerColor,
                  fontSize: 18,
                  fontWeight: '800',
                }}
              >
                {stats.monthlyChange >= 0 ? '+' : ''}{formatCurrency(stats.monthlyChange)}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Change %</Text>
            <Text
              style={{
                color: stats.monthlyChange >= 0 ? successColor : dangerColor,
                fontSize: 18,
                fontWeight: '800',
                marginTop: spacing.s4,
              }}
            >
              {stats.monthlyChange >= 0 ? '+' : ''}{stats.monthlyChangePercent.toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* Action Buttons - Deposit/Withdraw or Pay Off for Credit Cards */}
        {acc.kind === 'credit' ? (
          <AnimatedPressable onPress={() => nav.navigate('PayCreditCard', { creditCardId: acc.id })} style={{ marginTop: spacing.s4 }}>
            <View
              style={{
                backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.15),
                borderRadius: radius.lg,
                paddingVertical: spacing.s12,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: withAlpha(successColor, isDark ? 0.3 : 0.2),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Icon name="credit-card" size={18} color={successColor} />
                <Text style={{ color: successColor, fontSize: 15, fontWeight: '700' }}>
                  Pay Off Credit Card
                </Text>
              </View>
            </View>
          </AnimatedPressable>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.s12, marginTop: spacing.s4, width: '100%' }}>
            <View style={{ flex: 1 }}>
              <AnimatedPressable onPress={() => openTransactionSheet('deposit')}>
                <View
                  style={{
                    backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.15),
                    borderRadius: radius.lg,
                    paddingVertical: spacing.s12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.s8,
                    borderWidth: 1,
                    borderColor: withAlpha(successColor, isDark ? 0.3 : 0.2),
                  }}
                >
                  <Icon name="arrow-down-circle" size={18} color={successColor} />
                  <Text style={{ color: successColor, fontSize: 15, fontWeight: '700' }}>
                    Deposit
                  </Text>
                </View>
              </AnimatedPressable>
            </View>

            <View style={{ flex: 1 }}>
              <AnimatedPressable onPress={() => openTransactionSheet('withdraw')}>
                <View
                  style={{
                    backgroundColor: withAlpha(dangerColor, isDark ? 0.2 : 0.15),
                    borderRadius: radius.lg,
                    paddingVertical: spacing.s12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.s8,
                    borderWidth: 1,
                    borderColor: withAlpha(dangerColor, isDark ? 0.3 : 0.2),
                  }}
                >
                  <Icon name="arrow-up-circle" size={18} color={dangerColor} />
                  <Text style={{ color: dangerColor, fontSize: 15, fontWeight: '700' }}>
                    Withdraw
                  </Text>
                </View>
              </AnimatedPressable>
            </View>
          </View>
        )}
      </View>

      {/* Balance Chart */}
      {balanceHistory.length > 0 && (
        <View style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>
              Balance Over Time
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: cardBg2, borderRadius: radius.md, padding: 2, gap: 2 }}>
              {(['week', 'month'] as const).map((period) => (
                <Pressable
                  key={period}
                  onPress={() => {
                    setChartPeriod(period);
                    setChartOffset(0);
                    setSelectedBarIndex(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.s4,
                    paddingHorizontal: spacing.s10,
                    borderRadius: radius.sm,
                    backgroundColor: chartPeriod === period ? accent : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: chartPeriod === period ? (isDark ? text : 'white') : muted,
                      fontWeight: chartPeriod === period ? '700' : '600',
                      fontSize: 12,
                    }}
                  >
                    {period === 'week' ? 'W' : 'M'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Navigation hint */}
          {chartOffset > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.s8 }}>
              <Pressable
                onPress={() => {
                  if (chartOffset > 0) {
                    setChartOffset(chartOffset - 1);
                    setSelectedBarIndex(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s8,
                  paddingVertical: spacing.s4,
                  borderRadius: radius.sm,
                  backgroundColor: withAlpha(accent, 0.1),
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ color: accent, fontSize: 11, fontWeight: '600' }}>← Newer</Text>
              </Pressable>
              <Text style={{ color: muted, fontSize: 11 }}>
                {chartOffset === 1 ? '1 period back' : `${chartOffset} periods back`}
              </Text>
              <Pressable
                onPress={() => {
                  setChartOffset(chartOffset + 1);
                  setSelectedBarIndex(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s8,
                  paddingVertical: spacing.s4,
                  borderRadius: radius.sm,
                  backgroundColor: withAlpha(accent, 0.1),
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ color: accent, fontSize: 11, fontWeight: '600' }}>Older →</Text>
              </Pressable>
            </View>
          )}

          {/* Tooltip */}
          {selectedBarIndex !== null && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={{
                position: 'absolute',
                top: 60,
                left: 0,
                right: 0,
                zIndex: 10,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  backgroundColor: isDark ? withAlpha(text, 0.95) : withAlpha('#000', 0.85),
                  paddingVertical: spacing.s10,
                  paddingHorizontal: spacing.s16,
                  borderRadius: radius.lg,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Text style={{ color: isDark ? bgDefault : 'white', fontSize: 11, fontWeight: '600', marginBottom: spacing.s4 }}>
                  {balanceHistory[selectedBarIndex].label}
                </Text>
                <Text style={{ color: isDark ? bgDefault : 'white', fontSize: 18, fontWeight: '800' }}>
                  {formatCurrency(balanceHistory[selectedBarIndex].balance)}
                </Text>
              </View>
            </Animated.View>
          )}

          <GestureDetector
            gesture={Gesture.Pan()
              .activeOffsetX([-10, 10])
              .failOffsetY([-10, 10])
              .onEnd((e) => {
                'worklet';
                if (e.velocityX > 500) {
                  // Swipe right - go to newer data
                  const goNewer = () => {
                    setChartOffset(prev => Math.max(0, prev - 1));
                    setSelectedBarIndex(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  };
                  runOnJS(goNewer)();
                } else if (e.velocityX < -500) {
                  // Swipe left - go to older data
                  const goOlder = () => {
                    setChartOffset(prev => prev + 1);
                    setSelectedBarIndex(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  };
                  runOnJS(goOlder)();
                }
              })}
          >
            <View style={{ height: chartHeight }}>
              {/* Bar chart */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight }}>
                {balanceHistory.map((point, index) => {
                  const normalizedBalance = range === 0 ? 0.5 : ((point.balance - minBalance + padding) / (range + padding * 2));
                  const barHeight = Math.max(normalizedBalance * chartHeight, 4);
                  const isPositive = point.balance >= 0;
                  const barColor = isPositive ? successColor : errorColor;

                  return (
                    <ChartBar
                      key={`${chartPeriod}-${chartOffset}-${index}`}
                      height={barHeight}
                      maxHeight={chartHeight}
                      color={barColor}
                      isSelected={selectedBarIndex === index}
                      delay={index * 50}
                      onPress={() => {
                        if (selectedBarIndex === index) {
                          setSelectedBarIndex(null);
                        } else {
                          setSelectedBarIndex(index);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }
                      }}
                    />
                  );
                })}
              </View>
            </View>
          </GestureDetector>
          {/* Labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {balanceHistory.map((point, index) => {
              // Show all labels for better UX
              return (
                <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: selectedBarIndex === index ? text : muted, fontSize: 9, fontWeight: selectedBarIndex === index ? '700' : '600' }}>
                    {point.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Stats Grid */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
          {chartPeriod === 'week' ? '7-Day' : '30-Day'} Summary
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <Card style={{ flex: 1, padding: spacing.s16 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.sm,
                backgroundColor: withAlpha(successColor, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.s8,
              }}
            >
              <Icon name="arrow-down" size={16} color={successColor} />
            </View>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Money In</Text>
            <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
              {formatCurrency(stats.totalIn)}
            </Text>
          </Card>
          <Card style={{ flex: 1, padding: spacing.s16 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.sm,
                backgroundColor: withAlpha(dangerColor, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.s8,
              }}
            >
              <Icon name="arrow-up" size={16} color={dangerColor} />
            </View>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Money Out</Text>
            <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
              {formatCurrency(stats.totalOut)}
            </Text>
          </Card>
        </View>
        <Card style={{ padding: spacing.s16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Transactions</Text>
              <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                {stats.transactionCount}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Net Change</Text>
              <Text
                style={{
                  color: stats.netChange >= 0 ? successColor : errorColor,
                  fontSize: 20,
                  fontWeight: '800',
                  marginTop: spacing.s4,
                }}
              >
                {stats.netChange > 0 ? '+' : ''}{formatCurrency(stats.netChange)}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Recent Transactions */}
      {recentAccountTransactions.length > 0 && (
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Recent Activity</Text>
          <Card style={{ padding: spacing.s16, gap: spacing.s14 }}>
            {recentAccountTransactions.map((tx, idx) => (
              <View
                key={tx.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.s8,
                  borderBottomWidth: idx < recentAccountTransactions.length - 1 ? 1 : 0,
                  borderBottomColor: outline,
                }}
              >
                <View style={{ flex: 1, gap: spacing.s2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: withAlpha(tx.type === 'income' ? successColor : dangerColor, 0.15),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon
                        name={tx.type === 'income' ? 'arrow-down' : 'arrow-up'}
                        size={12}
                        color={tx.type === 'income' ? successColor : dangerColor}
                      />
                    </View>
                    <Text style={{ color: text, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                      {tx.note || tx.category || 'Transaction'}
                    </Text>
                  </View>
                  <Text style={{ color: muted, fontSize: 12, marginLeft: 32 }}>
                    {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {tx.category && ` • ${tx.category}`}
                  </Text>
                </View>
                <Text
                  style={{
                    color: tx.type === 'income' ? successColor : dangerColor,
                    fontWeight: '800',
                    fontSize: 16,
                    marginLeft: spacing.s12,
                  }}
                >
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Transaction Bottom Sheet */}
      <BottomSheet
        visible={showTransactionSheet}
        onClose={() => setShowTransactionSheet(false)}
      >
        <View style={{ gap: spacing.s20, paddingBottom: spacing.s16 }}>
          {/* Header */}
          <View>
            <Text style={{ color: text, fontSize: 24, fontWeight: '700' }}>
              {transactionType === 'deposit' ? 'Deposit Money' : 'Withdraw Money'}
            </Text>
            <Text style={{ color: muted, marginTop: spacing.s6 }}>
              {transactionType === 'deposit'
                ? 'Add money to your account'
                : 'Withdraw money from your account'}
            </Text>
          </View>

          {/* Amount Input */}
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>Amount</Text>
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: outline,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.s16,
              }}
            >
              <Text style={{ color: muted, fontSize: 20, fontWeight: '600' }}>$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={muted}
                keyboardType="decimal-pad"
                autoFocus
                style={{
                  flex: 1,
                  color: text,
                  fontSize: 24,
                  fontWeight: '700',
                  paddingVertical: spacing.s16,
                  paddingLeft: spacing.s8,
                }}
              />
            </View>
          </View>

          {/* Date Picker */}
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>Date</Text>
            <Pressable
              onPress={() => {
                // For now, we'll use a simple date display
                // You can add a proper date picker later
              }}
              style={{
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: outline,
                padding: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
              }}
            >
              <Icon name="calendar" size={20} color={accent} />
              <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>
                {transactionDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </Pressable>
          </View>

          {/* Note Input */}
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>
              Note <Text style={{ color: muted }}>(optional)</Text>
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor={muted}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: outline,
                color: text,
                fontSize: 15,
                padding: spacing.s16,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Submit Button */}
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <Button
              title="Cancel"
              onPress={() => setShowTransactionSheet(false)}
              variant="secondary"
              style={{ flex: 1 }}
            />
            <Button
              title={transactionType === 'deposit' ? 'Deposit' : 'Withdraw'}
              onPress={handleSubmitTransaction}
              disabled={!amount || parseFloat(amount) <= 0}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </BottomSheet>
    </ScreenScroll>
  );
}
