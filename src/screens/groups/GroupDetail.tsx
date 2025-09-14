
import React from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import Button from '../../components/Button';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';
import { formatCurrency } from '../../lib/format';

export default function GroupDetail() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, hydrate, balances } = useGroupsStore();
  const { get } = useThemeTokens();

  useFocusEffect(React.useCallback(() => { hydrate(); }, [hydrate]));
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    return (
      <Screen>
        <AppHeader title="Group" />
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.muted') as string }}>Group not found.</Text>
        </View>
      </Screen>
    );
  }

  const bal = balances(group.id);
  const membersActive = group.members.filter(m => !m.archived);
  const extraCount = Math.max(0, membersActive.length - 8);

  const sumPos = Object.values(bal).filter(v => (v as number) > 0).reduce((a:any,v:any)=>a+v,0);
  const sumNeg = Object.values(bal).filter(v => (v as number) < 0).reduce((a:any,v:any)=>a+v,0);

  return (
    <Screen>
      <AppHeader title={group.name} />
      <ScrollView contentContainerStyle={{ padding: spacing.s16, gap: spacing.s16 }} keyboardShouldPersistTaps="handled">
        {/* Balances card */}
        <View style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, gap: spacing.s8, backgroundColor: get('surface.level1') as string }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Balances</Text>
          <View style={{ gap: spacing.s4 }}>
            {group.members.map(m => (
              <Text key={m.id} numberOfLines={1} style={{ color: (bal[m.id]||0) >= 0 ? get('text.primary') as string : get('semantic.danger') as string }}>
                {m.name}: {formatCurrency(bal[m.id]||0)}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop: spacing.s8 }}>
            <Text style={{ color: get('text.muted') as string }}>Others owe: {formatCurrency(sumPos)} · You owe: {formatCurrency(Math.abs(sumNeg))}</Text>
            <Button variant="secondary" title="Settle up" onPress={() => nav.navigate('SettleUp', { groupId: group.id })} />
          </View>
        </View>

        {/* Members rail (compact) */}
        <View style={{ gap: spacing.s8 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Members</Text>
            <Button variant="secondary" title="Manage" onPress={() => nav.navigate('ManageMembers', { groupId: group.id })} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s8 }}>
            {membersActive.slice(0,8).map(m => (
              <View key={m.id} style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor:get('surface.level1') as string, borderWidth:1, borderColor:get('border.subtle') as string }}>
                <Text style={{ color: get('text.primary') as string }} numberOfLines={1}>{m.name}</Text>
              </View>
            ))}
            {extraCount > 0 && (
              <Pressable onPress={() => nav.navigate('ManageMembers', { groupId: group.id })}>
                <View style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor:get('surface.level1') as string, borderWidth:1, borderColor:get('border.subtle') as string }}>
                  <Text style={{ color: get('accent.primary') as string }}>+{extraCount} more</Text>
                </View>
              </Pressable>
            )}
          </ScrollView>
        </View>

        {/* Bills with header action */}
        <View style={{ gap: spacing.s8 }}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Bills</Text>
            <Button title="Add bill" onPress={() => nav.navigate('AddBill', { groupId: group.id })} />
          </View>

          {group.bills.length === 0 ? (
            <Text style={{ color: get('text.muted') as string }}>No bills yet.</Text>
          ) : (
            <View style={{ gap: spacing.s8 }}>
              {group.bills.map(item => {
                const unsettled = item.splits.filter(s => !s.settled).reduce((a,s)=>a+s.share,0);
                return (
                  <Swipeable
  renderRightActions={() => (
    <View style={{ backgroundColor: get('semantic.danger') as string, justifyContent:'center', paddingHorizontal: spacing.s16 }}>
      <Text style={{ color: get('text.onPrimary') as string }}
        onPress={() => Alert.alert('Delete bill', `Delete "${item.title}"? This also removes related settlements.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => { try { await useGroupsStore.getState().removeBill(group.id, item.id); } catch {} } },
        ])}
      >Delete</Text>
    </View>
  )}
>
<Pressable key={item.id} onPress={() => nav.navigate('BillDetails', { groupId: group.id, billId: item.id })}>
                    <View style={{ paddingVertical: spacing.s8, borderBottomWidth:1, borderBottomColor:get('border.subtle') as string }}>
                      <Text style={{ color: get('text.primary') as string, fontWeight:'600' }} numberOfLines={1}>{item.title} • {formatCurrency(item.finalAmount)}</Text>
                      <Text style={{ color: get('text.muted') as string }} numberOfLines={1}>
                        {unsettled > 0.009 ? `Unsettled: ${formatCurrency(unsettled)}` : 'All paid'}
                      </Text>
                    </View>
                  </Pressable>
                  </Swipeable>
                );
              })}
            </View>
          )}
        </View>

        {/* Secondary actions row */}
        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          <Button variant="secondary" title="Reminders" onPress={() => nav.navigate('GroupReminders', { groupId: group.id })} />
        </View>
      </ScrollView>
    </Screen>
  );
}