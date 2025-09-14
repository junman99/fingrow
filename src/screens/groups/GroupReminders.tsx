
import React, { useEffect, useState } from 'react';
import { View, Text, Switch, Alert } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { AppHeader } from '../../components/AppHeader';
import Button from '../../components/Button';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useRoute } from '@react-navigation/native';
import { listReminders, toggleEnabled, cancel, getSettings, setSettings, selfTestOnce } from '../../lib/notifications';

export default function GroupReminders() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const [rem, setRem] = useState<any[]>([]);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [hour, setHour] = useState<number>(19);

  const refresh = async () => {
    const list = await listReminders();
    setRem(list.filter(r => r.groupId === groupId));
    const s = await getSettings();
    setEnabled(!!s.enabled);
    setHour(s.hour);
  };

  useEffect(() => {
    refresh();
  }, [groupId]);

  const onToggle = async (key: string, v: boolean) => {
    try {
      await toggleEnabled(key, v);
      refresh();
    } catch (e: any) {
      Alert.alert('Notifications', e?.message || String(e));
    }
  };

  const onCancel = async (key: string) => {
    await cancel(key);
    refresh();
  };

  const onToggleGlobal = async (v: boolean) => {
    await setSettings({ enabled: v });
    setEnabled(v);
  };

  const onSelfTest = async () => {
    try {
      await selfTestOnce(10);
      Alert.alert('Test scheduled', 'You should receive a notification in ~10 seconds.');
    } catch (e: any) {
      Alert.alert('Notifications', e?.message || String(e));
    }
  };

  return (
    <ScreenScroll>
      <AppHeader title="Reminders" />
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>

        {/* Global controls */}
        <View style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, gap: spacing.s8 }}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Notifications</Text>
            <View style={{ flexDirection:'row', alignItems:'center', gap: spacing.s8 }}>
              <Text style={{ color: get('text.muted') as string }}>Enable</Text>
              <Switch value={enabled} onValueChange={onToggleGlobal} />
            </View>
          </View>
          <Text style={{ color: get('text.muted') as string }}>Daily reminders default time: {String(hour).padStart(2,'0')}:00</Text>
          <Button variant="secondary" title="Run self‑test (10s)" onPress={onSelfTest} />
        </View>

        {/* Per-bill reminders */}
        {rem.length === 0 ? (
          <Text style={{ color: get('text.muted') as string }}>No reminders set for this group.</Text>
        ) : rem.map(r => (
          <View key={r.key} style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, gap: spacing.s8 }}>
            <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>{r.title}</Text>
            <Text style={{ color: get('text.muted') as string }}>{r.body}</Text>
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <Text style={{ color: get('text.muted') as string }}>Daily at {String(r.hour).padStart(2,'0')}:00</Text>
              <Switch value={!!r.enabled} onValueChange={(v)=>onToggle(r.key, v)} />
            </View>
            <Button variant="ghost" title="Delete" onPress={() => onCancel(r.key)} />
          </View>
        ))}
      </View>
    </ScreenScroll>
  );
}
