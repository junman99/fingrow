import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Alert, Pressable, TextInput, Animated as RNAnimated, ScrollView } from 'react-native';
import BottomSheet from '../../../components/BottomSheet';
import Icon from '../../../components/Icon';
import { spacing, radius } from '../../../theme/tokens';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { useGroupsStore } from '../store';

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

type Props = {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  memberId?: string;
};

export default function AddMemberSheet({ visible, onClose, groupId, memberId }: Props) {
  const { get, isDark } = useThemeTokens();
  const { groups, addMember, updateMember } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);
  const member = group?.members.find(m => m.id === memberId);

  const [name, setName] = useState(member?.name || '');
  const [contact, setContact] = useState(member?.contact || '');

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const accentPrimary = get('accent.primary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;

  useEffect(() => {
    if (visible) {
      setName(member?.name || '');
      setContact(member?.contact || '');
    }
  }, [visible, member]);

  const onSave = async () => {
    if (!group) return;
    if (member) {
      await updateMember(groupId, member.id, { name: name.trim(), contact: contact.trim() });
    } else {
      if (!name.trim()) {
        Alert.alert('Enter a name');
        return;
      }
      await addMember(groupId, { name: name.trim(), contact: contact.trim() || undefined });
    }
    onClose();
  };

  const canSave = name.trim().length > 0;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase() || '').join('') || '?';

  const inputStyle = {
    borderRadius: radius.md,
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.s14,
    color: textPrimary,
    backgroundColor: surface2,
    fontSize: 15,
  };

  const placeholder = withAlpha(textMuted, 0.6);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ gap: spacing.s12 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 20 }}>
              {member ? 'Edit Member' : 'Add Member'}
            </Text>
          </View>

          {/* Member Card Preview */}
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.lg,
            padding: spacing.s14,
            gap: spacing.s10,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: withAlpha(accentPrimary, 0.3),
              }}>
                <Text style={{
                  color: accentPrimary,
                  fontWeight: '800',
                  fontSize: 15
                }}>
                  {initials}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: textPrimary,
                  fontWeight: '700',
                  fontSize: 16
                }} numberOfLines={1}>
                  {name.trim() || 'Member Name'}
                </Text>
                {contact.trim() ? (
                  <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                    {contact}
                  </Text>
                ) : (
                  <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                    No contact info
                  </Text>
                )}
              </View>
            </View>

            {/* Form Inputs */}
            <View style={{ gap: spacing.s8 }}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter name"
                placeholderTextColor={placeholder}
                style={inputStyle}
                autoCapitalize="words"
                autoFocus={!member}
              />
              <TextInput
                value={contact}
                onChangeText={setContact}
                placeholder="Email or phone (optional)"
                placeholderTextColor={placeholder}
                style={inputStyle}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
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

          {/* Save Button */}
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={({ pressed }) => ({
              backgroundColor: canSave ? accentPrimary : withAlpha(textMuted, isDark ? 0.15 : 0.1),
              paddingVertical: spacing.s14,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed && canSave ? 0.85 : 1,
            })}
          >
            <Text style={{
              color: canSave ? '#FFFFFF' : textMuted,
              fontWeight: '700',
              fontSize: 16
            }}>
              {member ? 'Save Changes' : 'Add Member'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
