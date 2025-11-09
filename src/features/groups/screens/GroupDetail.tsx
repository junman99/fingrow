import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, Animated, Alert, Share } from 'react-native';
import { GestureDetector, Gesture, Swipeable } from 'react-native-gesture-handler';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, useAnimatedScrollHandler, interpolate, Extrapolate, withDecay } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../../../components/ScreenScroll';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import { useGroupsStore } from '../store';
import { useProfileStore } from '../../../store/profile';
import { useTxStore } from '../../../store/transactions';
import { formatCurrency } from '../../../lib/format';
import BottomSheet from '../../../components/BottomSheet';
import ManageMembersSheet from '../components/ManageMembersSheet';
import type { ID } from '../../../types/groups';
import type { GroupsStackParamList } from '../../../navigation/GroupsNavigator';

const fmtTime = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = ((h % 12) || 12).toString();
  const mm = m.toString().padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hh}:${mm} ${ampm}`;
};

const sectionLabel = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yest)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

function withAlpha(hex: string, alpha: number) {
  if (!hex || typeof hex !== 'string') return hex;
  if (hex.startsWith('#')) {
    const clean = hex.slice(1, 7);
    const padded = clean.length === 6 ? clean : clean.padEnd(6, '0');
    const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
    return `#${padded}${a}`;
  }
  if (hex.startsWith('rgba')) {
    return hex.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
      const parts = inner.split(',').map(p => p.trim());
      if (parts.length < 3) return hex;
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }
  return hex;
}


