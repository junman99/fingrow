import React, { useMemo } from 'react';
import { View, Text, Share, Alert } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { AppHeader } from '../../components/AppHeader';
import Button from '../../components/Button';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useGroupsStore } from '../../store/groups';
import type { ID } from '../../types/groups';
import { formatCurrency } from '../../lib/format';

type Edge = { fromId: ID; toId: ID; amount: number };

export default function SettleUp() {
  const nav = useNavigation<any>();
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, balances, addSettlement } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);

  const bal = useMemo(() => balances(groupId), [groupId, balances]);
  const membersById = useMemo(() => Object.fromEntries((group?.members || []).map(m => [m.id, m])), [group]);

  const plan: Edge[] = useMemo(() => {
    const creditors: { id: ID; amt: number }[] = [];
    const debtors: { id: ID; amt: number }[] = [];
    Object.entries(bal).forEach(([id, v]) => {
      const val = Math.round((v as number) * 100) / 100;
      if (val > 0.009) creditors.push({ id: id as ID, amt: val });
      else if (val < -0.009) debtors.push({ id: id as ID, amt: -val });
    });
    creditors.sort((a,b)=>b.amt - a.amt);
    debtors.sort((a,b)=>b.amt - a.amt);
    const edges: Edge[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const x = Math.min(d.amt, c.amt);
      edges.push({ fromId: d.id, toId: c.id, amount: Math.round(x*100)/100 });
      d.amt = Math.round((d.amt - x)*100)/100;
      c.amt = Math.round((c.amt - x)*100)/100;
      if (d.amt === 0) i++;
      if (c.amt === 0) j++;
    }
    return edges;
  }, [bal]);

  if (!group) {
    return (
      <ScreenScroll>
        <AppHeader title="Settle up" />
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.muted') as string }}>Group not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  const shareText = () => {
    if (plan.length === 0) return 'No one owes anything.';
    const lines = plan.map(e => `${membersById[e.fromId]?.name || '—'} → ${membersById[e.toId]?.name || '—'}: ${formatCurrency(e.amount)}`);
    return `Settle up for ${group.name}\n` + lines.join('\n');
  };

  const recordAll = async () => {
    if (plan.length === 0) { Alert.alert('All settled', 'No transfers needed.'); return; }
    for (const e of plan) {
      await addSettlement(group.id, e.fromId, e.toId, e.amount);
    }
    Alert.alert('Recorded', 'Transfers recorded.');
    nav.goBack();
  };

  return (
    <ScreenScroll>
      <AppHeader title="Settle up" />
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        {plan.length === 0 ? (
          <Text style={{ color: get('text.muted') as string }}>Everyone is settled 🎉</Text>
        ) : (
          <View style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, gap: spacing.s8 }}>
            {plan.map((e, idx) => (
              <Text key={idx} style={{ color: get('text.primary') as string }}>
                {membersById[e.fromId]?.name || '—'} → {membersById[e.toId]?.name || '—'}: {formatCurrency(e.amount)}
              </Text>
            ))}
          </View>
        )}
        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          <Button variant="secondary" title="Share" onPress={() => Share.share({ message: shareText() })} />
          <Button title="Record transfers" onPress={recordAll} />
        </View>
      </View>
    </ScreenScroll>
  );
}
