import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Alert, Switch, Pressable, Animated, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';
import { useProfileStore } from '../../store/profile';

type Row = { name: string; contact?: string };

const KEY_INCLUDE_ME = 'fingrow/ui/createGroup/includeMeDefault';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
];

const SwipeableMemberCard: React.FC<{
  row: Row;
  index: number;
  isMeRow: boolean;
  canDelete: boolean;
  onUpdate: (i: number, patch: Partial<Row>) => void;
  onRemove: (i: number) => void;
  inputStyle: any;
  placeholder: string;
  accentPrimary: string;
  textPrimary: string;
  textMuted: string;
  cardBg: string;
  borderSubtle: string;
  isDark: boolean;
}> = ({ row, index, isMeRow, canDelete, onUpdate, onRemove, inputStyle, placeholder, accentPrimary, textPrimary, textMuted, cardBg, borderSubtle, isDark }) => {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const [isDeleting, setIsDeleting] = useState(false);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return canDelete && Math.abs(gestureState.dx) > 10;
    },
    onPanResponderMove: (_, gestureState) => {
      if (canDelete && gestureState.dx < 0) {
        pan.x.setValue(Math.max(gestureState.dx, -100));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -60) {
        setIsDeleting(true);
        Animated.timing(pan.x, {
          toValue: -300,
          duration: 200,
          useNativeDriver: false,
        }).start(() => {
          onRemove(index);
          pan.x.setValue(0);
          setIsDeleting(false);
        });
      } else {
        Animated.spring(pan.x, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      }
    },
  }), [canDelete, index, onRemove, pan.x]);

  if (isDeleting) return null;

  return (
    <View style={{ position: 'relative' }}>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          backgroundColor: '#EF4444',
          borderRadius: radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="trash-2" size={20} color="#FFFFFF" />
      </View>
      <Animated.View
        style={{
          transform: [{ translateX: pan.x }],
          backgroundColor: cardBg,
          borderRadius: radius.lg,
          padding: spacing.s14,
          borderWidth: 1,
          borderColor: borderSubtle,
          gap: spacing.s10,
        }}
        {...(canDelete ? panResponder.panHandlers : {})}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
              }}
            >
              {isMeRow ? (
                <Icon name="user" size={16} colorToken="accent.primary" />
              ) : (
                <Text style={{ color: accentPrimary, fontWeight: '700', fontSize: 13 }}>{index + 1}</Text>
              )}
            </View>
            <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
              {isMeRow ? 'You' : `Member ${index + 1}`}
            </Text>
          </View>
          {canDelete && (
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '500' }}>
              Swipe left to delete
            </Text>
          )}
        </View>

        <TextInput
          value={row.name}
          onChangeText={t => onUpdate(index, { name: t })}
          placeholder={isMeRow ? row.name : 'Enter name'}
          editable={!isMeRow}
          placeholderTextColor={placeholder}
          style={[inputStyle, !isMeRow ? null : { opacity: 0.6 }]}
          autoCapitalize="words"
        />
        <TextInput
          value={row.contact}
          onChangeText={t => onUpdate(index, { contact: t })}
          placeholder="Email or phone (optional)"
          placeholderTextColor={placeholder}
          style={inputStyle}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Animated.View>
    </View>
  );
};

