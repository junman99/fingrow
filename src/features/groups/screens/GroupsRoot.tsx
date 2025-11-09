import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { FlatList, View, Text, Pressable, Animated, Alert, ScrollView } from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, useAnimatedScrollHandler, interpolate, Extrapolate } from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../../../components/Screen';
import Button from '../../../components/Button';
import Icon, { IconName } from '../../../components/Icon';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius, elevation } from '../../../theme/tokens';
import { useGroupsStore } from '../store';
import { useProfileStore } from '../../../store/profile';
import { useTxStore } from '../../../store/transactions';
import { useAccountsStore } from '../../../store/accounts';
import { formatCurrency, sum } from '../../../lib/format';
import type { ID } from '../../../types/groups';
import BottomSheet from '../../../components/BottomSheet';
import { getDefaultAccount } from '../utils/transactionIntegration';

// Settlement Transfer Row with Smooth Bubble Animation
const SettlementTransferRow: React.FC<{
  fromInitials: string;
  toInitials: string;
  amount: number;
  warningColor: string;
  successColor: string;
  accentPrimary: string;
  textPrimary: string;
  textMuted: string;
  surface2: string;
  isDark: boolean;
  formatCurrency: (n: number) => string;
  onComplete: () => void;
  completed: boolean;
}> = ({ fromInitials, toInitials, amount, warningColor, successColor, accentPrimary, textPrimary, textMuted, surface2, isDark, formatCurrency, onComplete, completed }) => {
  const [isPaid, setIsPaid] = useState(completed);

  // Reanimated values for smooth animation
  const translateX = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const opacity = useSharedValue(1);

  const flowAnim = useRef(new Animated.Value(0)).current;
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isPaid) return;

    // Start flow animation
    Animated.loop(
      Animated.timing(flowAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false
      })
    ).start();

    // Start dot animations with delays
    Animated.loop(
      Animated.timing(dotAnim1, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(dotAnim2, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(dotAnim3, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [isPaid]);

  const withAlphaLocal = (hex: string, alpha: number) => {
    if (!hex || typeof hex !== 'string') return hex;
    if (hex.startsWith('#')) {
      const clean = hex.slice(1, 7);
      const padded = clean.length === 6 ? clean : clean.padEnd(6, '0');
      const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
      return `#${padded}${a}`;
    }
    return hex;
  };

  const dotAnims = [dotAnim1, dotAnim2, dotAnim3];

  // Gesture handler
  const gesture = Gesture.Pan()
    .enabled(!isPaid)
    .onUpdate((event) => {
      const dragX = Math.max(0, event.translationX);
      translateX.value = dragX;

      // Bubble stretch effect
      scaleX.value = 1 + (dragX / 80);
      scaleY.value = Math.max(0.8, 1 - (dragX / 200));
      opacity.value = Math.max(0.5, 1 - (dragX / 150));
    })
    .onEnd((event) => {
      if (event.translationX > 100) {
        // Pop animation
        translateX.value = withSpring(150, { damping: 8 });
        scaleX.value = withSpring(3, { damping: 8 });
        scaleY.value = withSpring(3, { damping: 8 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(setIsPaid)(true);
          runOnJS(onComplete)();
        });
      } else {
        // Snap back with elastic
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        scaleX.value = withSpring(1, { damping: 15, stiffness: 150 });
        scaleY.value = withSpring(1, { damping: 15, stiffness: 150 });
        opacity.value = withSpring(1);
      }
    });

  // Animated style for icon
  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <View style={{
      borderRadius: radius.lg,
      marginBottom: spacing.s8,
      overflow: 'visible',
      position: 'relative'
    }}>
      {/* Main content */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.s10,
          paddingHorizontal: spacing.s12,
          backgroundColor: isPaid ? withAlphaLocal(successColor, 0.2) : surface2,
          borderRadius: radius.lg,
          opacity: isPaid ? 0.6 : 1
        }}
      >
        {/* Animated gradient background */}
        {!isPaid && (
          <Animated.View style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '100%',
            borderRadius: radius.lg,
            opacity: flowAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, 0.3, 0]
            }),
            transform: [{
              translateX: flowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-300, 300]
              })
            }]
          }}>
            <View style={{
              flex: 1,
              backgroundColor: isDark
                ? 'rgba(255, 153, 51, 0.15)'
                : 'rgba(251, 146, 60, 0.15)'
            }} />
          </Animated.View>
        )}

        {/* From member - Animated with Gesture */}
        <GestureDetector gesture={gesture}>
          <AnimatedReanimated.View
            style={[
              {
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isPaid ? withAlphaLocal(successColor, 0.3) : withAlphaLocal(warningColor, isDark ? 0.25 : 0.2),
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: isPaid ? successColor : warningColor,
                zIndex: 2,
              },
              animatedIconStyle
            ]}
          >
            {isPaid ? (
              <Text style={{ fontSize: 16 }}>✓</Text>
            ) : (
              <Text style={{ color: warningColor, fontSize: 12, fontWeight: '800' }}>
                {fromInitials}
              </Text>
            )}
          </AnimatedReanimated.View>
        </GestureDetector>

        {/* Amount and flow line with animated dots */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.s12, zIndex: 1 }}>
          <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '700', marginBottom: spacing.s4 }}>
            {formatCurrency(amount)}
          </Text>
          <View style={{ width: '100%', height: 2, backgroundColor: withAlphaLocal(textMuted, 0.2), position: 'relative' }}>
            {/* Animated flowing dots */}
            {!isPaid && dotAnims.map((dotAnim, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: -2,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: accentPrimary,
                  transform: [
                    {
                      translateX: dotAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 200]
                      })
                    }
                  ],
                  opacity: dotAnim.interpolate({
                    inputRange: [0, 0.2, 0.8, 1],
                    outputRange: [0, 1, 1, 0]
                  })
                }}
              />
            ))}
          </View>
        </View>

        {/* To member */}
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isPaid ? withAlphaLocal(successColor, 0.3) : withAlphaLocal(successColor, isDark ? 0.25 : 0.2),
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: successColor,
          zIndex: 2
        }}>
          <Text style={{ color: successColor, fontSize: 12, fontWeight: '800' }}>
            {toInitials}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default function GroupsRoot() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { groups, hydrate, balances, addSettlement } = useGroupsStore();
  const { add: addTransaction } = useTxStore();
  const { accounts } = useAccountsStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const settleUpFadeAnim = useRef(new Animated.Value(0)).current;
  const [settleUpGroupId, setSettleUpGroupId] = useState<string | null>(null);
  const [settleUpGroupIdVisible, setSettleUpGroupIdVisible] = useState<string | null>(null);
  const [completedPayments, setCompletedPayments] = useState<Set<number>>(new Set());

  // Account selection for settlements
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [pendingSettlement, setPendingSettlement] = useState<{ idx: number; edge: any } | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(() => {
    const defaultAcc = getDefaultAccount();
    return defaultAcc?.id || null;
  });

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Animate settle up modal
  useEffect(() => {
    if (settleUpGroupId) {
      setSettleUpGroupIdVisible(settleUpGroupId);
      Animated.timing(settleUpFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(settleUpFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setSettleUpGroupIdVisible(null);
      });
    }
  }, [settleUpGroupId]);

  useFocusEffect(useCallback(() => { hydrate(); }, [hydrate]));

  const [filterTab, setFilterTab] = useState<'all' | 'unsettled'>('all');
  const meName = (useProfileStore.getState().profile.name || '').trim().toLowerCase();

  // Main Tab Title Animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Original title animation (fades out)
  const originalTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity: 1 - progress,
    };
  });

  // Floating title animation (fades in, shrinks)
  const floatingTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    const fontSize = interpolate(progress, [0, 1], [28, 20]);
    const fontWeight = interpolate(progress, [0, 1], [800, 700]);

    return {
      fontSize,
      fontWeight: fontWeight.toString() as any,
      opacity: progress >= 1 ? 1 : progress,
    };
  });

  // Gradient background animation
  const gradientAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity: progress >= 1 ? 1 : progress,
    };
  });

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnSurface = get('text.onSurface') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const backgroundDefault = get('background.default') as string;

  const data = useMemo(() => {
    const arr = [...groups].map(g => {
      const bal = balances(g.id);
      const pos = Object.values(bal || {}).filter(v => v > 0);
      const unsettled = sum(pos.map(v => Math.abs(v)));
      const lastBill = Math.max(0, ...(g.bills || []).map(b => b.createdAt || 0));
      const lastSettle = Math.max(0, ...(g.settlements || []).map(s => s.createdAt || 0));
      const last = Math.max(g.createdAt || 0, lastBill, lastSettle);
      return { ...g, unsettled, last };
    });
    return arr.sort((a: any, b: any) => {
      const aU = a.unsettled > 0.009 ? 1 : 0;
      const bU = b.unsettled > 0.009 ? 1 : 0;
      if (aU !== bU) return bU - aU;
      return (b.last || 0) - (a.last || 0);
    });
  }, [groups, balances]);

  const filteredData = useMemo(() => (
    filterTab === 'unsettled' ? data.filter((g: any) => g.unsettled > 0.009) : data
  ), [data, filterTab]);

  const totals = useMemo(() => {
    let youOwe = 0, theyOwe = 0, matched = 0;
    for (const g of data) {
      const bal = balances(g.id);
      const me = (g.members || []).find((m: any) => (m.name || '').trim().toLowerCase() === meName);
      if (!me) continue;
      matched++;
      const v = bal[me.id] || 0;
      if (v < -0.009) youOwe += Math.abs(v);
      else if (v > 0.009) theyOwe += v;
    }
    return { youOwe, theyOwe, matched };
  }, [data, balances, meName]);

  const summary = useMemo(() => {
    const unsettledGroups = data.filter(g => g.unsettled > 0.009);
    const totalOutstanding = sum(data.map(g => g.unsettled));
    return { unsettledCount: unsettledGroups.length, totalOutstanding };
  }, [data]);

  const MetricCard = ({ icon, label, value, caption }: { icon: IconName; label: string; value: string; caption?: string }) => (
    <View
      style={{
        flexGrow: 1,
        minWidth: 150,
        padding: spacing.s12,
        borderRadius: radius.lg,
        backgroundColor: surface2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s6 }}>
        <View style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: withAlpha(accentPrimary, isDark ? 0.20 : 0.12),
          alignItems: 'center', justifyContent: 'center', marginRight: spacing.s8
        }}>
          <Icon name={icon} size={18} colorToken="accent.primary" />
        </View>
        <Text style={{ color: textMuted, fontWeight: '600' }}>{label}</Text>
      </View>
      <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      {caption ? <Text style={{ color: textMuted, marginTop: 4, fontSize: 12 }}>{caption}</Text> : null}
    </View>
  );

  const renderAvatarStack = (names: string[]) => {
    const cols = [
      withAlpha(accentPrimary, isDark ? 0.30 : 0.20),
      withAlpha(accentSecondary, isDark ? 0.30 : 0.20),
      withAlpha(accentPrimary, isDark ? 0.20 : 0.15)
    ];
    return (
      <View style={{ width: 60, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        {names.slice(0, 3).map((n, i) => {
          const initials = n.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
          return (
            <View key={i} style={{
              position: 'absolute',
              left: i * 14,
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: cols[i],
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: textPrimary, fontSize: 12, fontWeight: '700' }}>{initials}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Calculate settlement plan (who pays who)
  const calculateSettlementPlan = (groupId: string) => {
    type Edge = { fromId: ID; toId: ID; amount: number };
    const groupBal = balances(groupId);
    const creditors: { id: ID; amt: number }[] = [];
    const debtors: { id: ID; amt: number }[] = [];

    Object.entries(groupBal).forEach(([id, v]) => {
      const val = Math.round((v as number) * 100) / 100;
      if (val > 0.009) creditors.push({ id: id as ID, amt: val });
      else if (val < -0.009) debtors.push({ id: id as ID, amt: -val });
    });

    creditors.sort((a, b) => b.amt - a.amt);
    debtors.sort((a, b) => b.amt - a.amt);

    const edges: Edge[] = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const x = Math.min(d.amt, c.amt);
      edges.push({ fromId: d.id, toId: c.id, amount: Math.round(x * 100) / 100 });
      d.amt = Math.round((d.amt - x) * 100) / 100;
      c.amt = Math.round((c.amt - x) * 100) / 100;
      if (d.amt === 0) i++;
      if (c.amt === 0) j++;
    }

    return edges;
  };

  const recordTransfers = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const settlementPlan = calculateSettlementPlan(groupId);

    if (settlementPlan.length === 0) {
      Alert.alert('All settled', 'No transfers needed.');
      return;
    }

    try {
      const myMember = group.members.find((m: any) => (m.name || '').trim().toLowerCase() === meName);

      // Record each settlement
      for (const edge of settlementPlan) {
        await addSettlement(group.id, edge.fromId, edge.toId, edge.amount);

        // If I'm involved in this transfer, create a transaction in spending ledger
        if (myMember && (edge.fromId === myMember.id || edge.toId === myMember.id)) {
          const fromMember = group.members.find((m: any) => m.id === edge.fromId);
          const toMember = group.members.find((m: any) => m.id === edge.toId);

          if (edge.fromId === myMember.id) {
            // I'm paying someone - create expense transaction
            await addTransaction({
              type: 'expense',
              amount: edge.amount,
              category: 'Shared Bill',
              date: new Date().toISOString(),
              note: `Payment to ${toMember?.name || 'member'} - ${group.name}`
            });
          } else if (edge.toId === myMember.id) {
            // Someone is paying me - create income transaction
            await addTransaction({
              type: 'income',
              amount: edge.amount,
              category: 'Shared Bill',
              date: new Date().toISOString(),
              note: `Payment from ${fromMember?.name || 'member'} - ${group.name}`
            });
          }
        }
      }

      setSettleUpGroupId(null);
      await hydrate(); // Refresh group data
      Alert.alert('Success', 'Transfers recorded successfully!');
    } catch (e: any) {
      Alert.alert('Error', e?.message || String(e));
    }
  };

  const Row = ({ item }: { item: any }) => {
    const activeMembers = item.members.filter((m: any) => !m.archived);
    const settled = item.unsettled <= 0.009;
    const balanceMap = balances(item.id) || {};
    const me = (activeMembers || []).find((m: any) => (m.name || '').trim().toLowerCase() === meName);
    const myShare = me ? balanceMap[me.id] || 0 : 0;
    const myShareLabel = !me
      ? 'Not a member'
      : myShare > 0.009
        ? `You are owed ${formatCurrency(myShare)}`
        : myShare < -0.009
          ? `You owe ${formatCurrency(Math.abs(myShare))}`
          : 'Settled up';
    const myShareColor = myShare > 0.009
      ? get('semantic.success') as string
      : myShare < -0.009
        ? get('semantic.warning') as string
        : textMuted;

    // Render mini avatar stack (smaller, inline with title)
    const renderMiniAvatarStack = (names: string[]) => {
      const displayed = names.slice(0, 3);
      const remaining = Math.max(0, names.length - 3);

      return (
        <View style={{ flexDirection: 'row', marginRight: spacing.s8 }}>
          {displayed.map((name, i) => {
            const initials = name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
            return (
              <View
                key={i}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                  borderWidth: 2,
                  borderColor: surface1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: i > 0 ? -8 : 0
                }}
              >
                <Text style={{ color: accentPrimary, fontSize: 9, fontWeight: '800' }}>{initials}</Text>
              </View>
            );
          })}
          {remaining > 0 && (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: surface2,
                borderWidth: 2,
                borderColor: surface1,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: -8
              }}
            >
              <Text style={{ color: textMuted, fontSize: 9, fontWeight: '800' }}>+{remaining}</Text>
            </View>
          )}
        </View>
      );
    };

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => nav.navigate('GroupDetail', { groupId: item.id })}
        style={({ pressed }) => [
          {
            backgroundColor: surface1,
            borderRadius: radius.xl,
            paddingVertical: spacing.s14,
            paddingHorizontal: spacing.s16,
            marginBottom: spacing.s12,
            overflow: 'hidden',
            opacity: pressed ? 0.95 : 1
          },
          elevation.level1 as any
        ]}
      >
        {!settled && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: 4,
            backgroundColor: accentSecondary
          }} />
        )}

        <View style={{ gap: spacing.s12 }}>
          {/* Group name with mini avatars and balance status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.s8 }}>
              {renderMiniAvatarStack(activeMembers.map((m: any) => m.name))}
              <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17, flex: 1 }} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            {me && (
              <Text style={{ color: myShareColor, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                {myShareLabel}
              </Text>
            )}
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <Button
              size="sm"
              variant="secondary"
              title="Add bill"
              onPress={() => nav.navigate('AddBill', { groupId: item.id })}
              style={{ flex: 1 }}
            />
            {!settled && (
              <Button
                size="sm"
                variant="primary"
                title="Settle up"
                onPress={() => setSettleUpGroupId(item.id)}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      {/* Main Tab Title Animation - Floating Gradient Header (Fixed at top, outside scroll) */}
      <AnimatedReanimated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            pointerEvents: 'none',
          },
          gradientAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={[
            backgroundDefault,
            backgroundDefault,
            withAlpha(backgroundDefault, 0.95),
            withAlpha(backgroundDefault, 0.8),
            withAlpha(backgroundDefault, 0.5),
            withAlpha(backgroundDefault, 0)
          ]}
          style={{
            paddingTop: insets.top + spacing.s16,
            paddingBottom: spacing.s32 + spacing.s20,
            paddingHorizontal: spacing.s16,
          }}
        >
          <AnimatedReanimated.Text
            style={[
              {
                color: textPrimary,
                fontSize: 20,
                fontWeight: '700',
                letterSpacing: -0.5,
                textAlign: 'center',
              },
              floatingTitleAnimatedStyle,
            ]}
          >
            Shared bills
          </AnimatedReanimated.Text>
        </LinearGradient>
      </AnimatedReanimated.View>

      <Screen inTab>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <AnimatedReanimated.FlatList
            data={filteredData}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }) => <Row item={item} />}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingHorizontal: spacing.s16,
              paddingTop: spacing.s16,
              paddingBottom: spacing.s32,
            }}
            ListHeaderComponentStyle={{ marginBottom: spacing.s16 }}
            ListHeaderComponent={(
            <View style={{ paddingTop: spacing.s12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8, marginBottom: spacing.s8 }}>
                  <Pressable
                    onPress={() => nav.goBack()}
                    style={({ pressed }) => ({
                      padding: spacing.s8,
                      marginLeft: -spacing.s8,
                      marginTop: -spacing.s4,
                      borderRadius: radius.md,
                      backgroundColor: pressed ? surface1 : 'transparent',
                    })}
                    hitSlop={8}
                  >
                    <Icon name="chevron-left" size={28} color={textPrimary} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <AnimatedReanimated.Text
                      style={[
                        {
                          color: textPrimary,
                          fontSize: 28,
                          fontWeight: '800',
                          letterSpacing: -0.5,
                          marginTop: spacing.s2,
                        },
                        originalTitleAnimatedStyle,
                      ]}
                    >
                      Shared bills
                    </AnimatedReanimated.Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12, marginBottom: spacing.s8 }}>
                  <MetricCard
                    icon="users-2"
                    label="Groups"
                    value={`${data.length}`}
                    caption={summary.unsettledCount > 0 ? `${summary.unsettledCount} need attention` : 'All squared up'}
                  />
                  <MetricCard
                    icon="receipt"
                    label="Outstanding"
                    value={formatCurrency(summary.totalOutstanding)}
                    caption={summary.unsettledCount > 0 ? `Across ${summary.unsettledCount} group(s)` : 'Nothing unsettled'}
                  />
                  <MetricCard
                    icon="wallet"
                    label="You owe"
                    value={totals.youOwe > 0.009 ? formatCurrency(totals.youOwe) : 'All clear'}
                    caption={totals.youOwe > 0.009 ? 'Plan a settle-up soon' : 'No paybacks pending'}
                  />
                  <MetricCard
                    icon="trending-up"
                    label="Owed to you"
                    value={totals.theyOwe > 0.009 ? formatCurrency(totals.theyOwe) : 'All clear'}
                    caption={totals.theyOwe > 0.009 ? 'Give your pals a nudge' : 'Nothing outstanding'}
                  />
                </View>

              <View style={{
                marginTop: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s8,
              }}>
                <View style={{
                  backgroundColor: surface1,
                  borderRadius: radius.pill,
                  padding: spacing.s4,
                  flexDirection: 'row',
                  flex: 1,
                }}>
                  <Pressable
                    onPress={() => setFilterTab('all')}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s6,
                      paddingHorizontal: spacing.s16,
                      borderRadius: radius.pill,
                      backgroundColor: filterTab === 'all' ? accentPrimary : surface1,
                      opacity: pressed ? 0.85 : 1,
                      flex: 1,
                    })}
                  >
                    <Text style={{ color: filterTab === 'all' ? textOnPrimary : textPrimary, fontWeight: '600', textAlign: 'center' }}>
                      All groups ({data.length})
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFilterTab('unsettled')}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s6,
                      paddingHorizontal: spacing.s16,
                      borderRadius: radius.pill,
                      backgroundColor: filterTab === 'unsettled' ? accentPrimary : surface1,
                      opacity: pressed ? 0.85 : 1,
                      flex: 1,
                    })}
                  >
                    <Text style={{ color: filterTab === 'unsettled' ? textOnPrimary : textPrimary, fontWeight: '600', textAlign: 'center' }}>
                      Needs attention ({summary.unsettledCount})
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => nav.navigate('CreateGroup')}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.pill,
                    backgroundColor: accentPrimary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="plus" size={20} color={textOnPrimary} />
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={{ marginTop: spacing.s24 }}>
              <View style={{
                borderRadius: radius.xl,
                backgroundColor: surface1,
                padding: spacing.s16,
                ...(elevation.level1 as any)
              }}>
                <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18, marginBottom: spacing.s8 }}>
                  {data.length === 0 ? 'Create your first group' : 'Everything is settled'}
                </Text>
                <Text style={{ color: textMuted, marginBottom: spacing.s16 }}>
                  {data.length === 0
                    ? 'Start a group to split shared bills and track balances in one beautiful view.'
                    : 'No groups need attention right now. Switch back to all groups to keep exploring.'}
                </Text>
                {data.length === 0 ? (
                  <Button title="Create group" onPress={() => nav.navigate('CreateGroup')} />
                ) : (
                  <Button variant="secondary" title="View all groups" onPress={() => setFilterTab('all')} />
                )}
              </View>
            </View>
          )}
          />
        </Animated.View>
      </Screen>

      {/* Settle Up Modal */}
      {(() => {
        if (!settleUpGroupIdVisible) return null;

        const group = groups.find(g => g.id === settleUpGroupIdVisible);
        if (!group) return null;

        const settlementPlan = calculateSettlementPlan(settleUpGroupIdVisible);
        const groupBal = balances(settleUpGroupIdVisible) || {};
        const posVals = Object.values(groupBal).filter(v => (v as number) > 0);
        const unsettledTotal = posVals.reduce((a: number, b: any) => a + Math.abs(b as number), 0);

        const successColor = get('semantic.success') as string;
        const warningColor = get('semantic.warning') as string;

        return (
          <Animated.View
            pointerEvents={settleUpGroupId ? 'auto' : 'none'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.s20,
              zIndex: 100,
              opacity: settleUpFadeAnim
            }}
          >
            <Pressable
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              onPress={() => setSettleUpGroupId(null)}
            />
            <Animated.View
              style={{
                width: '100%',
                maxWidth: 400,
                maxHeight: '80%',
                backgroundColor: get('background.default') as string,
                borderRadius: 24,
                padding: spacing.s16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 20 },
                shadowOpacity: 0.4,
                shadowRadius: 32,
                elevation: 20,
                opacity: settleUpFadeAnim,
                transform: [
                  {
                    scale: settleUpFadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1]
                    })
                  }
                ]
              }}
            >
              {/* Close button */}
              <Pressable
                onPress={() => setSettleUpGroupId(null)}
                style={({ pressed }) => ({
                  position: 'absolute',
                  top: spacing.s12,
                  right: spacing.s12,
                  padding: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: surface2,
                  opacity: pressed ? 0.6 : 1,
                  zIndex: 10
                })}
              >
                <Icon name="x" size={18} color={textMuted} />
              </Pressable>

              {/* Icon & Title */}
              <View style={{ alignItems: 'center', marginBottom: spacing.s12 }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: withAlpha(successColor, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.s10
                }}>
                  <Text style={{ fontSize: 28 }}>🎉</Text>
                </View>
                <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', marginBottom: spacing.s4, textAlign: 'center' }}>
                  Settle Up
                </Text>
                <Text style={{ color: textMuted, fontSize: 13, textAlign: 'center' }}>
                  Outstanding: {formatCurrency(unsettledTotal)}
                </Text>
              </View>

              {/* Settlement plan - who pays who */}
              <ScrollView
                style={{ maxHeight: 350, marginBottom: 70 }}
                showsVerticalScrollIndicator={false}
              >
                {settlementPlan.map((edge, idx) => {
                  const fromMember = group.members.find((m: any) => m.id === edge.fromId);
                  const toMember = group.members.find((m: any) => m.id === edge.toId);
                  const fromInitials = fromMember?.name.trim().split(/\s+/).slice(0, 2).map((p: string) => p[0]?.toUpperCase() || '').join('') || '?';
                  const toInitials = toMember?.name.trim().split(/\s+/).slice(0, 2).map((p: string) => p[0]?.toUpperCase() || '').join('') || '?';

                  return (
                    <SettlementTransferRow
                      key={idx}
                      fromInitials={fromInitials}
                      toInitials={toInitials}
                      amount={edge.amount}
                      warningColor={warningColor}
                      successColor={successColor}
                      accentPrimary={accentPrimary}
                      textPrimary={textPrimary}
                      textMuted={textMuted}
                      surface2={surface2}
                      isDark={isDark}
                      formatCurrency={formatCurrency}
                      completed={completedPayments.has(idx)}
                      onComplete={() => {
                        // If trackSpending is enabled and accounts exist, show account selection sheet
                        if (group.trackSpending && accounts.length > 0) {
                          setPendingSettlement({ idx, edge });
                          setShowAccountSheet(true);
                        } else {
                          // trackSpending is off or no accounts, just mark as completed
                          setCompletedPayments(prev => new Set(prev).add(idx));
                        }
                      }}
                    />
                  );
                })}
              </ScrollView>

              {/* Floating Action button */}
              <View style={{
                position: 'absolute',
                bottom: spacing.s16,
                left: spacing.s16,
                right: spacing.s16
              }}>
                <Pressable
                  onPress={() => settleUpGroupIdVisible && recordTransfers(settleUpGroupIdVisible)}
                  style={({ pressed }) => ({
                    backgroundColor: accentPrimary,
                    paddingVertical: spacing.s14,
                    borderRadius: radius.lg,
                    alignItems: 'center',
                    shadowColor: accentPrimary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                    opacity: pressed ? 0.85 : 1
                  })}
                >
                  <Text style={{ color: textOnPrimary, fontSize: 16, fontWeight: '700' }}>
                    Record All Transfers
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        );
      })()}

      {/* Account Selection Sheet for Settlements */}
      <BottomSheet visible={showAccountSheet} onClose={() => {
        setShowAccountSheet(false);
        setPendingSettlement(null);
      }}>
        <View style={{ paddingVertical: spacing.s16 }}>
          <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', marginBottom: spacing.s8, paddingHorizontal: spacing.s16 }}>
            Select Account
          </Text>
          <Text style={{ color: textMuted, fontSize: 14, marginBottom: spacing.s20, paddingHorizontal: spacing.s16 }}>
            Where did you receive this payment?
          </Text>
          {accounts.map((account) => (
            <Pressable
              key={account.id}
              onPress={async () => {
                if (!pendingSettlement) return;

                setSelectedAccount(account.id);
                setShowAccountSheet(false);

                // Mark as completed
                setCompletedPayments(prev => new Set(prev).add(pendingSettlement.idx));

                // Record the settlement with transaction integration
                const group = groups.find(g => g.id === settleUpGroupId);
                // TODO: Get actual current user ID
                const currentUserId = group?.members[0]?.id;
                if (group && currentUserId) {
                  try {
                    await addSettlement(
                      group.id,
                      pendingSettlement.edge.fromId,
                      pendingSettlement.edge.toId,
                      pendingSettlement.edge.amount,
                      undefined,
                      undefined,
                      account.id,
                      currentUserId
                    );
                  } catch (error) {
                    console.error('Failed to record settlement:', error);
                  }
                }

                setPendingSettlement(null);
              }}
              style={({ pressed }) => ({
                paddingVertical: spacing.s14,
                paddingHorizontal: spacing.s16,
                backgroundColor: selectedAccount === account.id ? withAlpha(accentPrimary, 0.1) : 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: selectedAccount === account.id ? accentPrimary : textPrimary, fontSize: 16, fontWeight: selectedAccount === account.id ? '700' : '500' }}>
                    {account.name}
                  </Text>
                  {account.kind && (
                    <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                      {account.kind.charAt(0).toUpperCase() + account.kind.slice(1)}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: selectedAccount === account.id ? accentPrimary : textPrimary, fontSize: 15, fontWeight: '600' }}>
                    {formatCurrency(account.balance)}
                  </Text>
                  {selectedAccount === account.id && (
                    <Icon name="check" size={20} colorToken="accent.primary" />
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return d === 1 ? '1 day ago' : `${d} days ago`;
  if (h >= 1) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  if (m >= 1) return m === 1 ? '1 min ago' : `${m} mins ago`;
  return 'just now';
}

function withAlpha(hex: string, alpha: number) {
  if (!hex || typeof hex !== 'string') return hex;
  if (hex.startsWith('#')) {
    const clean = hex.slice(1, 7);
    const padded = clean.length === 6 ? clean : clean.padEnd(6, '0');
    const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
    return `#${padded}${a}`;
  }
  return hex;
}
