
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, View, Text, Pressable } from 'react-native';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import Button from '../../components/Button';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { spacing, radius, elevation } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';
import { useProfileStore } from '../../store/profile';
import { formatCurrency, sum } from '../../lib/format';

export default function GroupsRoot() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { groups, hydrate, balances } = useGroupsStore();

  useFocusEffect(useCallback(() => { hydrate(); }, [hydrate]));

    const [filterTab, setFilterTab] = useState<'all'|'unsettled'>('all');
  const meName = (useProfileStore.getState().profile.name || '').trim().toLowerCase();
const data = useMemo(() => {
    const arr = [...groups].map(g => {
      // compute unsettled: sum of positive balances (== total that needs to move)
      const bal = balances(g.id);
      const pos = Object.values(bal || {}).filter(v => v > 0);
      const unsettled = sum(pos.map(v => Math.abs(v)));
      // last activity
      const lastBill = Math.max(0, ...(g.bills || []).map(b => b.createdAt || 0));
      const lastSettle = Math.max(0, ...(g.settlements || []).map(s => s.createdAt || 0));
      const last = Math.max(g.createdAt || 0, lastBill, lastSettle);
      return { ...g, unsettled, last };
    });
    // Sort: unsettled > 0 first, then most recent
    return arr.sort((a: any, b: any) => {
      const aU = a.unsettled > 0.009 ? 1 : 0;
      const bU = b.unsettled > 0.009 ? 1 : 0;
      if (aU !== bU) return bU - aU; // unsettled first
      return (b.last || 0) - (a.last || 0); // recent first
    });
  }, [groups, balances]);

  const filteredData = useMemo(() => (
    filterTab === 'unsettled' ? data.filter((g:any)=>g.unsettled > 0.009) : data
  ), [data, filterTab]);

  const totals = useMemo(() => {
    let youOwe = 0, theyOwe = 0, matched = 0;
    for (const g of data) {
      const bal = balances(g.id);
      const me = (g.members || []).find((m:any)=> (m.name||'').trim().toLowerCase() === meName);
      if (!me) continue;
      matched++;
      const v = bal[me.id] || 0;
      if (v < -0.009) youOwe += Math.abs(v);
      else if (v > 0.009) theyOwe += v;
    }
    return { youOwe, theyOwe, matched };
  }, [data, balances, meName]);


  const renderAvatarStack = (names: string[]) => {
    const cols = [get('surface.level2') as string, get('surface.level2') as string, get('surface.level2') as string];
    return (
      <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
        {names.slice(0,3).map((n, i) => {
          const initials = n.trim().split(/\s+/).slice(0,2).map(p => p[0]?.toUpperCase() || '').join('');
          return (
            <View key={i} style={{
              position: 'absolute',
              left: i * 12,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: cols[i],
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: get('border.subtle') as string,
            }}>
              <Text style={{ color: get('text.primary') as string, fontSize: 11, fontWeight: '700' }}>{initials}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const Row = ({ item }: any) => {
    const activeMembers = item.members.filter((m: any) => !m.archived);
    const settled = item.unsettled <= 0.009;
    const meta = `${activeMembers.length} members`;

    return (
      <Pressable accessibilityRole="button"
        onPress={() => nav.navigate('GroupDetail', { groupId: item.id })}
        style={{
          backgroundColor: get('surface.level1') as string,
          borderRadius: radius.lg, paddingVertical: spacing.s12, paddingHorizontal: spacing.s12,
          ...(elevation.level1 as any),
          marginBottom: spacing.s12, flexDirection: 'row', alignItems: 'center'
        }}
      >
        {renderAvatarStack(activeMembers.map((m:any)=>m.name))}
        <View style={{ flex: 1, marginLeft: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }} numberOfLines={1}>{item.name}</Text>
          <Text style={{ color: settled ? get('text.muted') as string : get('semantic.warning') as string }} numberOfLines={1}>{meta}</Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: spacing.s8 }}>
          {/* status pill */}
          <View style={{
            paddingHorizontal: spacing.s8, paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: settled ? (get('surface.level2') as string) : (get('surface.level2') as string),
            borderWidth: 1, borderColor: settled ? (get('border.subtle') as string) : (get('border.subtle') as string),
          }}>
            <Text style={{ color: settled ? (get('text.muted') as string) : (get('text.primary') as string), fontSize: 12 }}>
              {settled ? 'Settled' : `Unsettled ${formatCurrency(item.unsettled)}`}
            </Text>
          </View>

          {/* quick actions */}
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <Button size="sm" variant="secondary" title="Add bill" onPress={() => nav.navigate('AddBill', { groupId: item.id })} />
            {!settled && (
              <Button size="sm" variant="primary" title="Settle up" onPress={() => nav.navigate('SettleUp', { groupId: item.id })} />
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <Screen>
      <AppHeader
        title="Groups"
        right={<Button title="+ Add" variant="secondary" onPress={() => nav.navigate('CreateGroup')} />}
      />
      <View style={{ padding: spacing.s16, flex: 1 }}>
                {/* Top summary */}
        {(totals.youOwe > 0.009 || totals.theyOwe > 0.009) && (
          <View style={{ marginBottom: spacing.s12, flexDirection: 'row', gap: spacing.s12 }}>
            <View style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.s12 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{'You owe ' + formatCurrency(totals.youOwe)}</Text>
            </View>
            <View style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.s12 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{'They owe you ' + formatCurrency(totals.theyOwe)}</Text>
            </View>
          </View>
        )}
        {/* Filter chips */}
        <View style={{ flexDirection: 'row', gap: spacing.s8, marginBottom: spacing.s12 }}>
          <Pressable onPress={() => setFilterTab('all')} style={{ borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.s12, backgroundColor: filterTab==='all' ? get('accent.primary') as string : get('surface.level2') as string }}>
            <Text style={{ color: filterTab==='all' ? get('text.onPrimary') as string : get('text.primary') as string, fontWeight: '600' }}>All</Text>
          </Pressable>
          <Pressable onPress={() => setFilterTab('unsettled')} style={{ borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.s12, backgroundColor: filterTab==='unsettled' ? get('accent.primary') as string : get('surface.level2') as string }}>
            <Text style={{ color: filterTab==='unsettled' ? get('text.onPrimary') as string : get('text.primary') as string, fontWeight: '600' }}>Unsettled</Text>
          </Pressable>
        </View>
{data.length === 0 ? (
          <View style={{
            borderRadius: radius.lg,
            backgroundColor: get('surface.level1') as string, padding: spacing.s16,
            ...(elevation.level1 as any)
          }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', marginBottom: spacing.s8 }}>No groups yet</Text>
            <Text style={{ color: get('text.muted') as string, marginBottom: spacing.s12 }}>Create a group to track shared bills and settle up easily.</Text>
            <Button title="Create group" onPress={() => nav.navigate('CreateGroup')} />
          </View>
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(i:any) => i.id}
            renderItem={({ item }) => <Row item={item} />}
            contentContainerStyle={{ paddingBottom: spacing.s24 }}
          />
        )}
      </View>
    </Screen>
  );
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff/1000);
  const m = Math.floor(s/60);
  const h = Math.floor(m/60);
  const d = Math.floor(h/24);
  if (d >= 1) return d === 1 ? '1 day ago' : `${d} days ago`;
  if (h >= 1) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  if (m >= 1) return m === 1 ? '1 min ago' : `${m} mins ago`;
  return 'just now';
}
