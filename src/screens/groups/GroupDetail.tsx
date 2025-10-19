import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';
import { useProfileStore } from '../../store/profile';
import { formatCurrency } from '../../lib/format';

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

export default function GroupDetail() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, hydrate, balances } = useGroupsStore();
  const { get, isDark } = useThemeTokens();

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
  const extraCount = Math.max(0, membersActive.length - 8);

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
    if (fmt(d) === fmt(today)) updatedLabel = 'Updated today';
    else if (fmt(d) === fmt(yest)) updatedLabel = 'Updated yesterday';
    else updatedLabel = `Updated ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const textOnSurface = get('text.onSurface') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const backgroundDefault = get('background.default') as string;

  const metrics = [
    {
      label: 'Outstanding',
      value: unsettledTotal > 0.009 ? formatCurrency(unsettledTotal) : 'All settled',
      caption: unsettledTotal > 0.009 ? 'Across all members' : 'Everyone is even'
    },
    {
      label: 'You owe',
      value: youOwe > 0.009 ? formatCurrency(youOwe) : 'All clear',
      caption: youOwe > 0.009 ? 'Pay this to get square' : 'No paybacks pending'
    },
    {
      label: 'Owed to you',
      value: theyOwe > 0.009 ? formatCurrency(theyOwe) : 'Nothing yet',
      caption: theyOwe > 0.009 ? 'Give your crew a nudge' : 'No one owes you'
    }
  ];

  const cardStyle = {
    backgroundColor: surface1,
    borderRadius: radius.xl,
    padding: spacing.s16,
    gap: spacing.s12,
    borderWidth: 1,
    borderColor: borderSubtle
  } as const;

  const memberChip = (name: string, index: number) => {
    const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '–';
    return (
      <View key={`${name}-${index}`} style={{
        alignItems: 'center',
        width: 72
      }}>
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(accentPrimary, isDark ? 0.20 : 0.12),
          borderWidth: 1.5,
          borderColor: borderSubtle
        }}>
          <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18 }}>{initials}</Text>
        </View>
        <Text numberOfLines={1} style={{ color: textPrimary, fontSize: 12, marginTop: spacing.s6 }}>{name || 'Member'}</Text>
      </View>
    );
  };

  const renderBillRow = (groupIndex: number, groupCount: number) => (item: any, index: number) => {
    const d = new Date(item.createdAt || Date.now());
    const time = fmtTime(d);
    const isLast = groupIndex === groupCount - 1 && index === (billGroups[groupIndex].items.length - 1);
    const amountPositive = item.outstanding > 0.009;
    const amountNegative = item.outstanding < -0.009;
    const indicatorColor = amountPositive
      ? get('semantic.success') as string
      : amountNegative
        ? get('semantic.danger') as string
        : withAlpha(borderSubtle, 0.8);
    const amountLabel = amountPositive
      ? `+${formatCurrency(item.outstanding)}`
      : amountNegative
        ? `-${formatCurrency(Math.abs(item.outstanding))}`
        : formatCurrency(0);
    const amountColor = amountPositive
      ? get('semantic.success') as string
      : amountNegative
        ? get('semantic.danger') as string
        : textMuted;

    return (
      <Swipeable
        key={item.id}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
        renderLeftActions={() => (
          <View style={{ justifyContent: 'center' }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                nav.navigate('SettleUp', { groupId: group.id });
              }}
              style={{ width: 104, height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: accentPrimary }}
            >
              <Text style={{ color: textOnPrimary, fontWeight: '700' }}>Settle</Text>
            </Pressable>
          </View>
        )}
        renderRightActions={() => (
          <View style={{ justifyContent: 'center', alignItems: 'flex-end' }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                nav.navigate('SettleUp', { groupId: group.id });
              }}
              style={{
                width: 120,
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: surface2
              }}
            >
              <Text style={{ color: textPrimary, fontWeight: '700' }}>Add payment</Text>
            </Pressable>
          </View>
        )}
      >
        <Pressable onPress={() => nav.navigate('BillDetails', { groupId: group.id, billId: item.id })}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.s12,
            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: withAlpha(borderSubtle, 0.8),
            gap: spacing.s12
          }}>
            <View style={{
              width: 6,
              height: 48,
              borderRadius: radius.pill,
              backgroundColor: indicatorColor
            }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: textPrimary, fontWeight: '700' }}>
                {item.title || 'Untitled bill'}
              </Text>
              <Text numberOfLines={1} style={{ color: textMuted, marginTop: spacing.s4 }}>
                {`Paid by ${item.payerName} · ${time}`}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.s4 }}>
              <Text style={{ color: amountColor, fontWeight: '700' }}>{amountLabel}</Text>
              <View style={{
                paddingHorizontal: spacing.s8,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(surface2, 0.9)
              }}>
                <Text style={{ color: textPrimary, fontSize: 12 }}>{item.state}</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
        <View style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.s12 }}>
            <View style={{ flex: 1, gap: spacing.s4 }}>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>Shared group</Text>
              <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', lineHeight: 36, letterSpacing: -0.5 }}>{group.name}</Text>
              {updatedLabel ? <Text style={{ color: textMuted, fontSize: 13 }}>{updatedLabel}</Text> : null}
            </View>
            <View style={{
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.20 : 0.12),
              borderRadius: radius.lg,
              paddingHorizontal: spacing.s12,
              paddingVertical: spacing.s8,
              alignItems: 'flex-end',
              gap: spacing.s4,
              borderWidth: 1,
              borderColor: borderSubtle
            }}>
              <Text style={{ color: textMuted, fontSize: 12 }}>Members</Text>
              <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 20 }}>{membersActive.length}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
            {metrics.map(metric => (
              <View key={metric.label} style={{
                flex: 1,
                minWidth: 140,
                backgroundColor: surface2,
                borderRadius: radius.lg,
                padding: spacing.s12,
                gap: spacing.s4,
                borderWidth: 1,
                borderColor: borderSubtle
              }}>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>{metric.label}</Text>
                <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>{metric.value}</Text>
                <Text style={{ color: textMuted, fontSize: 12 }}>{metric.caption}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            <Button
              size="sm"
              variant="primary"
              title="Settle up"
              disabled={unsettledTotal <= 0.009}
              onPress={() => nav.navigate('SettleUp', { groupId: group.id })}
              style={{ flexGrow: 1, minWidth: 140 }}
            />
            <Button
              size="sm"
              variant="secondary"
              title="Add bill"
              onPress={() => nav.navigate('AddBill', { groupId: group.id })}
              style={{ flexGrow: 1, minWidth: 140 }}
            />
          </View>
        </View>

        {group.note ? (
          <View style={cardStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <Icon name="edit" size={16} colorToken="text.muted" />
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>Group note</Text>
            </View>
            <Text style={{ color: textPrimary, lineHeight: 20 }}>{group.note}</Text>
          </View>
        ) : null}

        <View style={cardStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s8 }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Members</Text>
            <Button
              variant="secondary"
              size="sm"
              title="Manage"
              onPress={() => nav.navigate('ManageMembers', { groupId: group.id })}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s12, paddingVertical: spacing.s4 }}>
            {membersActive.slice(0, 8).map((member, idx) => memberChip(member.name, idx))}
            {extraCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.navigate('ManageMembers', { groupId: group.id })}
                style={({ pressed }) => ({
                  width: 72,
                  alignItems: 'center',
                  opacity: pressed ? 0.72 : 1
                })}
              >
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: withAlpha(accentPrimary, 0.4),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: withAlpha(accentPrimary, 0.12)
                }}>
                  <Text style={{ color: accentPrimary, fontWeight: '700' }}>+{extraCount}</Text>
                </View>
                <Text style={{ color: accentPrimary, fontSize: 12, marginTop: spacing.s6 }}>See all</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        <View style={cardStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s8 }}>
            <View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Recent activity</Text>
              <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s4 }}>Swipe a bill to log a settle or view details.</Text>
            </View>
            <Button
              size="sm"
              variant="secondary"
              title="Add bill"
              onPress={() => nav.navigate('AddBill', { groupId: group.id })}
            />
          </View>

          {billGroups.length === 0 ? (
            <View style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: withAlpha(borderSubtle, 0.8),
              padding: spacing.s16,
              alignItems: 'center',
              gap: spacing.s8
            }}>
              <Icon name="receipt" size={24} colorToken="text.muted" />
              <Text style={{ color: textPrimary, fontWeight: '700' }}>No bills yet</Text>
              <Text style={{ color: textMuted, textAlign: 'center' }}>
                Track your first shared expense to see balances update here.
              </Text>
              <Button
                size="sm"
                title="Create a bill"
                onPress={() => nav.navigate('AddBill', { groupId: group.id })}
              />
            </View>
          ) : (
            <View style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: withAlpha(borderSubtle, 0.8),
              backgroundColor: surface2,
              paddingHorizontal: spacing.s12,
              paddingTop: spacing.s12
            }}>
              {billGroups.map((billGroup: any, groupIndex: number) => (
                <View key={billGroup.title} style={{ marginBottom: groupIndex === billGroups.length - 1 ? spacing.s4 : spacing.s12 }}>
                  <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4, paddingHorizontal: spacing.s4 }}>{billGroup.title}</Text>
                  <View>
                    {billGroup.items.map(renderBillRow(groupIndex, billGroups.length))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
          <Button
            variant="secondary"
            title="Reminders"
            onPress={() => nav.navigate('GroupReminders', { groupId: group.id })}
          />
        </View>
      </View>
    </ScreenScroll>
  );
}

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
