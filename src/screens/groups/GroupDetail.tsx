
import React from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../components/Screen';
import Button from '../../components/Button';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius, elevation } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';
import { useProfileStore } from '../../store/profile';
import { formatCurrency } from '../../lib/format';


// --- Helpers (match Home tab formatting) ---
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
  const { get } = useThemeTokens();

  useFocusEffect(React.useCallback(() => { hydrate(); }, [hydrate]));
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    return (
      <Screen>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>Group</Text>
          <Text style={{ color: get('text.muted') as string }}>Group not found.</Text>
        </View>
      </Screen>
    );
  }

  const groupBal = balances(group.id);
  const membersActive = group.members.filter(m => !m.archived);
  const extraCount = Math.max(0, membersActive.length - 8);

  // Group-level balances summary
  const posVals = Object.values(groupBal || {}).filter(v => v > 0);
  const unsettledTotal = posVals.reduce((a:number,b:number)=> a + Math.abs(b), 0);
  const meName = (useProfileStore.getState().profile.name || '').trim().toLowerCase();
  const me = (group.members || []).find((m:any) => (m.name||'').trim().toLowerCase() === meName);
  let youOwe = 0, theyOwe = 0;
  // Build bills view model (grouped like Recent Transactions)
  const myId = me?.id;
  const billVM = (group.bills || []).map(b => {
    const d = new Date(b.createdAt || Date.now());
    const myShare = (b.splits || []).find(s => s.memberId === myId)?.share || 0;
    const myContrib = (b.contributions || []).filter(c => c.memberId === myId).reduce((a,c)=>a+c.amount,0);
    const inflows = (group.settlements || []).filter(s => s.billId === b.id && s.toId === myId).reduce((a,s)=>a+s.amount,0);
    const outflows = (group.settlements || []).filter(s => s.billId === b.id && s.fromId === myId).reduce((a,s)=>a+s.amount,0);
    const outstanding = Math.round((myContrib - myShare - inflows + outflows)*100)/100;
    const payerName = (() => {
      const topPayer = (b.contributions || [])[0];
      const m = (group.members || []).find(mm => mm.id === (topPayer?.memberId));
      return m?.name || 'Someone';
    })();
    const state = (() => {
      const splits = b.splits || [];
      if (splits.length === 0) return 'Unsettled';
      const all = splits.every(s => s.settled);
      if (all) return 'Settled';
      const any = splits.some(s => s.settled);
      return any ? 'Partial' : 'Unsettled';
    })();
    return { ...b, label: sectionLabel(b.createdAt || Date.now()), d, outstanding, payerName, state };
  }).sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));

  const billGroups = billVM.reduce((acc: any[], cur: any) => {
    const last = acc[acc.length-1];
    if (!last || last.title !== cur.label) acc.push({ title: cur.label, items: [cur] });
    else last.items.push(cur);
    return acc;
  }, []);

  if (me && groupBal) {
    const v = groupBal[me.id] || 0;
    if (v < -0.009) youOwe = Math.abs(v); else if (v > 0.009) theyOwe = v;
  }


  // Last activity label (Today / Yesterday / DD MMM yyyy)
  const lastBill = Math.max(0, ...((group.bills || []).map(b => b.createdAt || 0)));
  const lastSettle = Math.max(0, ...((group.settlements || []).map(s => s.createdAt || 0)));
  const last = Math.max(group.createdAt || 0, lastBill, lastSettle);
  let updatedLabel = '';
  if (last > 0) {
    const d = new Date(last);
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    const fmt = (dd: Date) => dd.toDateString();
    if (fmt(d) === fmt(today)) updatedLabel = 'Updated Today';
    else if (fmt(d) === fmt(yest)) updatedLabel = 'Updated Yesterday';
    else updatedLabel = 'Updated ' + d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }


  const sumPos = Object.values(groupBal).filter(v => (v as number) > 0).reduce((a:any,v:any)=>a+v,0);
  const sumNeg = Object.values(groupBal).filter(v => (v as number) < 0).reduce((a:any,v:any)=>a+v,0);

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.s16 }}>
        <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>{group.name}</Text>
      </View>
      {/* Updated label */}
      {updatedLabel ? (
        <View style={{ paddingHorizontal: spacing.s16, marginTop: 4 }}>
          <Text style={{ color: get('text.muted') as string }}>{updatedLabel}</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: spacing.s16, gap: spacing.s16 }} keyboardShouldPersistTaps="handled">
        {/* Hero summary card */}
        <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, ...(elevation.level1 as any) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: get('text.muted') as string }}>Unsettled</Text>
              <Text style={{ color: unsettledTotal > 0.009 ? (get('text.primary') as string) : (get('semantic.success') as string), fontWeight: '700', fontSize: 24 }}>
                {unsettledTotal > 0.009 ? formatCurrency(unsettledTotal) : 'All settled'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {membersActive.slice(0,3).map((m:any, idx:number) => (
                <View key={m.id} style={{ width:32, height:32, borderRadius:16, backgroundColor: get('surface.level2') as string, alignItems:'center', justifyContent:'center', marginLeft: idx===0?0:-8, borderWidth:1, borderColor: get('border.subtle') as string }}>
                  <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{(m.name||'?').trim().slice(0,1)}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection:'row', gap: spacing.s8, marginTop: spacing.s12 }}>
            <View style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.s12 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>{'You owe ' + formatCurrency(youOwe)}</Text>
            </View>
            <View style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.s12 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>{'They owe you ' + formatCurrency(theyOwe)}</Text>
            </View>
          </View>
          <View style={{ flexDirection:'row', gap: spacing.s8, marginTop: spacing.s12 }}>
            <Button size="sm" variant="primary" title="Settle up" disabled={unsettledTotal <= 0.009} onPress={() => nav.navigate('SettleUp', { groupId: group.id })} />
            <Button size="sm" variant="secondary" title="Add bill" onPress={() => nav.navigate('AddBill', { groupId: group.id })} />
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
              <View key={m.id} style={{ paddingHorizontal: spacing.s12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: get('surface.level2') as string, borderWidth:1, borderColor:get('border.subtle') as string }}>
                <Text style={{ color: get('text.primary') as string }} numberOfLines={1}>{m.name}</Text>
              </View>
            ))}
            {extraCount > 0 && (
              <Pressable accessibilityRole="button" onPress={() => nav.navigate('ManageMembers', { groupId: group.id })}>
                <View style={{ paddingHorizontal: spacing.s12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: get('surface.level2') as string, borderWidth:1, borderColor:get('border.subtle') as string }}>
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

          {billGroups.length === 0 ? (
            <Text style={{ color: get('text.muted') as string }}>No bills yet.</Text>
          ) : (
            <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, ...(elevation.level1 as any) }}>
              {billGroups.map((g:any, gIdx:number) => (
                <View key={g.title} style={{ marginTop: gIdx === 0 ? 0 : spacing.s12 }}>
                  <Text style={{ color: get('text.muted') as string, marginBottom: spacing.s8 }}>{g.title}</Text>
                  <View>
                    {g.items.map((item:any, index:number) => {
                      const d = new Date(item.createdAt || Date.now());
                      const time = fmtTime(d);
                      const isLastInCard = (gIdx === billGroups.length - 1) && (index === g.items.length - 1);
                      const barColor = item.outstanding > 0.009 ? (get('semantic.success') as string) : (item.outstanding < -0.009 ? (get('semantic.danger') as string) : (get('border.subtle') as string));
                      const amountText = item.outstanding > 0.009 ? ('+' + formatCurrency(item.outstanding)) : (item.outstanding < -0.009 ? ('-' + formatCurrency(Math.abs(item.outstanding))) : formatCurrency(0));
                      const amountColor = item.outstanding > 0.009 ? (get('semantic.success') as string) : (item.outstanding < -0.009 ? (get('semantic.danger') as string) : (get('text.muted') as string));
                      return (
                        <Swipeable overshootLeft={false} overshootRight={false} friction={2} renderLeftActions={(_p:any,_d:any)=>(
                          <View style={{ justifyContent:'center' }}>
                            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); nav.navigate('SettleUp', { groupId: group.id }); }}
                              style={{ width: 96, height: '100%', alignItems:'center', justifyContent:'center', backgroundColor: get('accent.primary') as string }}>
                              <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Settle</Text>
                            </Pressable>
                          </View>
                        )} renderRightActions={(_p:any,_d:any)=>(
                          <View style={{ justifyContent:'center', alignItems:'flex-end' }}>
                            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); nav.navigate('SettleUp', { groupId: group.id }); }}
                              style={{ width: 120, height: '100%', alignItems:'center', justifyContent:'center', backgroundColor: get('surface.level2') as string }}>
                              <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Add payment</Text>
                            </Pressable>
                          </View>
                        )}>
<Pressable key={item.id} onPress={() => nav.navigate('BillDetails', { groupId: group.id, billId: item.id })}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.s12, borderBottomWidth: isLastInCard ? 0 : StyleSheet.hairlineWidth, borderBottomColor: get('border.subtle') as string }}>
                            <View style={{ width: 3, height: 18, borderRadius: radius.pill, backgroundColor: barColor, marginRight: spacing.s12 }} />
                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={1} style={{ color: get('text.primary') as string, fontWeight: '700' }}>{item.title || 'Untitled bill'} • {formatCurrency(item.finalAmount)}</Text>
                              <Text numberOfLines={1} style={{ color: get('text.muted') as string }}>{`Paid by ${item.payerName} · ${time}`}</Text>
                            </View>
                            <View style={{ alignItems:'flex-end' }}>
                              <Text style={{ color: amountColor, fontWeight: '700' }}>{amountText}</Text>
                              <View style={{ marginTop: 4, backgroundColor: get('surface.level2') as string, borderRadius: radius.pill, paddingHorizontal: spacing.s8, paddingVertical: 2 }}>
                                <Text style={{ color: get('text.primary') as string, fontSize: 12 }}>{item.state}</Text>
                              </View>
                            </View>
                          </View>
                        </Pressable>
</Swipeable>
                      );
                    })}
                  </View>
                </View>
              ))}
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