// Animated Pressable component for cards
const AnimatedPressable: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}> = ({ onPress, children, style }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Settlement Transfer Row with Swipe to Complete
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

  const withAlpha = (hex: string, alpha: number) => {
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
          backgroundColor: isPaid ? withAlpha(successColor, 0.2) : surface2,
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

        {/* From member - Animated */}
        <GestureDetector gesture={gesture}>
          <AnimatedReanimated.View
            style={[
              {
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isPaid ? withAlpha(successColor, 0.3) : withAlpha(warningColor, isDark ? 0.25 : 0.2),
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
          <View style={{ width: '100%', height: 2, backgroundColor: withAlpha(textMuted, 0.2), position: 'relative' }}>
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
          backgroundColor: isPaid ? withAlpha(successColor, 0.3) : withAlpha(successColor, isDark ? 0.25 : 0.2),
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

export default function GroupDetail() {
  const nav = useNavigation<NativeStackNavigationProp<GroupsStackParamList>>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, hydrate, balances, deleteGroup, deleteBill, addSettlement, markSplitPaid, findBill } = useGroupsStore();
  const { add: addTransaction } = useTxStore();
  const { get, isDark } = useThemeTokens();
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedMemberVisible, setSelectedMemberVisible] = useState<any>(null);
  const [showMembersList, setShowMembersList] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSettleUpCard, setShowSettleUpCard] = useState(false);
  const [showSettleUpCardVisible, setShowSettleUpCardVisible] = useState(false);
  const [completedPayments, setCompletedPayments] = useState<Set<number>>(new Set());
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const settleUpFadeAnim = useRef(new Animated.Value(0)).current;
  const memberModalFadeAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Animate settle up modal
  useEffect(() => {
    if (showSettleUpCard) {
      setShowSettleUpCardVisible(true);
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
        setShowSettleUpCardVisible(false);
      });
    }
  }, [showSettleUpCard]);

  // Animate member modal
  useEffect(() => {
    if (selectedMember) {
      setSelectedMemberVisible(selectedMember);
      Animated.timing(memberModalFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(memberModalFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setSelectedMemberVisible(null);
      });
    }
  }, [selectedMember]);

  useFocusEffect(React.useCallback(() => { hydrate(); }, [hydrate]));
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    return (
      <ScreenScroll>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>Group</Text>
          <Text style={{ color: get('text.muted') as string }}>Group not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  const groupBal = balances(group.id) || {};
  const membersActive = group.members.filter(m => !m.archived);

  const posVals = Object.values(groupBal || {}).filter(v => (v as number) > 0);
  const unsettledTotal = posVals.reduce((a: number, b: any) => a + Math.abs(b as number), 0);

  const meName = (useProfileStore.getState().profile.name || '').trim().toLowerCase();
  const me = (group.members || []).find((m: any) => (m.name || '').trim().toLowerCase() === meName);

  const myId = me?.id;
  let youOwe = 0;
  let theyOwe = 0;

  if (me && groupBal) {
    const v = groupBal[me.id] || 0;
    if (v < -0.009) youOwe = Math.abs(v);
    else if (v > 0.009) theyOwe = v;
  }

  const billVM = (group.bills || []).map(b => {
    const d = new Date(b.createdAt || Date.now());
    const myShare = (b.splits || []).find(s => s.memberId === myId)?.share || 0;
    const myContrib = (b.contributions || []).filter(c => c.memberId === myId).reduce((acc, c) => acc + c.amount, 0);
    const inflows = (group.settlements || []).filter(s => s.billId === b.id && s.toId === myId).reduce((acc, s) => acc + s.amount, 0);
    const outflows = (group.settlements || []).filter(s => s.billId === b.id && s.fromId === myId).reduce((acc, s) => acc + s.amount, 0);
    const outstanding = Math.round((myContrib - myShare - inflows + outflows) * 100) / 100;
    const payerName = (() => {
      const topPayer = (b.contributions || [])[0];
      const m = (group.members || []).find(mm => mm.id === (topPayer?.memberId));
      return m?.name || 'Someone';
    })();
    const state = (() => {
      const splits = b.splits || [];
      if (splits.length === 0) return 'Unsplit';
      const all = splits.every(s => s.settled);
      if (all) return 'Settled';
      const any = splits.some(s => s.settled);
      return any ? 'Partial' : 'Unsettled';
    })();
    return { ...b, label: sectionLabel(b.createdAt || Date.now()), d, outstanding, payerName, state };
  }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const billGroups = billVM.reduce((acc: any[], cur: any) => {
    const last = acc[acc.length - 1];
    if (!last || last.title !== cur.label) acc.push({ title: cur.label, items: [cur] });
    else last.items.push(cur);
    return acc;
  }, []);

  const lastBill = Math.max(0, ...((group.bills || []).map(b => b.createdAt || 0)));
  const lastSettle = Math.max(0, ...((group.settlements || []).map(s => s.createdAt || 0)));
  const last = Math.max(group.createdAt || 0, lastBill, lastSettle);
  let updatedLabel = '';
  if (last > 0) {
    const d = new Date(last);
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    const fmt = (dd: Date) => dd.toDateString();
    if (fmt(d) === fmt(today)) updatedLabel = 'Today';
    else if (fmt(d) === fmt(yest)) updatedLabel = 'Yesterday';
    else updatedLabel = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Calculate settlement plan (who pays who)
  const calculateSettlementPlan = () => {
    type Edge = { fromId: ID; toId: ID; amount: number };
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

  const settlementPlan = calculateSettlementPlan();
  const myName = (useProfileStore.getState().profile.name || '').trim().toLowerCase();
  const myMember = group.members.find((m: any) => (m.name || '').trim().toLowerCase() === myName);

  const recordTransfers = async () => {
    if (settlementPlan.length === 0) {
      Alert.alert('All settled', 'No transfers needed.');
      return;
    }

    try {
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

      setShowSettleUpCard(false);
      await hydrate(); // Refresh group data
      Alert.alert('Success', 'Transfers recorded successfully!');
    } catch (e: any) {
      Alert.alert('Error', e?.message || String(e));
    }
  };

  const accentPrimary = get('accent.primary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const bgDefault = get('background.default') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;
  const dangerColor = get('semantic.danger') as string;

  const renderMemberRow = (member: any, index: number) => {
    const initials = member.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '–';
    const balance = groupBal[member.id] || 0;
    const balanceText = balance > 0.009
      ? `Owed ${formatCurrency(balance)}`
      : balance < -0.009
      ? `Owes ${formatCurrency(Math.abs(balance))}`
      : 'Settled';
    const balanceColor = balance > 0.009
      ? successColor
      : balance < -0.009
      ? warningColor
      : textMuted;

    return (
      <Pressable
        key={member.id}
        onPress={() => {
          setShowMembersList(false);
          setSelectedMember(member);
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.s12,
          paddingVertical: spacing.s12,
          backgroundColor: pressed ? surface2 : 'transparent',
          borderRadius: radius.md,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(accentPrimary, isDark ? 0.20 : 0.12),
            
            borderColor: borderSubtle
          }}
        >
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
            {member.name}
          </Text>
          {member.contact && (
            <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {member.contact}
            </Text>
          )}
        </View>
        <Text style={{ color: balanceColor, fontWeight: '600', fontSize: 14 }}>
          {balanceText}
        </Text>
        <Icon name="chevron-right" size={20} colorToken="text.muted" />
      </Pressable>
    );
  };

  const renderBillRow = (groupIndex: number, groupCount: number) => (item: any, index: number) => {
    const d = new Date(item.createdAt || Date.now());
    const time = fmtTime(d);
    const isLastInCard = groupIndex === groupCount - 1 && index === (billGroups[groupIndex].items.length - 1);

    // Show bill amount, not outstanding
    const billAmount = item.finalAmount;
    const amountPositive = item.outstanding > 0.009;
    const amountNegative = item.outstanding < -0.009;

    // Determine subtitle (You owe / You lent)
    const subtitle = amountPositive
      ? `You lent ${formatCurrency(item.outstanding)}`
      : amountNegative
        ? `You owe ${formatCurrency(Math.abs(item.outstanding))}`
        : 'Settled';

    const amountColor = amountPositive
      ? successColor
      : amountNegative
        ? dangerColor
        : textMuted;

    const renderRightActions = () => (
      <View style={{ flexDirection: 'row' }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.navigate('EditBill', { groupId: group.id, billId: item.id })}
        >
          <View style={{
            width: 80,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accentPrimary
          }}>
            <Icon name="edit" size={20} colorToken="text.onPrimary" />
            <Text style={{
              color: textOnPrimary,
              fontWeight: '700',
              fontSize: 13,
              marginTop: spacing.s4
            }}>Edit</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Alert.alert(
              'Delete Bill',
              `Are you sure you want to delete "${item.title || 'this bill'}"?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // Delete the bill from the group
                      await deleteBill(group.id, item.id);
                      await hydrate();
                    } catch (e: any) {
                      Alert.alert('Error', e?.message || String(e));
                    }
                  }
                }
              ]
            );
          }}
        >
          <View style={{
            width: 80,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dangerColor
          }}>
            <Icon name="trash" size={20} colorToken="text.onPrimary" />
            <Text style={{
              color: textOnPrimary,
              fontWeight: '700',
              fontSize: 13,
              marginTop: spacing.s4
            }}>Delete</Text>
          </View>
        </Pressable>
      </View>
    );

    return (
      <Swipeable
        key={item.id}
        renderRightActions={renderRightActions}
        overshootRight={false}
      >
        <Pressable
          onPress={() => setSelectedBillId(item.id)}
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.s12,
            paddingHorizontal: spacing.s16,
            borderBottomWidth: isLastInCard ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: borderSubtle,
            backgroundColor: surface1
          }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: amountPositive
                ? withAlpha(successColor, isDark ? 0.2 : 0.12)
                : amountNegative
                  ? withAlpha(dangerColor, isDark ? 0.2 : 0.12)
                  : withAlpha(textMuted, isDark ? 0.15 : 0.08),
              marginRight: spacing.s12,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon
                name="receipt"
                size={20}
                color={amountPositive ? successColor : amountNegative ? dangerColor : textMuted}
              />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: textPrimary, fontWeight: '700' }}>
                {item.title || 'Untitled bill'}
              </Text>
              <Text numberOfLines={1} style={{ color: textMuted, marginTop: 2, fontSize: 12 }}>
                {time} • Paid by {item.payerName}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end', marginLeft: spacing.s8 }}>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                {formatCurrency(billAmount)}
              </Text>
              <Text numberOfLines={1} style={{ color: amountColor, marginTop: 2, fontSize: 12, fontWeight: '600' }}>
                {subtitle}
              </Text>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  // Member detail modal
  const memberBalance = selectedMemberVisible ? (groupBal[selectedMemberVisible.id] || 0) : 0;
  const memberJoinedDate = selectedMemberVisible?.joinedAt
    ? new Date(selectedMemberVisible.joinedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : group.createdAt
    ? new Date(group.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Unknown';

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
            bgDefault,
            bgDefault,
            withAlpha(bgDefault, 0.95),
            withAlpha(bgDefault, 0.8),
            withAlpha(bgDefault, 0.5),
            withAlpha(bgDefault, 0)
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
            {group.name}
          </AnimatedReanimated.Text>
        </LinearGradient>
      </AnimatedReanimated.View>

      <ScreenScroll
        inTab
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentStyle={{
          paddingBottom: spacing.s32,
          paddingTop: spacing.s16,
        }}
      >
        <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s20 }}>
          {/* Header with back button */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12 }}>
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
                {group.name}
              </AnimatedReanimated.Text>
            </View>
            <Pressable
              onPress={() => setShowSettingsMenu(true)}
              style={({ pressed }) => ({
                padding: spacing.s8,
                marginRight: -spacing.s8,
                marginTop: -spacing.s4,
                borderRadius: radius.md,
                backgroundColor: pressed ? surface1 : 'transparent',
              })}
              hitSlop={8}
            >
              <Icon name="settings" size={24} color={textPrimary} />
            </Pressable>
          </View>

          {/* Hero Summary - Subtle */}
          <View style={{ gap: spacing.s12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable
                onPress={() => setShowMembersList(true)}
                style={{
                  backgroundColor: surface1,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s10,
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: spacing.s6,
                }}
              >
                <Icon name="users-2" size={16} colorToken="text.muted" />
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>{membersActive.length}</Text>
              </Pressable>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600' }}>
                  Outstanding
                </Text>
                <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800', marginTop: spacing.s4 }}>
                  {unsettledTotal > 0.009 ? formatCurrency(unsettledTotal) : '$0'}
                </Text>
              </View>
            </View>

            {/* Your Balance Summary - Subtle */}
            <View style={{
              flexDirection: 'row',
              gap: spacing.s8
            }}>
              <View style={{
                flex: 1,
                backgroundColor: surface1,
                borderRadius: radius.lg,
                padding: spacing.s12,
              }}>
                <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>You owe</Text>
                <Text style={{
                  color: youOwe > 0.009 ? dangerColor : textPrimary,
                  fontSize: 17,
                  fontWeight: '700',
                  marginTop: spacing.s4,
                  textAlign: 'right',
                }}>
                  {youOwe > 0.009 ? formatCurrency(youOwe) : '$0'}
                </Text>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: surface1,
                borderRadius: radius.lg,
                padding: spacing.s12,
              }}>
                <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>Owed to you</Text>
                <Text style={{
                  color: theyOwe > 0.009 ? successColor : textPrimary,
                  fontSize: 17,
                  fontWeight: '700',
                  marginTop: spacing.s4,
                  textAlign: 'right',
                }}>
                  {theyOwe > 0.009 ? formatCurrency(theyOwe) : '$0'}
                </Text>
              </View>
            </View>
          </View>


          {/* Group Note */}
          {group.note ? (
            <View style={{
              backgroundColor: withAlpha(surface1, 0.8),
              borderRadius: radius.xl,
              padding: spacing.s16,
              
              borderColor: withAlpha(borderSubtle, 0.6),
              gap: spacing.s8
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Icon name="info" size={16} colorToken="text.muted" />
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>Group Note</Text>
              </View>
              <Text style={{ color: textPrimary, lineHeight: 20, fontSize: 14 }}>{group.note}</Text>
            </View>
          ) : null}

          {/* Recent Activity */}
          <View style={{
            borderRadius: radius.lg,
            overflow: 'hidden',
            backgroundColor: surface1
          }}>
            <View style={{
              paddingHorizontal: spacing.s16,
              paddingTop: spacing.s16,
              paddingBottom: spacing.s12,
              backgroundColor: surface1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Recent Activity</Text>
              <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                <Pressable
                  onPress={() => setShowSettleUpCard(!showSettleUpCard)}
                  disabled={unsettledTotal <= 0.009}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: radius.md,
                    backgroundColor: showSettleUpCard ? accentPrimary : surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: (pressed || unsettledTotal <= 0.009) ? 0.5 : 1
                  })}
                >
                  <Icon name="check" size={18} color={showSettleUpCard ? textOnPrimary : accentPrimary} />
                </Pressable>
                <Pressable
                  onPress={() => nav.navigate('AddBill', { groupId: group.id })}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: radius.md,
                    backgroundColor: surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1
                  })}
                >
                  <Icon name="plus" size={18} colorToken="accent.primary" />
                </Pressable>
              </View>
            </View>

            {billGroups.length === 0 ? (
              <Text style={{ color: textMuted, padding: spacing.s16 }}>No bills yet.</Text>
            ) : (
              <View style={{ paddingBottom: spacing.s16 }}>
                {billGroups.map((billGroup: any, groupIndex: number) => (
                  <View key={billGroup.title}>
                    <Text style={{
                      color: textMuted,
                      fontSize: 12,
                      marginTop: spacing.s10,
                      paddingHorizontal: spacing.s16
                    }}>
                      {billGroup.title}
                    </Text>
                    {billGroup.items.map(renderBillRow(groupIndex, billGroups.length))}
                  </View>
                ))}
              </View>
            )}
          </View>

        </Animated.View>
      </ScreenScroll>

      {/* Settle Up Modal - Centered & Beautiful */}
      {showSettleUpCardVisible && unsettledTotal > 0.009 && (
        <Animated.View
          pointerEvents={showSettleUpCard ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: get('background.default') as string,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.s20,
            zIndex: 100,
            opacity: settleUpFadeAnim
          }}
        >
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setShowSettleUpCard(false)}
          />
          <Animated.View
            style={{
              width: '100%',
              maxWidth: 400,
              maxHeight: '80%',
              backgroundColor: surface1,
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
              onPress={() => setShowSettleUpCard(false)}
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
                      setCompletedPayments(prev => new Set(prev).add(idx));
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
                onPress={recordTransfers}
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
      )}

      {/* Members List Bottom Sheet */}
      <BottomSheet
        visible={showMembersList}
        onClose={() => setShowMembersList(false)}
        height={520}
      >
        <View style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 22, letterSpacing: -0.5 }}>
              Group Members
            </Text>
            <Pressable
              onPress={() => {
                setShowMembersList(false);
                setTimeout(() => setShowManageMembers(true), 200);
              }}
              style={({ pressed }) => ({
                position: 'absolute',
                right: 0,
                padding: spacing.s8,
                borderRadius: radius.md,
                backgroundColor: pressed ? surface2 : surface1,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name="settings" size={20} colorToken="accent.primary" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing.s4 }}>
              {membersActive.map((member, idx) => renderMemberRow(member, idx))}
            </View>
          </ScrollView>
        </View>
      </BottomSheet>

      {/* Member Detail Modal */}
      {selectedMemberVisible && (
        <Animated.View
          pointerEvents={selectedMember ? 'auto' : 'none'}
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
            opacity: memberModalFadeAnim
          }}
        >
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setSelectedMember(null)}
          />
          <Animated.View
            style={{
              backgroundColor: surface1,
              borderRadius: 24,
              padding: spacing.s16,
              width: '100%',
              maxWidth: 400,
              gap: spacing.s20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.4,
              shadowRadius: 32,
              elevation: 20,
              opacity: memberModalFadeAnim,
              transform: [
                {
                  scale: memberModalFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1]
                  })
                }
              ]
            }}
          >
            {selectedMemberVisible && (
              <>
                <View style={{ alignItems: 'center', gap: spacing.s12 }}>
                  <View
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 45,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                      borderWidth: 3,
                      borderColor: withAlpha(accentPrimary, 0.4),
                    }}
                  >
                    <Text style={{ color: textPrimary, fontWeight: '900', fontSize: 32 }}>
                      {selectedMemberVisible.name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase() || '').join('') || '–'}
                    </Text>
                  </View>
                  <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 24, letterSpacing: -0.5 }}>
                    {selectedMemberVisible.name}
                  </Text>
                </View>

                <View style={{ gap: spacing.s12 }}>
                  {selectedMemberVisible.contact && (
                    <View
                      style={{
                        backgroundColor: surface2,
                        borderRadius: radius.lg,
                        padding: spacing.s16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.s12,
                        
                        borderColor: withAlpha(borderSubtle, 0.5)
                      }}
                    >
                      <Icon name="mail" size={20} colorToken="accent.primary" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Contact</Text>
                        <Text style={{ color: textPrimary, fontSize: 15, marginTop: 2 }}>
                          {selectedMemberVisible.contact}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View
                    style={{
                      backgroundColor: surface2,
                      borderRadius: radius.lg,
                      padding: spacing.s16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.s12,
                      
                      borderColor: withAlpha(borderSubtle, 0.5)
                    }}
                  >
                    <Icon name="calendar" size={20} colorToken="accent.primary" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Joined</Text>
                      <Text style={{ color: textPrimary, fontSize: 15, marginTop: 2 }}>
                        {memberJoinedDate}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: surface2,
                      borderRadius: radius.lg,
                      padding: spacing.s16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.s12,
                      
                      borderColor: withAlpha(borderSubtle, 0.5)
                    }}
                  >
                    <Icon name="dollar-sign" size={20} colorToken="accent.primary" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Balance</Text>
                      <Text
                        style={{
                          color: memberBalance > 0.009
                            ? successColor
                            : memberBalance < -0.009
                            ? warningColor
                            : textPrimary,
                          fontSize: 20,
                          fontWeight: '800',
                          marginTop: 4,
                          letterSpacing: -0.5
                        }}
                      >
                        {memberBalance > 0.009
                          ? `Owed ${formatCurrency(memberBalance)}`
                          : memberBalance < -0.009
                          ? `Owes ${formatCurrency(Math.abs(memberBalance))}`
                          : 'Settled'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Button
                  title="Close"
                  variant="secondary"
                  onPress={() => setSelectedMember(null)}
                />
              </>
            )}
          </Animated.View>
        </Animated.View>
      )}

      {/* Settings Menu Bottom Sheet */}
      <BottomSheet
        visible={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
      >
        <View style={{ gap: spacing.s16, paddingBottom: spacing.s16 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s8 }}>
            Group settings
          </Text>

          <View style={{ backgroundColor: surface1, borderRadius: radius.lg, overflow: 'hidden' }}>
            {/* Manage Members */}
            <Pressable
              onPress={() => {
                setShowSettingsMenu(false);
                setTimeout(() => setShowManageMembers(true), 200);
              }}
              style={({ pressed }) => ({
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="users-2" size={18} colorToken="accent.primary" />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15, flex: 1 }}>Manage members</Text>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>

            <View style={{ height: 1, backgroundColor: borderSubtle, marginLeft: spacing.s16 + 36 + spacing.s12 }} />

            {/* View Reminders */}
            <Pressable
              onPress={() => {
                setShowSettingsMenu(false);
                setTimeout(() => nav.navigate('GroupReminders', { groupId: group.id }), 200);
              }}
              style={({ pressed }) => ({
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="bell" size={18} colorToken="accent.primary" />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15, flex: 1 }}>View reminders</Text>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>

            <View style={{ height: 1, backgroundColor: borderSubtle, marginLeft: spacing.s16 + 36 + spacing.s12 }} />

            {/* Edit Group */}
            <Pressable
              onPress={() => {
                setShowSettingsMenu(false);
                setTimeout(() => nav.navigate('EditGroup', { groupId: group.id }), 200);
              }}
              style={({ pressed }) => ({
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="edit" size={18} colorToken="accent.primary" />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15, flex: 1 }}>Edit group</Text>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>

            <View style={{ height: 1, backgroundColor: borderSubtle, marginLeft: spacing.s16 + 36 + spacing.s12 }} />

            {/* Export History */}
            <Pressable
              onPress={() => {
                setShowSettingsMenu(false);
                setTimeout(() => {
                  // Generate CSV data
                  const csvBills = ['Bill ID,Title,Amount,Date,Paid By,Status'];
                  (group.bills || []).forEach(bill => {
                    const payer = (bill.contributions || [])[0];
                    const payerMember = (group.members || []).find(m => m.id === payer?.memberId);
                    const payerName = payerMember?.name || 'Unknown';
                    const date = new Date(bill.createdAt || Date.now()).toLocaleDateString();
                    const allSettled = (bill.splits || []).every(s => s.settled);
                    const status = allSettled ? 'Settled' : 'Pending';
                    csvBills.push(`${bill.id},"${bill.title}",${bill.finalAmount},${date},"${payerName}",${status}`);
                  });

                  const csvSettlements = ['Settlement ID,From,To,Amount,Date,Bill ID'];
                  (group.settlements || []).forEach(settlement => {
                    const fromMember = (group.members || []).find(m => m.id === settlement.fromId);
                    const toMember = (group.members || []).find(m => m.id === settlement.toId);
                    const date = new Date(settlement.createdAt || Date.now()).toLocaleDateString();
                    csvSettlements.push(`${settlement.id},"${fromMember?.name || 'Unknown'}","${toMember?.name || 'Unknown'}",${settlement.amount},${date},${settlement.billId || 'N/A'}`);
                  });

                  const billsCSV = csvBills.join('\n');
                  const settlementsCSV = csvSettlements.join('\n');
                  const fullCSV = `BILLS\n${billsCSV}\n\nSETTLEMENTS\n${settlementsCSV}`;

                  Alert.alert(
                    'Export History',
                    `Ready to export ${group.bills.length} bills and ${group.settlements?.length || 0} settlements.\n\nNote: Full export functionality (saving to file) will be implemented soon.`,
                    [
                      { text: 'OK' },
                      {
                        text: 'Preview',
                        onPress: () => Alert.alert('CSV Preview', fullCSV.substring(0, 500) + '...')
                      }
                    ]
                  );
                }, 200);
              }}
              style={({ pressed }) => ({
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="download" size={18} colorToken="accent.primary" />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15, flex: 1 }}>Export history</Text>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>

            <View style={{ height: 1, backgroundColor: borderSubtle, marginLeft: spacing.s16 + 36 + spacing.s12 }} />

            {/* Delete Group */}
            <Pressable
              onPress={() => {
                setShowSettingsMenu(false);
                setTimeout(() => {
                  Alert.alert(
                    'Delete group',
                    `Are you sure you want to delete "${group.name}"?\n\nThis will permanently delete:\n• ${group.bills?.length || 0} bills\n• ${group.settlements?.length || 0} settlements\n• ${group.members?.length || 0} members\n\nThis action cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await deleteGroup(group.id);
                            Alert.alert('Success', 'Group deleted successfully', [
                              { text: 'OK', onPress: () => nav.navigate('GroupsRoot') }
                            ]);
                          } catch (e: any) {
                            Alert.alert('Error', e?.message || String(e));
                          }
                        }
                      }
                    ]
                  );
                }, 200);
              }}
              style={({ pressed }) => ({
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: withAlpha(dangerColor, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="trash" size={18} color={dangerColor} />
              </View>
              <Text style={{ color: dangerColor, fontWeight: '700', fontSize: 15, flex: 1 }}>Delete group</Text>
              <Icon name="chevron-right" size={20} color={dangerColor} />
            </Pressable>
          </View>
        </View>
      </BottomSheet>

      {/* Manage Members Bottom Sheet */}
      <ManageMembersSheet
        visible={showManageMembers}
        onClose={() => setShowManageMembers(false)}
        groupId={groupId}
      />

      {/* Bill Details Bottom Sheet */}
      {selectedBillId && (() => {
        const bill = findBill(groupId, selectedBillId);
        if (!bill) return null;

        const fmtTime = (d: Date) => {
          const h = d.getHours();
          const m = d.getMinutes();
          const hh = ((h % 12) || 12).toString();
          const mm = m.toString().padStart(2, '0');
          const ampm = h < 12 ? 'AM' : 'PM';
          return `${hh}:${mm} ${ampm}`;
        };

        const memberName = (id: string) => group.members.find(m => m.id === id)?.name || '—';
        const billDate = new Date(bill.createdAt || Date.now());

        const remainingUnsettled = bill.splits
          .filter(s => {
            const contribution = bill.contributions.find(c => c.memberId === s.memberId);
            if (!contribution) return !s.settled;
            if (contribution.amount >= s.share) return false;
            return !s.settled;
          })
          .reduce((a,s)=>a+s.share,0);

        const allSettled = bill.splits
          .filter(s => {
            const contribution = bill.contributions.find(c => c.memberId === s.memberId);
            if (!contribution) return true;
            return contribution.amount < s.share;
          })
          .every(s => s.settled);

        const nonPayerSplits = bill.splits.filter(s => {
          const contribution = bill.contributions.find(c => c.memberId === s.memberId);
          if (!contribution) return true;
          return contribution.amount < s.share;
        });

        return (
          <BottomSheet visible={true} onClose={() => setSelectedBillId(null)}>
            <View style={{ gap: spacing.s20 }}>
              {/* Title and Amount */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s8 }}>
                  <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800', flex: 1 }}>
                    {bill.title}
                  </Text>
                  <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginLeft: spacing.s12 }}>
                    {formatCurrency(bill.finalAmount)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: textMuted, fontSize: 13 }}>
                    {billDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} at {fmtTime(billDate)}
                  </Text>
                  {remainingUnsettled > 0.009 && (
                    <Text style={{ color: dangerColor, fontSize: 13, fontWeight: '600' }}>
                      {formatCurrency(remainingUnsettled)} outstanding
                    </Text>
                  )}
                </View>
              </View>

              {/* Paid by */}
              <View>
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginBottom: spacing.s12 }}>
                  Paid by
                </Text>
                <View style={{ gap: spacing.s8 }}>
                  {bill.contributions.map(c => {
                    const member = group.members.find(m => m.id === c.memberId);
                    if (!member) return null;
                    const initials = member.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '?';

                    return (
                      <View
                        key={c.memberId}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: surface1,
                          borderRadius: radius.lg,
                          padding: spacing.s12,
                          gap: spacing.s12
                        }}
                      >
                        <View style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor: accentPrimary,
                        }}>
                          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>
                            {initials}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                            {member.name}
                          </Text>
                        </View>
                        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                          {formatCurrency(c.amount)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Who owes what - All in one card */}
              <View>
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginBottom: spacing.s12 }}>
                  Who owes what
                </Text>
                {nonPayerSplits.length === 0 ? (
                  <View style={{
                    backgroundColor: surface1,
                    borderRadius: radius.lg,
                    padding: spacing.s16,
                    alignItems: 'center'
                  }}>
                    <Icon name="check-circle" size={48} color={successColor} />
                    <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginTop: spacing.s12 }}>
                      All Clear!
                    </Text>
                    <Text style={{ color: textMuted, fontSize: 14, marginTop: spacing.s4, textAlign: 'center' }}>
                      The person who paid has already covered this bill.
                    </Text>
                  </View>
                ) : (
                  <View style={{
                    backgroundColor: surface1,
                    borderRadius: radius.lg,
                    overflow: 'hidden'
                  }}>
                    {nonPayerSplits.map((s, idx) => {
                      const member = group.members.find(m => m.id === s.memberId);
                      if (!member) return null;
                      const initials = member.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '?';
                      const isLast = idx === nonPayerSplits.length - 1;

                      const renderRightActions = () => (
                        <View style={{ flexDirection: 'row' }}>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => Share.share({
                              message: `Hey ${member.name}, please settle ${formatCurrency(s.share)} for "${bill.title}" in ${group.name}. Thanks!`
                            })}
                          >
                            <View style={{
                              width: 80,
                              height: '100%',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: accentPrimary
                            }}>
                              <Icon name="bell" size={20} colorToken="text.onPrimary" />
                              <Text style={{
                                color: textOnPrimary,
                                fontWeight: '700',
                                fontSize: 13,
                                marginTop: spacing.s4
                              }}>Nudge</Text>
                            </View>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            onPress={async () => {
                              await markSplitPaid(groupId, selectedBillId, s.memberId);
                              await hydrate();
                            }}
                          >
                            <View style={{
                              width: 80,
                              height: '100%',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: successColor
                            }}>
                              <Icon name="check" size={20} colorToken="text.onPrimary" />
                              <Text style={{
                                color: textOnPrimary,
                                fontWeight: '700',
                                fontSize: 13,
                                marginTop: spacing.s4
                              }}>Mark Paid</Text>
                            </View>
                          </Pressable>
                        </View>
                      );

                      return (
                        <Swipeable
                          key={s.memberId}
                          renderRightActions={renderRightActions}
                          overshootRight={false}
                        >
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: spacing.s12,
                            gap: spacing.s12,
                            backgroundColor: surface1,
                            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                            borderBottomColor: borderSubtle
                          }}>
                            <View style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: s.settled
                                ? withAlpha(successColor, isDark ? 0.25 : 0.15)
                                : withAlpha(warningColor, isDark ? 0.25 : 0.15),
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 2,
                              borderColor: s.settled ? successColor : warningColor,
                            }}>
                              {s.settled ? (
                                <Icon name="check" size={18} color={successColor} />
                              ) : (
                                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>
                                  {initials}
                                </Text>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                                {member.name}
                              </Text>
                              <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                                {s.settled ? 'Settled' : 'Owes'}
                              </Text>
                            </View>
                            <Text style={{
                              color: s.settled ? successColor : textPrimary,
                              fontWeight: '700',
                              fontSize: 16
                            }}>
                              {formatCurrency(s.share)}
                            </Text>
                          </View>
                        </Swipeable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          </BottomSheet>
        );
      })()}
    </>
  );
}
