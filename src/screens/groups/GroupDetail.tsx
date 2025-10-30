import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, Animated, Alert } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';
import { useProfileStore } from '../../store/profile';
import { useTxStore } from '../../store/transactions';
import { formatCurrency } from '../../lib/format';
import BottomSheet from '../../components/BottomSheet';
import type { ID } from '../../types/groups';
import type { GroupsStackParamList } from '../../navigation/GroupsNavigator';

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

// Settlement Transfer Row with Animation
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
}> = ({ fromInitials, toInitials, amount, warningColor, successColor, accentPrimary, textPrimary, textMuted, surface2, isDark, formatCurrency }) => {
  const flowAnim = useRef(new Animated.Value(0)).current;
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, []);

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

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.s14,
      paddingHorizontal: spacing.s16,
      backgroundColor: surface2,
      borderRadius: radius.lg,
      marginBottom: spacing.s8,
      overflow: 'hidden'
    }}>
      {/* Animated gradient background */}
      <Animated.View style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '100%',
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

      {/* From member */}
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: withAlpha(warningColor, isDark ? 0.25 : 0.2),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: warningColor,
        zIndex: 2
      }}>
        <Text style={{ color: warningColor, fontSize: 13, fontWeight: '800' }}>
          {fromInitials}
        </Text>
      </View>

      {/* Amount and flow line with animated dots */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.s12, zIndex: 1 }}>
        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginBottom: spacing.s6 }}>
          {formatCurrency(amount)}
        </Text>
        <View style={{ width: '100%', height: 2, backgroundColor: withAlpha(textMuted, 0.2), position: 'relative' }}>
          {/* Animated flowing dots */}
          {dotAnims.map((dotAnim, i) => (
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
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: withAlpha(successColor, isDark ? 0.25 : 0.2),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: successColor,
        zIndex: 2
      }}>
        <Text style={{ color: successColor, fontSize: 13, fontWeight: '800' }}>
          {toInitials}
        </Text>
      </View>
    </View>
  );
};

