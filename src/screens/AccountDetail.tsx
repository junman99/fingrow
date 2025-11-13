import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Dimensions, TextInput, ScrollView, Platform, Modal, TouchableWithoutFeedback } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
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

const SwipeableTransactionRow: React.FC<{
  tx: any;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ tx, isLast, onEdit, onDelete }) => {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const successColor = get('semantic.success') as string;
  const dangerColor = get('semantic.danger') as string;
  const outline = get('border.subtle') as string;
  const cardBg = get('surface.level1') as string;

  const REVEAL = 128; // Show both edit and delete buttons
  const DELETE_AT = 200;

  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = e.translationX;
      } else {
        translateX.value = e.translationX * 0.2; // resist right swipe
      }
    })
    .onEnd(() => {
      const x = translateX.value;
      if (x < -DELETE_AT) {
        translateX.value = withTiming(-600, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onDelete)();
        });
      } else if (x < -REVEAL) {
        translateX.value = withSpring(-REVEAL, { damping: 18, stiffness: 180 });
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={{ backgroundColor: cardBg, position: 'relative' }}>
      {/* Action buttons background */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          left: 0,
          top: 0,
          bottom: 0,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: spacing.s12,
          gap: spacing.s8,
        }}
      >
        <Pressable
          onPress={() => {
            translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
            onEdit();
          }}
          style={{
            paddingVertical: spacing.s10,
            paddingHorizontal: spacing.s16,
            borderRadius: radius.lg,
            backgroundColor: withAlpha(successColor, 0.15),
          }}
        >
          <Text style={{ color: successColor, fontWeight: '700', fontSize: 14 }}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={{
            paddingVertical: spacing.s10,
            paddingHorizontal: spacing.s16,
            borderRadius: radius.lg,
            backgroundColor: withAlpha(dangerColor, 0.15),
          }}
        >
          <Text style={{ color: dangerColor, fontWeight: '700', fontSize: 14 }}>Delete</Text>
        </Pressable>
      </View>

      {/* Swipeable row */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ backgroundColor: cardBg }, rowStyle]}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: spacing.s12,
              paddingHorizontal: spacing.s16,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: outline,
              minHeight: 60,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, flex: 1 }}>
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
              <View style={{ flex: 1, gap: spacing.s2 }}>
                <Text style={{ color: text, fontWeight: '600' }} numberOfLines={1}>
                  {tx.note || (tx.type === 'income' ? 'Deposit' : 'Withdrawal')}
                </Text>
                <Text style={{ color: muted, fontSize: 12 }}>
                  {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: tx.type === 'income' ? successColor : dangerColor,
                fontWeight: '800',
                fontSize: 16,
                marginLeft: spacing.s12,
              }}
            >
              {tx.type === 'income' ? '+' : '-'}
              {formatCurrency(Math.abs(tx.amount))}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
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
  const opacity = useSharedValue(0);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    // Animate in with delay
    opacity.value = withTiming(1, { duration: 200 }, () => {});
    return () => {
      isMounted.current = false;
      // Cancel any ongoing animations immediately
      scale.value = 1;
      animatedHeight.value = 0;
      opacity.value = 0;
    };
  }, []);

  React.useEffect(() => {
    if (isMounted.current) {
      animatedHeight.value = withTiming(height, { duration: 300 });
    }
  }, [height]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = React.useCallback(() => {
    if (isMounted.current) {
      scale.value = withSpring(1.05, { damping: 12, stiffness: 200 });
    }
  }, []);

  const handlePressOut = React.useCallback(() => {
    if (isMounted.current) {
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    }
  }, []);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{
        flex: 1,
        height: maxHeight,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 2,
      }}
    >
      <Animated.View
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

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Safely get account with proper null checking
  const acc = useMemo(() => {
    if (!accounts || !Array.isArray(accounts)) return null;
    const accountId = (route.params as RouteParams)?.id;
    if (!accountId) return null;
    return accounts.find(a => a.id === accountId) || null;
  }, [accounts, route.params]);

  // Transaction form state
  const [showTransactionSheet, setShowTransactionSheet] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeOverlay, setShowTimeOverlay] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const [chartPeriod, setChartPeriod] = useState<'day' | 'week'>('day');
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  // Refs for synchronized scrolling
  const barScrollRef = React.useRef<ScrollView>(null);
  const labelScrollRef = React.useRef<ScrollView>(null);

  // Controlled tooltip animation
  const tooltipOpacity = useSharedValue(0);

  // Animate tooltip in/out when selection changes
  React.useEffect(() => {
    if (selectedBarIndex !== null) {
      tooltipOpacity.value = withTiming(1, { duration: 200 });
    } else {
      tooltipOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [selectedBarIndex]);

  // Cleanup tooltip animation on unmount
  React.useEffect(() => {
    return () => {
      tooltipOpacity.value = 0;
    };
  }, []);

  // Animated style for tooltip
  const tooltipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
  }));

  // Calculate balance history - 45 days or 26 weeks
  const balanceHistory = useMemo(() => {
    if (!acc) return [];

    try {
      const accountTransactions = (transactions || []).filter(tx => tx.account === acc.name);
      const now = new Date();
      const points: Array<{ date: Date; balance: number; label: string; showLabel: boolean }> = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Sort transactions chronologically for forward accumulation
      const sortedTransactions = [...accountTransactions].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Determine the earliest date we should show data for
      // Use the earliest of: account creation date OR first transaction date
      let accountStartDate: Date;
      const earliestTransactionDate = sortedTransactions.length > 0
        ? new Date(sortedTransactions[0].date)
        : null;

      if (acc.createdAt && earliestTransactionDate) {
        // Use whichever is earlier
        accountStartDate = new Date(Math.min(new Date(acc.createdAt).getTime(), earliestTransactionDate.getTime()));
      } else if (acc.createdAt) {
        accountStartDate = new Date(acc.createdAt);
      } else if (earliestTransactionDate) {
        accountStartDate = earliestTransactionDate;
      } else {
        accountStartDate = now;
      }

      // Normalize to start of day for proper comparison
      accountStartDate.setHours(0, 0, 0, 0);

      if (chartPeriod === 'day') {
        // Show up to 45 days (each bar = 1 day)
        // Use forward accumulation: start from earliest date and build up
        let runningBalance = 0;
        let txIndex = 0;

        for (let i = 44; i >= 0; i--) {
          const dayDate = new Date(now);
          dayDate.setDate(dayDate.getDate() - i);

          // Create normalized version for comparison (start of day)
          const dayDateNormalized = new Date(dayDate);
          dayDateNormalized.setHours(0, 0, 0, 0);

          // Skip periods before account/transactions started
          if (dayDateNormalized < accountStartDate) {
            continue;
          }

          // Set to end of day for transaction processing
          dayDate.setHours(23, 59, 59, 999);

          // Add all transactions that occurred on or before this day
          while (txIndex < sortedTransactions.length) {
            const tx = sortedTransactions[txIndex];
            const txDate = new Date(tx.date);

            if (txDate <= dayDate) {
              // Apply this transaction to running balance
              if (tx.type === 'income') {
                runningBalance += tx.amount;
              } else {
                runningBalance -= tx.amount;
              }
              txIndex++;
            } else {
              break; // This transaction is in the future for this day
            }
          }

          // Format label as "25 Aug" (day + month)
          const day = dayDate.getDate();
          const month = monthNames[dayDate.getMonth()].slice(0, 3);

          // Show every 5th label (roughly 9 labels for 45 days)
          const showLabel = (44 - i) % 5 === 0 || i === 0; // Show first and every 5th

          points.push({
            date: dayDate,
            balance: runningBalance,
            label: `${day} ${month}`,
            showLabel,
          });
        }
      } else {
        // Show up to 26 weeks (6 months = ~26 weeks, each bar = 1 week)
        let runningBalance = 0;
        let txIndex = 0;

        for (let i = 25; i >= 0; i--) {
          const weekEnd = new Date(now);

          // Find the most recent Sunday
          const dayOfWeek = weekEnd.getDay();
          weekEnd.setDate(weekEnd.getDate() - dayOfWeek);

          // Go back the required number of weeks
          weekEnd.setDate(weekEnd.getDate() - (i * 7));

          // Create normalized version for comparison (start of day)
          const weekEndNormalized = new Date(weekEnd);
          weekEndNormalized.setHours(0, 0, 0, 0);

          // Skip periods before account/transactions started
          if (weekEndNormalized < accountStartDate) {
            continue;
          }

          // Set to end of day for transaction processing
          weekEnd.setHours(23, 59, 59, 999);

          // Add all transactions that occurred on or before this week end
          while (txIndex < sortedTransactions.length) {
            const tx = sortedTransactions[txIndex];
            const txDate = new Date(tx.date);

            if (txDate <= weekEnd) {
              // Apply this transaction to running balance
              if (tx.type === 'income') {
                runningBalance += tx.amount;
              } else {
                runningBalance -= tx.amount;
              }
              txIndex++;
            } else {
              break; // This transaction is in the future for this week
            }
          }

          // Format label as "25 Aug"
          const day = weekEnd.getDate();
          const month = monthNames[weekEnd.getMonth()].slice(0, 3);

          // Show every 4th label (roughly 6-7 labels for 26 weeks)
          const showLabel = (25 - i) % 4 === 0 || i === 0; // Show first and every 4th

          points.push({
            date: weekEnd,
            balance: runningBalance,
            label: `${day} ${month}`,
            showLabel,
          });
        }
      }

      // Always ensure we have at least the current period showing
      if (points.length === 0) {
        const day = now.getDate();
        const month = monthNames[now.getMonth()].slice(0, 3);
        points.push({
          date: now,
          balance: acc.balance || 0,
          label: `${day} ${month}`,
          showLabel: true,
        });
      }

      return points;
    } catch (error) {
      console.error('Error calculating balance history:', error);
      // Return at least one point with current balance to prevent disappearing chart
      const now = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = now.getDate();
      const month = monthNames[now.getMonth()].slice(0, 3);
      return [{
        date: now,
        balance: acc.balance || 0,
        label: `${day} ${month}`,
        showLabel: true,
      }];
    }
  }, [acc, transactions, chartPeriod]);

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

    try {
      const accountTransactions = (transactions || []).filter(tx => tx.account === acc.name);
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
    } catch (error) {
      console.error('Error calculating stats:', error);
      return {
        totalIn: 0,
        totalOut: 0,
        netChange: 0,
        transactionCount: 0,
        lastMonthBalance: 0,
        monthlyChange: 0,
        monthlyChangePercent: 0,
      };
    }
  }, [acc, transactions, chartPeriod]);

  // Get recent transactions for this account
  const recentAccountTransactions = useMemo(() => {
    if (!acc || !transactions) return [];
    return transactions
      .filter(tx => tx.account === acc.name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions, acc]);

  // Handle opening transaction sheet
  const openTransactionSheet = (type: 'deposit' | 'withdraw', txId?: string) => {
    if (txId) {
      // Edit mode: pre-populate form
      const tx = transactions.find(t => t.id === txId);
      if (tx) {
        setEditingTransactionId(txId);
        setTransactionType(tx.type === 'income' ? 'deposit' : 'withdraw');
        setAmount(tx.amount.toString());
        setNote(tx.note || '');
        setTransactionDate(new Date(tx.date));
      }
    } else {
      // Create mode: clear form
      setEditingTransactionId(null);
      setTransactionType(type);
      setAmount('');
      setNote('');
      setTransactionDate(new Date());
    }
    setShowTransactionSheet(true);
  };

  // Handle transaction submission
  const handleSubmitTransaction = async () => {
    if (!acc || !amount || parseFloat(amount) <= 0) return;

    const amountNum = parseFloat(amount);
    const isDeposit = transactionType === 'deposit';

    try {
      if (editingTransactionId) {
        // Edit mode: update existing transaction
        const { updateTransaction } = useTxStore.getState();
        const oldTx = transactions.find(t => t.id === editingTransactionId);

        if (oldTx) {
          // Reverse old transaction's effect on balance
          const oldAmountChange = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
          await updateAccountBalance(acc.name, Math.abs(oldAmountChange), oldAmountChange > 0);

          // Update transaction
          await updateTransaction(editingTransactionId, {
            type: isDeposit ? 'income' : 'expense',
            amount: amountNum,
            category: isDeposit ? 'Deposit' : 'Withdrawal',
            account: acc.name,
            date: transactionDate.toISOString(),
            note: note || undefined,
          });

          // Apply new transaction's effect on balance
          await updateAccountBalance(acc.name, amountNum, !isDeposit);
        }
      } else {
        // Create mode: new transaction
        await addTx({
          type: isDeposit ? 'income' : 'expense',
          amount: amountNum,
          category: isDeposit ? 'Deposit' : 'Withdrawal',
          account: acc.name,
          date: transactionDate.toISOString(),
          note: note || undefined,
        });

        // Update account balance
        await updateAccountBalance(acc.name, amountNum, !isDeposit);
      }

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setShowTransactionSheet(false);
        setEditingTransactionId(null);
        setAmount('');
        setNote('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error submitting transaction:', error);
      if (isMountedRef.current) {
        // Could show an error message here
      }
    }
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
  const balances = balanceHistory.length > 0 ? balanceHistory.map(p => p.balance) : [0];
  const maxBalance = Math.max(...balances, 0);
  const minBalance = Math.min(...balances, 0);
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
              backgroundColor: withAlpha(accent, 0.15),
            }}
          >
            <Text style={{ color: accent, fontSize: 12, fontWeight: '700' }}>
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
              {(['day', 'week'] as const).map((period) => (
                <Pressable
                  key={period}
                  onPress={() => {
                    if (isMountedRef.current) {
                      setChartPeriod(period);
                      setSelectedBarIndex(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
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
                    {period === 'day' ? 'D' : 'W'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tooltip */}
          {selectedBarIndex !== null && selectedBarIndex < balanceHistory.length && balanceHistory[selectedBarIndex] && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 60,
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  alignItems: 'center',
                },
                tooltipAnimatedStyle
              ]}
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

          {/* Scrollable Bar Chart */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: spacing.s8, flexGrow: balanceHistory.length <= 15 ? 1 : 0 }}
            scrollEventThrottle={16}
            onScroll={(e) => {
              // Sync label scroll with bar chart scroll
              if (labelScrollRef.current) {
                labelScrollRef.current.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
              }
            }}
            ref={barScrollRef}
          >
            <View style={{ height: chartHeight, flex: balanceHistory.length <= 15 ? 1 : 0 }}>
              {/* Bar chart */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartHeight, gap: 4, flex: balanceHistory.length <= 15 ? 1 : 0 }}>
                {balanceHistory.map((point, index) => {
                  const normalizedBalance = range === 0 ? 0.5 : ((point.balance - minBalance + padding) / (range + padding * 2));
                  const barHeight = Math.max(normalizedBalance * chartHeight, 4);
                  const isPositive = point.balance >= 0;
                  const barColor = isPositive ? successColor : errorColor;

                  // Auto-size bar width: if <= 15 bars, fill screen; if > 15, use fixed width for scrolling
                  const barsToShow = Math.min(balanceHistory.length, 15);
                  const barWidth = balanceHistory.length <= 15
                    ? undefined // Use flex: 1 instead
                    : (chartWidth / 15) - 4;

                  return (
                    <View
                      key={`${chartPeriod}-${index}`}
                      style={balanceHistory.length <= 15 ? { flex: 1 } : { width: barWidth }}
                    >
                      <ChartBar
                        height={barHeight}
                        maxHeight={chartHeight}
                        color={barColor}
                        isSelected={selectedBarIndex === index}
                        delay={0}
                        onPress={() => {
                          if (isMountedRef.current) {
                            if (selectedBarIndex === index) {
                              setSelectedBarIndex(null);
                            } else {
                              setSelectedBarIndex(index);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                          }
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Labels - synchronized scrolling */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            contentContainerStyle={{ flexGrow: balanceHistory.length <= 15 ? 1 : 0 }}
            ref={labelScrollRef}
          >
            <View style={{ flexDirection: 'row', gap: 4, flex: balanceHistory.length <= 15 ? 1 : 0 }}>
              {balanceHistory.map((point, index) => {
                const barWidth = balanceHistory.length <= 15
                  ? undefined
                  : (chartWidth / 15) - 4;
                return (
                  <View
                    key={index}
                    style={balanceHistory.length <= 15
                      ? { flex: 1, alignItems: 'center' }
                      : { width: barWidth, alignItems: 'center' }
                    }
                  >
                    {point.showLabel && (
                      <Text style={{ color: selectedBarIndex === index ? text : muted, fontSize: 9, fontWeight: selectedBarIndex === index ? '700' : '600' }}>
                        {point.label}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
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
                  color: stats.netChange >= 0 ? successColor : dangerColor,
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
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {recentAccountTransactions.map((tx, idx) => (
              <SwipeableTransactionRow
                key={tx.id}
                tx={tx}
                isLast={idx === recentAccountTransactions.length - 1}
                onEdit={() => openTransactionSheet(tx.type === 'income' ? 'deposit' : 'withdraw', tx.id)}
                onDelete={async () => {
                  const { remove } = useTxStore.getState();
                  await remove(tx.id);
                  // Update account balance
                  const amountChange = tx.type === 'income' ? -tx.amount : tx.amount;
                  await updateAccountBalance(acc.name, Math.abs(amountChange), amountChange > 0);
                }}
              />
            ))}
          </Card>
        </View>
      )}


      {/* Transaction Bottom Sheet */}
      <BottomSheet
        visible={showTransactionSheet}
        onClose={() => {
          setShowTransactionSheet(false);
          setShowDatePicker(false);
          setShowTimeOverlay(false);
        }}
        fullHeight
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ gap: spacing.s20, paddingBottom: spacing.s16 }}>
          {/* Header */}
          <View>
            <Text style={{ color: text, fontSize: 24, fontWeight: '700' }}>
              {editingTransactionId
                ? `Edit ${transactionType === 'deposit' ? 'Deposit' : 'Withdrawal'}`
                : transactionType === 'deposit' ? 'Deposit Money' : 'Withdraw Money'}
            </Text>
            <Text style={{ color: muted, marginTop: spacing.s6 }}>
              {editingTransactionId
                ? `Update the ${transactionType === 'deposit' ? 'deposit' : 'withdrawal'} details`
                : transactionType === 'deposit'
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
            <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>Date & Time</Text>
            <Pressable
              onPress={() => {
                console.log('Calendar pressed, setting showDatePicker to true');
                setShowDatePicker(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => ({
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: outline,
                padding: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name="calendar" size={20} color={accent} />
              <Text style={{ color: text, fontSize: 16, fontWeight: '600' }}>
                {transactionDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
              <Text style={{ color: muted, fontSize: 14 }}>
                {transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              onPress={() => {
                setShowTransactionSheet(false);
                setEditingTransactionId(null);
              }}
              variant="secondary"
              style={{ flex: 1 }}
            />
            <Button
              title={editingTransactionId ? 'Save' : (transactionType === 'deposit' ? 'Deposit' : 'Withdraw')}
              onPress={handleSubmitTransaction}
              disabled={!amount || parseFloat(amount) <= 0}
              style={{ flex: 1 }}
            />
          </View>
        </View>
        </ScrollView>

        {/* Date & Time Picker Overlay - Outside ScrollView, Inside BottomSheet */}
        {showDatePicker && (
          <Animated.View
            pointerEvents="auto"
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.s16,
              zIndex: 1000,
            }}>
            {/* Transparent backdrop to catch outside taps */}
            <Pressable
              onPress={() => {
                setShowDatePicker(false);
                setShowTimeOverlay(false);
              }}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />

            <View
              pointerEvents="auto"
              style={{
                width: '100%',
                maxWidth: 400,
                backgroundColor: bgDefault,
                borderRadius: 20,
                paddingHorizontal: spacing.s8,
                paddingTop: spacing.s8,
                paddingBottom: spacing.s8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 24,
                elevation: 12,
              }}>
              {/* Date Picker */}
              <View style={{ alignItems: 'center' }}>
                <DateTimePicker
                  value={transactionDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setTransactionDate(selectedDate);
                    }
                  }}
                  themeVariant={isDark ? 'dark' : 'light'}
                />
              </View>

              {/* Time Selector Button */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                marginTop: spacing.s4,
                gap: spacing.s12,
                paddingHorizontal: spacing.s4,
              }}>
                <Pressable
                  onPress={() => setShowTimeOverlay(!showTimeOverlay)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.s8,
                    backgroundColor: cardBg,
                    paddingHorizontal: spacing.s16,
                    paddingVertical: spacing.s10,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: outline,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Icon name="clock" size={18} color={accent} />
                  <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                    {transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setShowDatePicker(false);
                    setShowTimeOverlay(false);
                  }}
                  style={({ pressed }) => ({
                    backgroundColor: accent,
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.s20,
                    paddingVertical: spacing.s10,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: isDark ? text : 'white', fontSize: 15, fontWeight: '700' }}>
                    Done
                  </Text>
                </Pressable>
              </View>

              {/* Time Picker Overlay */}
              {showTimeOverlay && (
                <View style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: [{ translateX: -140 }, { translateY: -125 }],
                  width: 280,
                  backgroundColor: bgDefault,
                  borderRadius: 16,
                  padding: spacing.s16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 10,
                }}>
                  <TouchableWithoutFeedback>
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ height: 180, justifyContent: 'center', width: '100%' }}>
                        <DateTimePicker
                          value={transactionDate}
                          mode="time"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              setTransactionDate(selectedDate);
                            }
                          }}
                          themeVariant={isDark ? 'dark' : 'light'}
                        />
                      </View>

                      <View style={{
                        flexDirection: 'row',
                        gap: spacing.s10,
                        marginTop: spacing.s12,
                        width: '100%',
                      }}>
                        <Pressable
                          onPress={() => {
                            const now = new Date();
                            setTransactionDate(now);
                          }}
                          style={({ pressed }) => ({
                            flex: 1,
                            backgroundColor: cardBg,
                            paddingVertical: spacing.s10,
                            borderRadius: radius.md,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: outline,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Text style={{ color: accent, fontSize: 14, fontWeight: '600' }}>
                            Now
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setShowTimeOverlay(false)}
                          style={({ pressed }) => ({
                            flex: 1,
                            backgroundColor: accent,
                            paddingVertical: spacing.s10,
                            borderRadius: radius.md,
                            alignItems: 'center',
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          <Text style={{ color: isDark ? text : 'white', fontSize: 14, fontWeight: '700' }}>
                            Done
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </BottomSheet>
    </ScreenScroll>
  );
}
