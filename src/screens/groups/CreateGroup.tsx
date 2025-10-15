import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Alert, Switch, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';

type Row = { name: string; contact?: string };

const KEY_INCLUDE_ME = 'fingrow/ui/createGroup/includeMeDefault';

export default function CreateGroup() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { createGroup } = useGroupsStore();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [includeMe, setIncludeMe] = useState(true);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY_INCLUDE_ME).then(v => {
      if (v === 'true') setIncludeMe(true);
      if (v === 'false') setIncludeMe(false);
    });
  }, []);

  useEffect(() => {
    setRows(r => {
      const hasMe = r.some(x => x.name === 'Me');
      if (includeMe && !hasMe) return [{ name: 'Me', contact: '' }, ...r.length ? r : [{ name: '', contact: '' }]];
      if (!includeMe && hasMe) {
        const withoutMe = r.filter(x => x.name !== 'Me');
        return withoutMe.length ? withoutMe : [{ name: '', contact: '' }];
      }
      return r.length ? r : [{ name: '', contact: '' }];
    });
  }, [includeMe]);

  const addRow = () => setRows(r => [...r, { name: '', contact: '' }]);
  const updateRow = (i: number, patch: Partial<Row>) => setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));

  const onSave = async () => {
    if (!name.trim()) { Alert.alert('Enter a group name'); return; }
    if (remember) await AsyncStorage.setItem(KEY_INCLUDE_ME, includeMe ? 'true' : 'false');
    const members = rows
      .map(r => ({ name: r.name.trim(), contact: r.contact?.trim() || undefined }))
      .filter(r => r.name.length > 0);
    const id = await createGroup({ name: name.trim(), note: note.trim() || undefined, members });
    nav.replace('GroupDetail', { groupId: id });
  };

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const cardBorder = isDark ? withAlpha(borderSubtle, 0.6) : borderSubtle;
  const heroText = '#f5f8ff';
  const heroTextMuted = 'rgba(245,248,255,0.72)';
  const heroGradient: [string, string] = isDark ? ['#0e121f', '#19152c'] : [accentPrimary, accentSecondary];

  const sectionCard = useMemo(() => ({
    backgroundColor: surface1,
    borderRadius: radius.xl,
    padding: spacing.s16,
    gap: spacing.s12,
    borderWidth: 1,
    borderColor: cardBorder
  }), [surface1, cardBorder]);

  const inputStyle = useMemo(() => ({
    borderWidth: 1,
    borderColor: borderSubtle,
    borderRadius: radius.lg,
    paddingVertical: spacing.s10,
    paddingHorizontal: spacing.s12,
    color: textPrimary,
    backgroundColor: surface2
  }), [borderSubtle, radius.lg, spacing.s10, spacing.s12, textPrimary, surface2]);

  const toggleRowStyle = useMemo(() => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: surface2,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.s12,
    paddingVertical: spacing.s10
  }), [surface2, radius.lg, spacing.s12, spacing.s10]);

  const placeholder = get('text.muted') as string;

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s12,
            overflow: 'hidden'
          }}
        >
          <Text style={{ color: heroTextMuted, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '700' }}>
            New shared group
          </Text>
          <Text style={{ color: heroText, fontSize: 26, fontWeight: '800', lineHeight: 32 }}>
            Give your crew a name and start splitting in seconds.
          </Text>
          <Text style={{ color: heroTextMuted, fontSize: 14, lineHeight: 20 }}>
            Add the people you share expenses with, decide if you want to include yourself, and we’ll keep every balance ready for the first bill.
          </Text>
        </LinearGradient>

        <View style={sectionCard}>
          <View>
            <Text style={{ color: textMuted, fontSize: 12, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.6 }}>Group name</Text>
            <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700', marginTop: spacing.s4 }}>What should we call this group?</Text>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Roomies, Trip to Bali"
            placeholderTextColor={placeholder}
            style={inputStyle}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={placeholder}
            style={[inputStyle, { minHeight: 72, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        <View style={sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: spacing.s8 }}>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Include yourself?</Text>
              <Text style={{ color: textMuted, marginTop: spacing.s4 }}>Automatically add “Me” as a member so your share is tracked.</Text>
            </View>
            <Switch value={includeMe} onValueChange={setIncludeMe} />
          </View>
          <View style={toggleRowStyle}>
            <View style={{ flex: 1, paddingRight: spacing.s8 }}>
              <Text style={{ color: textPrimary, fontWeight: '600' }}>Remember this choice</Text>
              <Text style={{ color: textMuted, fontSize: 12, marginTop: 4 }}>We’ll default to this preference next time.</Text>
            </View>
            <Switch value={remember} onValueChange={setRemember} />
          </View>
        </View>

        <View style={sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Group members</Text>
            <Text style={{ color: textMuted, fontSize: 13 }}>
              {rows.filter(r => r.name.trim().length > 0).length} ready
            </Text>
          </View>
          <Text style={{ color: textMuted, fontSize: 13 }}>
            Add everyone sharing bills. You can fill in contact info to keep track of emails or handles.
          </Text>

          <View style={{ gap: spacing.s12 }}>
            {rows.map((row, i) => {
              const isMeRow = includeMe && row.name === 'Me';
              return (
                <View key={`${i}-${row.name || 'member'}`} style={{
                  backgroundColor: surface2,
                  borderRadius: radius.lg,
                  padding: spacing.s12,
                  borderWidth: 1,
                  borderColor: withAlpha(borderSubtle, 0.8),
                  gap: spacing.s8
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <View style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: withAlpha(accentPrimary, 0.18)
                      }}>
                        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 12 }}>{i + 1}</Text>
                      </View>
                      <Text style={{ color: textPrimary, fontWeight: '700' }}>{isMeRow ? 'You' : 'Member'}</Text>
                    </View>
                    {rows.length > 1 && !isMeRow ? (
                      <Pressable hitSlop={12} onPress={() => removeRow(i)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.s4,
                          paddingHorizontal: spacing.s8,
                          paddingVertical: spacing.s6
                        }}>
                          <Icon name="trash" size={16} colorToken="text.muted" />
                          <Text style={{ color: textMuted, fontWeight: '600', fontSize: 12 }}>Remove</Text>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>

                  <TextInput
                    value={row.name}
                    onChangeText={t => updateRow(i, { name: t })}
                    placeholder={isMeRow ? 'Me' : 'Name'}
                    editable={!isMeRow}
                    placeholderTextColor={placeholder}
                    style={[inputStyle, !isMeRow ? null : { opacity: 0.6 }]}
                    autoCapitalize="words"
                  />
                  <TextInput
                    value={row.contact}
                    onChangeText={t => updateRow(i, { contact: t })}
                    placeholder="Contact (optional)"
                    placeholderTextColor={placeholder}
                    style={inputStyle}
                    autoCapitalize="none"
                  />
                </View>
              );
            })}
          </View>

          <Button
            variant="secondary"
            title="+ Add another member"
            onPress={addRow}
            style={{ alignSelf: 'flex-start', paddingHorizontal: spacing.s16 }}
          />
        </View>

        <View style={{ gap: spacing.s12 }}>
          <Button title="Create group" onPress={onSave} />
          <Button variant="ghost" title="Cancel" onPress={() => nav.goBack()} />
        </View>
      </View>
    </ScreenScroll>
  );
}

function withAlpha(hex: string, alpha: number) {
  if (!hex || typeof hex !== 'string') return hex;
  if (hex.startsWith('#')) {
    const clean = hex.slice(1, 7);
    const padded = clean.length === 6 ? clean : clean.padEnd(6, '0');
    const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
    return `#${padded}${a}`;
  }
  if (hex.startsWith('rgba')) {
    return hex.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
      const parts = inner.split(',').map(p => p.trim());
      if (parts.length < 3) return hex;
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }
  return hex;
}
