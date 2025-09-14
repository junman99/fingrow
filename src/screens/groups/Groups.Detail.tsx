import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { addMember, deleteBill, deleteMember, getGroup } from '../../storage/groups';
import type { Bill, Group } from '../../types/groups';

export default function GroupDetail({ route, navigation }: any) {
  const { groupId } = route.params as { groupId: string };
  const { get } = useThemeTokens();
  const bg = get('background.default') as string;
  const card = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const txt = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const accent = get('accent.primary') as string;
  const swipeBg = get('surface.level2') as string;

  const [group, setGroup] = useState<Group | undefined>();
  const [memberName, setMemberName] = useState('');

  const load = useCallback(async () => setGroup(await getGroup(groupId)), [groupId]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation, load]);

  if (!group) return null;

  const right = (onPress: () => void) => (
    <View style={{ backgroundColor: swipeBg, justifyContent: 'center', alignItems: 'flex-end', width: 100, height: '100%' }}>
      <TouchableOpacity style={{ paddingHorizontal: 16, paddingVertical: 12 }} onPress={onPress}>
        <Text style={{ color: txt, fontWeight: '700' }}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ padding: 16, gap: 16 }}>

        <Text style={{ color: txt, fontSize: 20, fontWeight: '700' }}>{group.name}</Text>

        {/* Members */}
        <View style={{ backgroundColor: card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: border }}>
          <Text style={{ color: txt, fontWeight: '700', marginBottom: 8 }}>Members</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TextInput
              placeholder="Add member name…"
              placeholderTextColor={muted}
              value={memberName}
              onChangeText={setMemberName}
              style={{ flex: 1, color: txt, paddingVertical: 8 }}
            />
            <TouchableOpacity
              onPress={async () => {
                if (!memberName.trim()) return;
                await addMember(groupId, memberName.trim());
                setMemberName('');
                load();
              }}
              style={{ backgroundColor: accent, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' }}
            >
              <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700' }}>Add</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={group.members}
            keyExtractor={(m) => m.id}
            ListEmptyComponent={<Text style={{ color: muted }}>No members yet.</Text>}
            renderItem={({ item }) => (
              <Swipeable renderRightActions={() => right(() =>
                Alert.alert('Remove member?', '', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: async () => { await deleteMember(groupId, item.id); load(); } },
                ])
              )}>
                <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: border }}>
                  <Text style={{ color: txt }}>{item.name}</Text>
                </View>
              </Swipeable>
            )}
          />
        </View>

        {/* Bills */}
        <View style={{ backgroundColor: card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: txt, fontWeight: '700' }}>Bills</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddBill', { groupId })}
              style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: accent, borderRadius: 8 }}
            >
              <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700' }}>Add Bill</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={group.bills}
            keyExtractor={(b: Bill) => b.id}
            ListEmptyComponent={<Text style={{ color: muted }}>No bills yet.</Text>}
            renderItem={({ item }) => (
              <Swipeable renderRightActions={() => right(() =>
                Alert.alert('Delete bill?', '', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => { await deleteBill(groupId, item.id); load(); } },
                ])
              )}>
                <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: border }}>
                  <Text style={{ color: txt, fontWeight: '600' }}>{item.title}</Text>
                  <Text style={{ color: muted, marginTop: 4 }}>
                    Final: ${item.finalAmount.toFixed(2)} • Paid by {group.members.find(m => m.id === item.paidBy)?.name ?? 'Unknown'}
                  </Text>
                </View>
              </Swipeable>
            )}
          />
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
