
import React from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { Screen } from '../../components/Screen';
import Button from '../../components/Button';
import { spacing, radius } from '../../theme/tokens';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useGroupsStore } from '../../store/groups';
import { Swipeable } from 'react-native-gesture-handler';

export default function ManageMembers() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, archiveMember, deleteMember } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);

  const [showArchived, setShowArchived] = React.useState(false);

  if (!group) {
    return (
      <Screen>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>Members</Text>
          <Text style={{ color: get('text.muted') as string }}>Group not found.</Text>
        </View>
      </Screen>
    );
  }

  // Precompute whether a member can be safely deleted (no history)
  const canDelete: Record<string, boolean> = React.useMemo(() => {
    const used: Record<string, boolean> = {};
    (group.bills || []).forEach(b => {
      (b.contributions || []).forEach(c => { used[c.memberId] = true; });
      (b.splits || []).forEach(s => { used[s.memberId] = true; });
    });
    (group.settlements || []).forEach(s => { used[s.fromId] = true; used[s.toId] = true; });
    const out: Record<string, boolean> = {};
    group.members.forEach(m => { out[m.id] = !used[m.id]; });
    return out;
  }, [group]);

  const askDelete = (memberId: string, name: string) => {
    Alert.alert('Delete member',
      `Delete ${name}? This is only allowed if they have no history. Otherwise, archive instead.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteMember(group.id, memberId); } catch (e: any) { Alert.alert('Cannot delete', e?.message || String(e)); }
        } },
      ],
    );
  };

  const Row = ({ m }: any) => {
    const deletable = canDelete[m.id];
    const right = (
      <View style={{ flexDirection: 'row' }}>
        <View style={{ backgroundColor: deletable ? (get('semantic.danger') as string) : (get('surface.level2') as string), justifyContent: 'center', paddingHorizontal: spacing.s16 }}>
          <Text
            style={{ color: deletable ? (get('text.onPrimary') as string) : (get('text.muted') as string) }}
            onPress={() => { deletable ? askDelete(m.id, m.name) : Alert.alert('Cannot delete', 'This member has history. Archive instead.'); }}
          >
            Delete
          </Text>
        </View>
      </View>
    );
    return (
      <Swipeable renderRightActions={() => right}>
        <View style={{ paddingVertical: spacing.s12, paddingHorizontal: spacing.s12, borderBottomWidth: 1, borderBottomColor: get('border.subtle') as string, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: m.archived ? get('text.muted') as string : get('text.primary') as string, fontWeight: '600' }} numberOfLines={1}>{m.name}</Text>
            <Text style={{ color: get('text.muted') as string }} numberOfLines={1}>
              {m.contact ? m.contact : (canDelete[m.id] ? 'No history' : 'Has history — cannot delete')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <Button variant="secondary" title={m.archived ? 'Unarchive' : 'Archive'} onPress={() => archiveMember(group.id, m.id, !m.archived)} />
          </View>
        </View>
      </Swipeable>
    );
  };

  const active = group.members.filter(m => !m.archived);
  const archived = group.members.filter(m => m.archived);

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s16, flex: 1 }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>{`Members (${active.length})`}</Text>
          <Button title="+ Add" variant="secondary" onPress={() => nav.navigate('AddMember', { groupId: group.id })} />
        </View>
        {/* Active */}
        <View style={{ borderWidth: 1, borderColor: get('border.subtle') as string, borderRadius: radius.md, backgroundColor: get('surface.level1') as string }}>
          {active.length === 0 ? (
            <Text style={{ color: get('text.muted') as string, padding: spacing.s12 }}>No active members.</Text>
          ) : (
            active.map(m => <Row key={m.id} m={m} />)
          )}
        </View>

        {/* Archived collapsible */}
        <View style={{ gap: spacing.s8 }}>
          <Pressable accessibilityRole="button" onPress={() => setShowArchived(s => !s)}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
              <Text style={{ color: get('text.muted') as string, fontWeight: '700' }}>Archived ({archived.length})</Text>
              <Text style={{ color: get('text.muted') as string }}>{showArchived ? 'Hide' : 'Show'}</Text>
            </View>
          </Pressable>
          {showArchived && archived.length > 0 && (
            <View style={{ borderWidth: 1, borderColor: get('border.subtle') as string, borderRadius: radius.md, backgroundColor: get('surface.level1') as string }}>
              {archived.map(m => <Row key={m.id} m={m} />)}
            </View>
          )}
          {showArchived && archived.length === 0 && (
            <Text style={{ color: get('text.muted') as string }}>No archived members.</Text>
          )}
        </View>
      </View>
    </Screen>
  );
}
