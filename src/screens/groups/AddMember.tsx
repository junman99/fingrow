import React, { useEffect, useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { useThemeTokens } from '../../theme/ThemeProvider';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { spacing, radius } from '../../theme/tokens';
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenScroll>
        <View style={{ padding: spacing.s20, gap: spacing.s24, flex: 1 }}>
          {/* Header */}
          <View style={{ paddingTop: spacing.s8 }}>
            <Text style={{ color: get('text.primary') as string, fontSize: 28, fontWeight: '800' }}>
              {member ? 'Edit member' : 'Add member'}
            </Text>
            <Text style={{ color: get('text.muted') as string, fontSize: 14, marginTop: spacing.s8 }}>
              {member ? 'Update member details' : 'Add someone new to this group'}
            </Text>
          </View>

          {/* Form Card */}
          <View style={{
            backgroundColor: get('surface.level1') as string,
            borderRadius: radius.lg,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: get('border.subtle') as string,
            gap: spacing.s16,
          }}>
            <Input
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Alice"
              autoFocus={!member}
            />
            <Input
              label="Contact (optional)"
              value={contact}
              onChangeText={setContact}
              placeholder="@telegram or phone"
              autoCapitalize="none"
            />
          </View>

          {/* Helper text */}
          <Text style={{ color: get('text.muted') as string, fontSize: 13, marginTop: -spacing.s16 }}>
            Contact info helps you reach out for payments or reminders.
          </Text>

          {/* Spacer */}
          <View style={{ flex: 1, minHeight: spacing.s32 }} />

          {/* Actions */}
          <View style={{ gap: spacing.s12, paddingBottom: spacing.s16 }}>
            <Button title={member ? 'Save changes' : 'Add member'} onPress={onSave} variant="primary" />
            <Button title="Cancel" onPress={() => nav.goBack()} variant="secondary" />
          </View>
        </View>
      </ScreenScroll>
    </KeyboardAvoidingView>
  );
}
