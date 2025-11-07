import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { useThemeTokens } from '../../theme/ThemeProvider';
import Input from '../../components/Input';
import Icon from '../../components/Icon';
import { spacing, radius } from '../../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useGroupsStore } from '../../store/groups';

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

export default function AddMember() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId, memberId, archiveToggle } = (route?.params ?? {}) as { groupId: string; memberId?: string; archiveToggle?: boolean };
  const { groups, addMember, updateMember, archiveMember } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);
  const member = group?.members.find(m => m.id === memberId);

  const [name, setName] = useState(member?.name || '');
  const [contact, setContact] = useState(member?.contact || '');

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;

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

  const canSave = name.trim().length > 0;

  return (
    <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s24 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s20 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              opacity: pressed ? 0.6 : 1,
            })}
            hitSlop={8}
          >
            <Icon name="x" size={28} color={textMuted} />
          </Pressable>
          <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' }}>
            {member ? 'Edit Member' : 'Add Member'}
          </Text>
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: canSave ? successColor : withAlpha(textMuted, isDark ? 0.15 : 0.1),
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
            hitSlop={8}
          >
            <Icon name="check" size={22} color={canSave ? "#FFFFFF" : textMuted} />
          </Pressable>
        </View>

        {/* Form Inputs - Direct on Background */}
        <View style={{ gap: spacing.s16, marginBottom: spacing.s16 }}>
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
        <View style={{
          padding: spacing.s12,
          backgroundColor: withAlpha(accentPrimary, isDark ? 0.1 : 0.08),
          borderRadius: radius.lg,
          flexDirection: 'row',
          gap: spacing.s10,
          alignItems: 'flex-start',
        }}>
          <Icon name="info" size={16} colorToken="accent.primary" style={{ marginTop: 2 }} />
          <Text style={{
            color: textMuted,
            fontSize: 13,
            flex: 1,
            lineHeight: 18,
          }}>
            Contact info helps you reach out for payments or reminders.
          </Text>
        </View>
      </View>
    </ScreenScroll>
  );
}
