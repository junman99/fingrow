import React, { useEffect, useState } from 'react';
import { View, Text, Switch, Alert, Pressable } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { listReminders, toggleEnabled, cancel, getSettings, setSettings, selfTestOnce } from '../../lib/notifications';

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

export default function GroupReminders() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const [rem, setRem] = useState<any[]>([]);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [hour, setHour] = useState<number>(19);

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const dangerColor = get('semantic.danger') as string;
  const successColor = get('semantic.success') as string;

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
    Alert.alert(
      'Delete reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await cancel(key);
          refresh();
        }}
      ]
    );
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
            <Icon name="chevron-left" size={28} color={textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
              Reminders
            </Text>
            <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s4 }}>
              {rem.length} {rem.length === 1 ? 'reminder' : 'reminders'} active
            </Text>
          </View>
        </View>

        {/* Global Notification Settings */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.lg,
          padding: spacing.s16,
          borderWidth: 1,
          borderColor: borderSubtle,
          gap: spacing.s12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: enabled
                ? withAlpha(successColor, isDark ? 0.25 : 0.15)
                : withAlpha(textMuted, isDark ? 0.15 : 0.1),
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icon name="bell" size={20} color={enabled ? successColor : textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>
                Enable notifications
              </Text>
              <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                {enabled ? 'Notifications are active' : 'Notifications are paused'}
              </Text>
            </View>
            <Switch value={enabled} onValueChange={onToggleGlobal} />
          </View>

          <View style={{
            padding: spacing.s12,
            backgroundColor: surface2,
            borderRadius: radius.md,
          }}>
            <Text style={{ color: textMuted, fontSize: 13 }}>
              Default notification time: <Text style={{ color: textPrimary, fontWeight: '600' }}>{String(hour).padStart(2, '0')}:00</Text>
            </Text>
          </View>

          <Button
            variant="secondary"
            title="Test notifications"
            icon="zap"
            onPress={onSelfTest}
          />
        </View>

        {/* Reminders List */}
        <View>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, marginBottom: spacing.s12 }}>
            Active Reminders
          </Text>

          {rem.length === 0 ? (
            <View style={{
              backgroundColor: surface1,
              borderRadius: radius.lg,
              padding: spacing.s24,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: borderSubtle,
            }}>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.1),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.s12,
              }}>
                <Icon name="bell-off" size={28} colorToken="accent.primary" />
              </View>
              <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>No reminders set</Text>
              <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s4, textAlign: 'center' }}>
                Reminders help you stay on top of pending payments
              </Text>
            </View>
          ) : (
            rem.map(r => (
              <View
                key={r.key}
                style={{
                  backgroundColor: surface1,
                  borderRadius: radius.lg,
                  padding: spacing.s16,
                  marginBottom: spacing.s12,
                  borderWidth: 1,
                  borderColor: borderSubtle,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12, marginBottom: spacing.s12 }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: r.enabled
                      ? withAlpha(accentPrimary, isDark ? 0.25 : 0.15)
                      : withAlpha(textMuted, isDark ? 0.15 : 0.1),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon name="bell" size={18} color={r.enabled ? accentPrimary : textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>
                      {r.title}
                    </Text>
                    <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                      {r.body}
                    </Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.s6,
                      marginTop: spacing.s8,
                    }}>
                      <Icon name="clock" size={14} colorToken="text.muted" />
                      <Text style={{ color: textMuted, fontSize: 12 }}>
                        Daily at {String(r.hour).padStart(2, '0')}:00
                      </Text>
                    </View>
                  </View>
                  <Switch value={!!r.enabled} onValueChange={(v) => onToggle(r.key, v)} />
                </View>

                <Pressable
                  onPress={() => onCancel(r.key)}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.s10,
                    borderRadius: radius.md,
                    backgroundColor: withAlpha(dangerColor, isDark ? 0.15 : 0.1),
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                    flexDirection: 'row',
                    gap: spacing.s6,
                    borderWidth: 1,
                    borderColor: withAlpha(dangerColor, 0.3),
                  })}
                >
                  <Icon name="trash-2" size={16} color={dangerColor} />
                  <Text style={{ color: dangerColor, fontWeight: '600', fontSize: 14 }}>Delete reminder</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </View>
    </ScreenScroll>
  );
}