export default function GroupDetail() {
  const nav = useNavigation<NativeStackNavigationProp<GroupsStackParamList>>();
  const route = useRoute<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, hydrate, balances, deleteGroup, deleteBill, addSettlement } = useGroupsStore();
  const { add: addTransaction } = useTxStore();
  const { get, isDark } = useThemeTokens();
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showMembersList, setShowMembersList] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSettleUpCard, setShowSettleUpCard] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (showMembersList) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showMembersList, slideAnim]);

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
          paddingHorizontal: spacing.s12,
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
            borderWidth: 1,
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
    const amountPositive = item.outstanding > 0.009;
    const amountNegative = item.outstanding < -0.009;
    const amountLabel = amountPositive
      ? `+${formatCurrency(item.outstanding)}`
      : amountNegative
        ? `-${formatCurrency(Math.abs(item.outstanding))}`
        : formatCurrency(0);
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
          onPress={() => nav.navigate('BillDetails', { groupId: group.id, billId: item.id })}
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
              <Text numberOfLines={1} style={{ color: textMuted, marginTop: 2 }}>
                {time} • {item.payerName}
              </Text>
            </View>

            <Text style={{ color: amountColor, fontWeight: '700', marginLeft: spacing.s8 }}>
              {amountLabel}
            </Text>
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  // Member detail modal
  const memberBalance = selectedMember ? (groupBal[selectedMember.id] || 0) : 0;
  const memberJoinedDate = selectedMember?.joinedAt
    ? new Date(selectedMember.joinedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : group.createdAt
    ? new Date(group.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Unknown';

  return (
    <>
      <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s32 }}>
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
              <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: spacing.s2 }}>{group.name}</Text>
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

          {/* Hero Summary - No Card */}
          <View style={{ gap: spacing.s16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Outstanding
                </Text>
                <Text style={{ color: textPrimary, fontSize: 40, fontWeight: '900', letterSpacing: -1.5, marginTop: spacing.s6 }}>
                  {unsettledTotal > 0.009 ? formatCurrency(unsettledTotal) : '$0'}
                </Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s4 }}>
                  {unsettledTotal > 0.009 ? 'Across all members' : 'Everyone is settled up'}
                </Text>
              </View>
              <AnimatedPressable
                onPress={() => setShowMembersList(true)}
                style={{
                  backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.18),
                  borderRadius: radius.xl,
                  paddingHorizontal: spacing.s16,
                  paddingVertical: spacing.s14,
                  alignItems: 'center',
                  gap: spacing.s6,
                  borderWidth: 1,
                  borderColor: withAlpha(accentPrimary, 0.4),
                  minWidth: 90
                }}
              >
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Members</Text>
                <Text style={{ color: textPrimary, fontWeight: '900', fontSize: 28, letterSpacing: -0.5 }}>{membersActive.length}</Text>
              </AnimatedPressable>
            </View>

            {/* Your Balance Summary */}
            <View style={{
              flexDirection: 'row',
              gap: spacing.s12
            }}>
              <View style={{
                flex: 1,
                backgroundColor: withAlpha(youOwe > 0.009 ? dangerColor : surface2, isDark ? 0.15 : 0.1),
                borderRadius: radius.lg,
                padding: spacing.s14,
                borderWidth: 1,
                borderColor: withAlpha(youOwe > 0.009 ? dangerColor : borderSubtle, 0.3)
              }}>
                <Text style={{ color: textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>You owe</Text>
                <Text style={{
                  color: youOwe > 0.009 ? dangerColor : textPrimary,
                  fontSize: 22,
                  fontWeight: '900',
                  marginTop: spacing.s6,
                  letterSpacing: -0.5
                }}>
                  {youOwe > 0.009 ? formatCurrency(youOwe) : '$0'}
                </Text>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: withAlpha(theyOwe > 0.009 ? successColor : surface2, isDark ? 0.15 : 0.1),
                borderRadius: radius.lg,
                padding: spacing.s14,
                borderWidth: 1,
                borderColor: withAlpha(theyOwe > 0.009 ? successColor : borderSubtle, 0.3)
              }}>
                <Text style={{ color: textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Owed to you</Text>
                <Text style={{
                  color: theyOwe > 0.009 ? successColor : textPrimary,
                  fontSize: 22,
                  fontWeight: '900',
                  marginTop: spacing.s6,
                  letterSpacing: -0.5
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
              borderWidth: 1,
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
      {showSettleUpCard && unsettledTotal > 0.009 && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.s20,
            zIndex: 100
          }}
        >
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setShowSettleUpCard(false)}
          />
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              backgroundColor: surface1,
              borderRadius: 24,
              padding: spacing.s24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.4,
              shadowRadius: 32,
              elevation: 20
            }}
          >
            {/* Close button */}
            <Pressable
              onPress={() => setShowSettleUpCard(false)}
              style={({ pressed }) => ({
                position: 'absolute',
                top: spacing.s16,
                right: spacing.s16,
                padding: spacing.s8,
                borderRadius: radius.pill,
                backgroundColor: surface2,
                opacity: pressed ? 0.6 : 1,
                zIndex: 10
              })}
            >
              <Icon name="x" size={20} color={textMuted} />
            </Pressable>

            {/* Icon & Title */}
            <View style={{ alignItems: 'center', marginBottom: spacing.s20, marginTop: spacing.s8 }}>
              <View style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: withAlpha(successColor, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.s16
              }}>
                <Text style={{ fontSize: 36 }}>🎉</Text>
              </View>
              <Text style={{ color: textPrimary, fontSize: 26, fontWeight: '900', marginBottom: spacing.s6, textAlign: 'center' }}>
                Settle Up
              </Text>
              <Text style={{ color: textMuted, fontSize: 14, textAlign: 'center' }}>
                Outstanding balance: {formatCurrency(unsettledTotal)}
              </Text>
            </View>

            {/* Settlement plan - who pays who */}
            <View style={{ marginBottom: spacing.s24 }}>
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
                  />
                );
              })}
            </View>

            {/* Action button */}
            <Pressable
              onPress={recordTransfers}
              style={({ pressed }) => ({
                backgroundColor: accentPrimary,
                paddingVertical: spacing.s16,
                borderRadius: radius.xl,
                alignItems: 'center',
                shadowColor: accentPrimary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
                opacity: pressed ? 0.85 : 1
              })}
            >
              <Text style={{ color: textOnPrimary, fontSize: 17, fontWeight: '800' }}>
                Record Transfer
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Members List Modal */}
      <Modal
        visible={showMembersList}
        transparent
        animationType="none"
        onRequestClose={() => setShowMembersList(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowMembersList(false)}
          />
          <Animated.View
            style={{
              backgroundColor: surface1,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              paddingTop: spacing.s24,
              paddingBottom: spacing.s32,
              paddingHorizontal: spacing.s20,
              maxHeight: '80%',
              transform: [{ translateY: slideAnim }],
              borderTopWidth: 3,
              borderTopColor: withAlpha(accentPrimary, 0.3)
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                <Pressable
                  onPress={() => setShowMembersList(false)}
                  style={({ pressed }) => ({
                    padding: spacing.s8,
                    marginLeft: -spacing.s8,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? surface2 : 'transparent',
                  })}
                  hitSlop={8}
                >
                  <Icon name="chevron-left" size={24} color={textPrimary} />
                </Pressable>
                <View>
                  <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 22, letterSpacing: -0.5 }}>
                    Group Members
                  </Text>
                  <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s2 }}>
                    {membersActive.length} active member{membersActive.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              <Button
                variant="secondary"
                size="sm"
                title="Manage"
                onPress={() => {
                  setShowMembersList(false);
                  nav.navigate('ManageMembers', { groupId: group.id });
                }}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: spacing.s4, paddingBottom: spacing.s16 }}>
                {membersActive.map((member, idx) => renderMemberRow(member, idx))}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Member Detail Modal */}
      <Modal
        visible={!!selectedMember}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMember(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.s16,
          }}
          onPress={() => setSelectedMember(null)}
        >
          <Animated.View
            style={{
              backgroundColor: surface1,
              borderRadius: radius.xxl,
              padding: spacing.s24,
              width: '100%',
              maxWidth: 400,
              gap: spacing.s20,
              borderWidth: 2,
              borderColor: withAlpha(accentPrimary, 0.3),
              transform: [{ scale: fadeAnim }]
            }}
            onStartShouldSetResponder={() => true}
          >
            {selectedMember && (
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
                      {selectedMember.name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase() || '').join('') || '–'}
                    </Text>
                  </View>
                  <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 24, letterSpacing: -0.5 }}>
                    {selectedMember.name}
                  </Text>
                </View>

                <View style={{ gap: spacing.s12 }}>
                  {selectedMember.contact && (
                    <View
                      style={{
                        backgroundColor: surface2,
                        borderRadius: radius.lg,
                        padding: spacing.s16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.s12,
                        borderWidth: 1,
                        borderColor: withAlpha(borderSubtle, 0.5)
                      }}
                    >
                      <Icon name="mail" size={20} colorToken="accent.primary" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Contact</Text>
                        <Text style={{ color: textPrimary, fontSize: 15, marginTop: 2 }}>
                          {selectedMember.contact}
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
                      borderWidth: 1,
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
                      borderWidth: 1,
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
        </Pressable>
      </Modal>

      {/* Settings Menu Bottom Sheet */}
      <BottomSheet
        visible={showSettingsMenu}
        onClose={() => setShowSettingsMenu(false)}
      >
        <View style={{ gap: spacing.s16, paddingBottom: spacing.s16 }}>
          <View>
            <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
              Group settings
            </Text>
            <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s4 }}>
              Manage {group.name}
            </Text>
          </View>

          <View style={{ gap: spacing.s8 }}>
            {/* Manage Members */}
            <Pressable
              onPress={() => {
                setShowSettingsMenu(false);
                setTimeout(() => nav.navigate('ManageMembers', { groupId: group.id }), 200);
              }}
              style={({ pressed }) => ({
                backgroundColor: surface1,
                borderRadius: radius.lg,
                padding: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="users" size={20} colorToken="accent.primary" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>Manage members</Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>Edit or remove members</Text>
              </View>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>

            {/* View Reminders */}
            <Pressable
              onPress={() => {
                setShowSettingsMenu(false);
                setTimeout(() => nav.navigate('GroupReminders', { groupId: group.id }), 200);
              }}
              style={({ pressed }) => ({
                backgroundColor: surface1,
                borderRadius: radius.lg,
                padding: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="bell" size={20} colorToken="accent.primary" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>View reminders</Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>Manage payment reminders</Text>
              </View>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>

            {/* Edit Group */}
            <Pressable
              onPress={() => {
                setShowSettingsMenu(false);
                setTimeout(() => nav.navigate('EditGroup', { groupId: group.id }), 200);
              }}
              style={({ pressed }) => ({
                backgroundColor: surface1,
                borderRadius: radius.lg,
                padding: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="edit-3" size={20} colorToken="accent.primary" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>Edit group</Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>Change name or description</Text>
              </View>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>

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
                backgroundColor: surface1,
                borderRadius: radius.lg,
                padding: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="download" size={20} colorToken="accent.primary" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>Export history</Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>Download bills and payments</Text>
              </View>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>

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
                backgroundColor: withAlpha(dangerColor, isDark ? 0.15 : 0.1),
                borderRadius: radius.lg,
                padding: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                opacity: pressed ? 0.7 : 1,
                borderWidth: 1,
                borderColor: withAlpha(dangerColor, 0.3),
              })}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: withAlpha(dangerColor, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="trash-2" size={20} color={dangerColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: dangerColor, fontWeight: '700', fontSize: 15 }}>Delete group</Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>Permanently remove this group</Text>
              </View>
              <Icon name="chevron-right" size={20} color={dangerColor} />
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </>
  );
}
