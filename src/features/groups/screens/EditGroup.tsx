import React, { useState } from 'react';
import { View, Text, TextInput, Alert, Pressable } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
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

export default function EditGroup() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, updateGroup } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);

  const [name, setName] = useState(group?.name || '');
  const [note, setNote] = useState(group?.note || '');
  const [saving, setSaving] = useState(false);

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const placeholder = textMuted;

  if (!group) {
    return (
      <ScreenScroll>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800' }}>Edit Group</Text>
          <Text style={{ color: textMuted, marginTop: spacing.s8 }}>Group not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }

    try {
      setSaving(true);
      await updateGroup(group.id, {
        name: name.trim(),
        note: note.trim() || undefined
      });
      Alert.alert('Success', 'Group updated successfully', [
        { text: 'OK', onPress: () => nav.goBack() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: borderSubtle,
    borderRadius: radius.md,
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.s14,
    color: textPrimary,
    backgroundColor: surface2,
    fontSize: 15,
  };

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              borderRadius: radius.md,
              backgroundColor: pressed ? surface1 : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="x" size={28} color={textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
              Edit Group
            </Text>
            <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s4 }}>
              Update group details
            </Text>
          </View>
        </View>

        {/* Group Name */}
        <View style={{ gap: spacing.s10 }}>
          <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>Group name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter group name"
            placeholderTextColor={placeholder}
            style={inputStyle}
          />
        </View>

        {/* Note (Optional) */}
        <View style={{ gap: spacing.s10 }}>
          <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
            Description <Text style={{ color: textMuted, fontWeight: '400' }}>(optional)</Text>
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a description or purpose for this group"
            placeholderTextColor={placeholder}
            style={[inputStyle, { minHeight: 100, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        {/* Save Button */}
        <Button
          title={saving ? "Saving..." : "Save changes"}
          onPress={handleSave}
          disabled={saving}
        />
      </View>
    </ScreenScroll>
  );
}
