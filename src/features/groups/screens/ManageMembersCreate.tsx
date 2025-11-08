import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Animated, PanResponder } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../../components/ScreenScroll';
import { Screen } from '../../../components/Screen';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';

type Row = { name: string; contact?: string };

// Global callback to update parent state
let updateParentCallback: ((rows: Row[]) => void) | null = null;

export function setMembersUpdateCallback(callback: (rows: Row[]) => void) {
  updateParentCallback = callback;
}

const MemberCard: React.FC<{
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
  inputRef?: React.RefObject<TextInput>;
}> = ({ row, index, isMeRow, canDelete, onUpdate, onRemove, inputStyle, placeholder, accentPrimary, textPrimary, textMuted, cardBg, borderSubtle, isDark, inputRef }) => {
  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: radius.lg,
        padding: spacing.s14,
        gap: spacing.s10,
      }}
    >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10, flex: 1 }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: isMeRow ? accentPrimary + (isDark ? '33' : '22') : borderSubtle,
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Text style={{ color: isMeRow ? accentPrimary : textMuted, fontSize: 14, fontWeight: '800' }}>
                {row.name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?'}
              </Text>
            </View>
            <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
              {isMeRow ? `${row.name} (Me)` : (row.name || 'Member')}
            </Text>
          </View>
          {canDelete && (
            <Pressable
              onPress={() => onRemove(index)}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#EF4444',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name="trash" size={18} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
        {!isMeRow && (
          <View style={{ gap: spacing.s8 }}>
            <TextInput
              ref={inputRef}
              value={row.name}
              onChangeText={(v) => onUpdate(index, { name: v })}
              placeholder="Member name"
              placeholderTextColor={placeholder}
              style={[inputStyle, { textAlign: 'right' }]}
            />
            <TextInput
              value={row.contact || ''}
              onChangeText={(v) => onUpdate(index, { contact: v })}
              placeholder="Email or phone (optional)"
              placeholderTextColor={placeholder}
              style={[inputStyle, { textAlign: 'right' }]}
              keyboardType="email-address"
            />
          </View>
        )}
    </View>
  );
};

export default function ManageMembersCreate() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { rows: initialRows, includeMe: initialIncludeMe, myName, onUpdate } = route.params || {};

  const [rows, setRows] = useState<Row[]>(initialRows || []);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const firstInputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Auto-focus first member name input after animation
    const timer = setTimeout(() => {
      firstInputRef.current?.focus();
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const addRow = () => setRows(r => [...r, { name: '', contact: '' }]);
  const updateRow = (i: number, patch: Partial<Row>) => setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));

  const handleDone = () => {
    if (updateParentCallback) {
      updateParentCallback(rows);
    }
    nav.goBack();
  };

  const accentPrimary = get('accent.primary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const cardBg = get('surface.level1') as string;

  const inputStyle = {
    borderRadius: radius.md,
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.s14,
    color: textPrimary,
    backgroundColor: surface2,
    fontSize: 15,
  };

  const placeholder = get('text.muted') as string;

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ScreenScroll allowBounce={false} inTab>
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.s12 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              position: 'absolute',
              left: -spacing.s8,
              padding: spacing.s8,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
          >
            <Icon name="chevron-left" size={28} color={textPrimary} />
          </Pressable>
          <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>
            Manage Members
          </Text>
        </View>

        <View style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 17 }}>Members</Text>
            <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600' }}>
              {rows.filter(r => r.name.trim().length > 0).length} added
            </Text>
          </View>

          <View style={{ gap: spacing.s10 }}>
            {rows.map((row, i) => {
              const isMeRow = initialIncludeMe && row.name === myName;
              const canDelete = rows.length > 1 && !isMeRow;
              const isFirstNonMeRow = !isMeRow && rows.slice(0, i).every(r => initialIncludeMe && r.name === myName);
              return (
                <MemberCard
                  key={i}
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
                  inputRef={isFirstNonMeRow ? firstInputRef : undefined}
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

        <View style={{ marginTop: spacing.s8 }}>
          <Button title="Done" onPress={handleDone} />
        </View>
      </View>
      </ScreenScroll>
    </Animated.View>
  );
}