export default function CreateGroup() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { createGroup } = useGroupsStore();
  const { profile } = useProfileStore();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [rows, setRows] = useState<Row[]>([]);
  const [includeMe, setIncludeMe] = useState(true);
  const [remember, setRemember] = useState(false);

  const myName = profile?.name || 'Me';

  useEffect(() => {
    AsyncStorage.getItem(KEY_INCLUDE_ME).then(v => {
      if (v === 'true') setIncludeMe(true);
      if (v === 'false') setIncludeMe(false);
    });
  }, []);

  useEffect(() => {
    setRows(r => {
      const hasMe = r.some(x => x.name === myName);
      if (includeMe && !hasMe) return [{ name: myName, contact: profile?.email || '' }, ...r.length ? r : [{ name: '', contact: '' }]];
      if (!includeMe && hasMe) {
        const withoutMe = r.filter(x => x.name !== myName);
        return withoutMe.length ? withoutMe : [{ name: '', contact: '' }];
      }
      return r.length ? r : [{ name: '', contact: '' }];
    });
  }, [includeMe, myName, profile?.email]);

  const addRow = () => setRows(r => [...r, { name: '', contact: '' }]);
  const updateRow = (i: number, patch: Partial<Row>) => setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));

  const onSave = async () => {
    if (!name.trim()) { Alert.alert('Enter a group name'); return; }
    if (remember) await AsyncStorage.setItem(KEY_INCLUDE_ME, includeMe ? 'true' : 'false');
    const members = rows
      .map(r => ({ name: r.name.trim(), contact: r.contact?.trim() || undefined }))
      .filter(r => r.name.length > 0);
    const id = await createGroup({ name: name.trim(), note: note.trim() || undefined, members, currency });
    nav.replace('GroupDetail', { groupId: id });
  };

  const accentPrimary = get('accent.primary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const cardBg = get('surface.level1') as string;

  const inputStyle = useMemo(() => ({
    borderWidth: 1,
    borderColor: borderSubtle,
    borderRadius: radius.md,
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.s14,
    color: textPrimary,
    backgroundColor: surface2,
    fontSize: 15,
  }), [borderSubtle, textPrimary, surface2]);

  const placeholder = get('text.muted') as string;

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s20 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="x" size={24} color={textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
              Create group
            </Text>
          </View>
        </View>

        {/* Group Name */}
        <View style={{ gap: spacing.s10 }}>
          <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>Group name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Roommates, Weekend Trip"
            placeholderTextColor={placeholder}
            style={inputStyle}
            autoFocus
          />
        </View>

        {/* Currency Selection */}
        <View style={{ gap: spacing.s10 }}>
          <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>Currency</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {CURRENCIES.map(curr => (
              <Pressable
                key={curr.code}
                onPress={() => setCurrency(curr.code)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.s10,
                  paddingHorizontal: spacing.s14,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: currency === curr.code ? accentPrimary : borderSubtle,
                  backgroundColor: currency === curr.code ? withAlpha(accentPrimary, isDark ? 0.2 : 0.1) : cardBg,
                  opacity: pressed ? 0.7 : 1,
                  minWidth: 80,
                })}
              >
                <Text style={{
                  color: currency === curr.code ? accentPrimary : textPrimary,
                  fontWeight: currency === curr.code ? '700' : '600',
                  fontSize: 14,
                  textAlign: 'center',
                }}>
                  {curr.symbol} {curr.code}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Note (Optional) */}
        <View style={{ gap: spacing.s10 }}>
          <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
            Note <Text style={{ color: textMuted, fontWeight: '400' }}>(optional)</Text>
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a description or purpose for this group"
            placeholderTextColor={placeholder}
            style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        {/* Include Me Toggle */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: radius.lg,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: borderSubtle,
            gap: spacing.s12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: spacing.s12 }}>
              <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Include me in this group</Text>
              <Text style={{ color: textMuted, marginTop: spacing.s4, fontSize: 13 }}>
                Add yourself as a member to track your share
              </Text>
            </View>
            <Switch value={includeMe} onValueChange={setIncludeMe} />
          </View>

          {includeMe && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: surface2,
                borderRadius: radius.md,
                padding: spacing.s12,
              }}
            >
              <View style={{ flex: 1, paddingRight: spacing.s12 }}>
                <Text style={{ color: textPrimary, fontWeight: '500', fontSize: 14 }}>Remember this choice</Text>
                <Text style={{ color: textMuted, fontSize: 12, marginTop: 2 }}>
                  Use this as default for new groups
                </Text>
              </View>
              <Switch value={remember} onValueChange={setRemember} />
            </View>
          )}
        </View>

        {/* Members Section */}
        <View style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 17 }}>Members</Text>
            <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600' }}>
              {rows.filter(r => r.name.trim().length > 0).length} added
            </Text>
          </View>

          <View style={{ gap: spacing.s10 }}>
            {rows.map((row, i) => {
              const isMeRow = includeMe && row.name === myName;
              const canDelete = rows.length > 1 && !isMeRow;
              return (
                <SwipeableMemberCard
                  key={`${i}-${row.name || 'member'}`}
                  row={row}
                  index={i}
                  isMeRow={isMeRow}
                  canDelete={canDelete}
                  onUpdate={updateRow}
                  onRemove={removeRow}
                  inputStyle={inputStyle}
                  placeholder={placeholder}
                  accentPrimary={accentPrimary}
                  textPrimary={textPrimary}
                  textMuted={textMuted}
                  cardBg={cardBg}
                  borderSubtle={borderSubtle}
                  isDark={isDark}
                />
              );
            })}
          </View>

          <Pressable
            onPress={addRow}
            style={({ pressed }) => ({
              backgroundColor: cardBg,
              borderRadius: radius.lg,
              padding: spacing.s14,
              borderWidth: 1,
              borderColor: borderSubtle,
              borderStyle: 'dashed',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.s8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name="plus" size={20} colorToken="accent.primary" />
            <Text style={{ color: accentPrimary, fontWeight: '600', fontSize: 15 }}>
              Add member
            </Text>
          </Pressable>
        </View>

        {/* Action Buttons */}
        <View style={{ marginTop: spacing.s8 }}>
          <Button title="Create group" onPress={onSave} />
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
