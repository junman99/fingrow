import React, { useState } from 'react';
import { View, Text, TextInput, Alert, Pressable, Switch } from 'react-native';
import { ScreenScroll } from '../../../components/ScreenScroll';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
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
  const [trackSpending, setTrackSpending] = useState(group?.trackSpending ?? false);
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
        note: note.trim() || undefined,
        trackSpending
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
    
    
    borderRadius: radius.md,
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.s14,
    color: textPrimary,
    backgroundColor: surface2,
    fontSize: 15,
  };

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, gap: spacing.s16 }}>
        {/* Handler */}
        <View style={{ alignSelf: 'center', width: 48, height: 4, borderRadius: 2, marginTop: spacing.s12, marginBottom: spacing.s12, backgroundColor: borderSubtle }} />

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.s12 }}>
          <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>
            Edit Group
          </Text>
        </View>

        {/* Group Details Card */}
        <View
          style={{
            backgroundColor: surface1,
            borderRadius: radius.lg,
            padding: spacing.s16,
            gap: spacing.s16,
          }}
        >
          {/* Group Name Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
              Group name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter group name"
              placeholderTextColor={placeholder}
              style={{ flex: 1, color: textPrimary, fontSize: 15, textAlign: 'right', marginLeft: spacing.s12 }}
            />
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          {/* Note Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
              Note
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a description or purpose"
              placeholderTextColor={placeholder}
              style={{ flex: 1, color: textPrimary, fontSize: 15, textAlign: 'right', marginLeft: spacing.s12 }}
              multiline={false}
            />
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          {/* Track in Spending Toggle Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Track in Spending</Text>
            <Switch
              value={trackSpending}
              onValueChange={setTrackSpending}
              trackColor={{ false: withAlpha(textMuted, 0.3), true: accentPrimary }}
              thumbColor={isDark ? '#fff' : '#fff'}
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={{ marginTop: spacing.s8 }}>
          <Button
            title={saving ? "Saving..." : "Save changes"}
            onPress={handleSave}
            disabled={saving}
          />
        </View>
      </View>
    </ScreenScroll>
  );
}
