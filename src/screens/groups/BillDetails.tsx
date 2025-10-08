import React, { useEffect, useState } from 'react';
import { View, Text, Switch, Share, Alert } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { AppHeader } from '../../components/AppHeader';
import Button from '../../components/Button';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useGroupsStore } from '../../store/groups';
import { scheduleDaily, cancel, listReminders } from '../../lib/notifications';
import { formatCurrency } from '../../lib/format';

function fmtDate(ts:number){ const d=new Date(ts); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const da=String(d.getDate()).padStart(2,'0'); const h=String(d.getHours()).padStart(2,'0'); const mi=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${da} ${h}:${mi}`; }

export default function BillDetails() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId, billId } = (route?.params ?? {}) as { groupId: string, billId: string };
  const { groups, findBill, markSplitPaid } = useGroupsStore();

  const group = groups.find(g => g.id === groupId);
  const bill = findBill(groupId, billId);

  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const list = await listReminders();
      const byKey: Record<string, boolean> = {};
      list.filter(r => r.groupId === groupId && r.billId === billId).forEach(r => byKey[r.key] = r.enabled !== false);
      setReminders(byKey);
    })();
  }, [groupId, billId]);

  if (!group || !bill) {
    return (
      <ScreenScroll>
        <AppHeader title="Bill" />
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.muted') as string }}>Bill not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  const memberName = (id: string) => group.members.find(m => m.id === id)?.name || '—';
  const remainingUnsettled = bill.splits.filter(s => !s.settled).reduce((a,s)=>a+s.share,0);

  const shareText = () => {
    const lines = bill.splits.map(s => `${memberName(s.memberId)}: ${formatCurrency(s.share)}${s.settled ? ' (paid)' : ''}`);
    return `Bill: ${bill.title} • ${formatCurrency(bill.finalAmount)}\n` + lines.join('\n');
  };

  const toggleReminder = async (memberId: string, enable: boolean) => {
    const key = `${groupId}:${billId}:${memberId}`;
    if (enable) {
      try {
        await scheduleDaily(key, `Reminder: ${bill.title}`, `${memberName(memberId)} owes ${formatCurrency(bill.splits.find(s=>s.memberId===memberId)?.share||0)} in ${group.name}`, 19, groupId, billId, memberId);
      } catch (e: any) {
        Alert.alert('Notifications', e?.message || String(e));
        return;
      }
    } else {
      await cancel(key);
    }
    setReminders(r => ({ ...r, [key]: enable }));
  };

  const markPaid = async (memberId: string) => {
    await markSplitPaid(groupId, billId, memberId);
    await cancel(`${groupId}:${billId}:${memberId}`);
    nav.setParams({}); // refresh
  };

  return (
    <ScreenScroll>
      <AppHeader title="Bill details" />
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{bill.title}</Text>
        <Text style={{ color: get('text.muted') as string }}>{fmtDate(bill.createdAt)}</Text>

        <View style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, gap: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string }}>Remaining owed (unsettled): {formatCurrency(remainingUnsettled)}</Text>
        </View>

        <View style={{ gap: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Who owes</Text>
          {bill.splits.map(s => (
            <View key={s.memberId} style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <View>
                <Text style={{ color: get('text.primary') as string, fontWeight:'600' }}>{memberName(s.memberId)}</Text>
                <Text style={{ color: get('text.muted') as string }}>{formatCurrency(s.share)} {s.settled ? '(paid)' : ''}</Text>
              </View>
              <View style={{ flexDirection:'row', alignItems:'center', gap: spacing.s8 }}>
                <Button variant="secondary" title="Nudge" onPress={() => Share.share({ message: `Hey ${memberName(s.memberId)}, please settle ${formatCurrency(s.share)} for "${bill.title}" in ${group.name}. Thanks!` })} />
                {!s.settled && <Button title="Mark as paid" onPress={() => setTimeout(()=>markPaid(s.memberId),0)} />}
                {!s.settled && (
                  <View style={{ flexDirection:'row', alignItems:'center', gap: spacing.s8 }}>
                    <Text style={{ color: get('text.muted') as string }}>Daily</Text>
                    <Switch value={!!reminders[`${groupId}:${billId}:${s.memberId}`]} onValueChange={(v)=>{ requestAnimationFrame(()=>toggleReminder(s.memberId, v)); }} />
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        <Button variant="secondary" title="Share breakdown" onPress={() => Share.share({ message: shareText() })} />
      </View>
    </ScreenScroll>
  );
}
