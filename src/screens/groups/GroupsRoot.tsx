import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, View, Text, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import Button from '../../components/Button';
import Icon, { IconName } from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius, elevation } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';
import { useProfileStore } from '../../store/profile';
import { formatCurrency, sum } from '../../lib/format';

export default function GroupsRoot() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { groups, hydrate, balances } = useGroupsStore();

  useFocusEffect(useCallback(() => { hydrate(); }, [hydrate]));

  const [filterTab, setFilterTab] = useState<'all' | 'unsettled'>('all');
  const meName = (useProfileStore.getState().profile.name || '').trim().toLowerCase();

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
        borderWidth: 1,
        borderColor: borderSubtle
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
              borderWidth: 1.5, borderColor: borderSubtle,
            }}>
              <Text style={{ color: textPrimary, fontSize: 12, fontWeight: '700' }}>{initials}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const Row = ({ item }: { item: any }) => {
    const activeMembers = item.members.filter((m: any) => !m.archived);
    const settled = item.unsettled <= 0.009;
    const meta = `${activeMembers.length} members`;
    const balanceMap = balances(item.id) || {};
    const me = (activeMembers || []).find((m: any) => (m.name || '').trim().toLowerCase() === meName);
    const myShare = me ? balanceMap[me.id] || 0 : 0;
    const myShareLabel = !me
      ? 'Not a member'
      : myShare > 0.009
        ? `You are owed ${formatCurrency(myShare)}`
        : myShare < -0.009
          ? `You owe ${formatCurrency(Math.abs(myShare))}`
          : 'You are settled in this group';
    const myShareColor = myShare > 0.009
      ? get('semantic.success') as string
      : myShare < -0.009
        ? get('semantic.warning') as string
        : textMuted;
    const lastActive = item.last ? timeAgo(item.last) : 'Just created';
    const billCount = item.bills?.length ?? 0;
    const chipBg = settled ? surface2 : withAlpha(accentSecondary, isDark ? 0.20 : 0.12);
    const chipColor = settled ? textMuted : accentSecondary;
    const borderColor = settled ? borderSubtle : withAlpha(accentSecondary, 0.35);

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => nav.navigate('GroupDetail', { groupId: item.id })}
        style={({ pressed }) => [
          {
            backgroundColor: surface1,
            borderRadius: radius.xl,
            paddingVertical: spacing.s16,
            paddingHorizontal: spacing.s16,
            marginBottom: spacing.s16,
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden',
            borderWidth: 1,
            borderColor,
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
            width: 6,
            backgroundColor: accentSecondary
          }} />
        )}
        {renderAvatarStack(activeMembers.map((m: any) => m.name))}
        <View style={{ flex: 1, marginLeft: spacing.s12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: spacing.s8 }}>
              <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ color: textMuted, marginTop: spacing.s4 }} numberOfLines={1}>{`${meta} • ${lastActive}`}</Text>
            </View>
            <View style={{
              paddingHorizontal: spacing.s10,
              paddingVertical: spacing.s6,
              borderRadius: radius.pill,
              backgroundColor: chipBg
            }}>
              <Text style={{ color: chipColor, fontWeight: '700', fontSize: 12 }}>
                {settled ? 'Settled up' : `${formatCurrency(item.unsettled)} unsettled`}
              </Text>
            </View>
          </View>

          {me && (
            <View style={{
              marginTop: spacing.s12,
              padding: spacing.s12,
              borderRadius: radius.lg,
              backgroundColor: settled ? surface2 : withAlpha(accentSecondary, isDark ? 0.15 : 0.10)
            }}>
              <Text style={{ color: myShareColor, fontWeight: '600' }}>{myShareLabel}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8, marginTop: spacing.s12 }}>
            <View style={{
              paddingHorizontal: spacing.s10,
              paddingVertical: spacing.s6,
              borderRadius: radius.pill,
              backgroundColor: surface2
            }}>
              <Text style={{ color: textMuted, fontWeight: '600', fontSize: 12 }}>{billCount} bills logged</Text>
            </View>
            <View style={{
              paddingHorizontal: spacing.s10,
              paddingVertical: spacing.s6,
              borderRadius: radius.pill,
              backgroundColor: surface2
            }}>
              <Text style={{ color: textMuted, fontWeight: '600', fontSize: 12 }}>{activeMembers.length} active members</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s12 }}>
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
                onPress={() => nav.navigate('SettleUp', { groupId: item.id })}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <Screen inTab>
      <FlatList
        data={filteredData}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => <Row item={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s32 }}
        ListHeaderComponentStyle={{ marginBottom: spacing.s16 }}
        ListHeaderComponent={(
          <View>
            <View style={{ marginTop: spacing.s12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8, marginBottom: spacing.s16 }}>
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
                  <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>Shared bills</Text>
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
                borderWidth: 1,
                borderColor: borderSubtle,
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
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: radius.pill,
                  backgroundColor: accentPrimary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
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
              borderWidth: 1,
              borderColor: borderSubtle,
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
    </Screen>
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
