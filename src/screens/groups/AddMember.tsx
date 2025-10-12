import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { useThemeTokens } from '../../theme/ThemeProvider';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { spacing } from '../../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useGroupsStore } from '../../store/groups';

export default function AddMember() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId, memberId, archiveToggle } = (route?.params ?? {}) as { groupId: string; memberId?: string; archiveToggle?: boolean };
  const { groups, addMember, updateMember, archiveMember } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);
  const member = group?.members.find(m => m.id === memberId);

  const [name, setName] = useState(member?.name || '');
  const [contact, setContact] = useState(member?.contact || '');

  useEffect(() => {
    if (archiveToggle && member) {
      archiveMember(groupId, memberId!, !member.archived).then(()=> nav.goBack());
    }
  }, []);

  const onSave = async () => {
    if (!group) return;
    if (member) {
      await updateMember(groupId, member.id, { name: name.trim(), contact: contact.trim() });
    } else {
      if (!name.trim()) { Alert.alert('Enter a name'); return; }
      await addMember(groupId, { name: name.trim(), contact: contact.trim() || undefined });
    }
    nav.goBack();
  };

  return (
    <ScreenScroll>
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>{member ? 'Edit member' : 'Add member'}</Text>
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Alice" />
        <Input label="Contact (optional)" value={contact} onChangeText={setContact} placeholder="@telegram or phone" />
        <Button title="Save" onPress={onSave} />
      </View>
    </ScreenScroll>
  );
}
