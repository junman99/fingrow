import React, { useState, useMemo } from 'react';
import { View, Text, Alert, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, useAnimatedScrollHandler, interpolate, Extrapolate } from 'react-native-reanimated';
import { ScreenScroll } from '../../../components/ScreenScroll';
import Icon from '../../../components/Icon';
import { spacing, radius } from '../../../theme/tokens';
import { useThemeTokens } from '../../../theme/ThemeProvider';
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

export default function ManageMembers() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, archiveMember, deleteMember } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);
  const [showArchived, setShowArchived] = useState(false);

  // Main Tab Title Animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const originalTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );
    return {
      opacity: 1 - progress,
    };
  });

  const floatingTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );
    const fontSize = interpolate(progress, [0, 1], [28, 20]);
    const fontWeight = interpolate(progress, [0, 1], [800, 700]);
    return {
      fontSize,
      fontWeight: fontWeight.toString() as any,
      opacity: progress >= 1 ? 1 : progress,
    };
  });

  const gradientAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );
    return {
      opacity: progress >= 1 ? 1 : progress,
    };
  });

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const dangerColor = get('semantic.danger') as string;
  const warningColor = get('semantic.warning') as string;
  const bgDefault = get('background.default') as string;

  if (!group) {
    return (
      <ScreenScroll>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>Members</Text>
          <Text style={{ color: textMuted }}>Group not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  const canDelete: Record<string, boolean> = useMemo(() => {
    const used: Record<string, boolean> = {};
    (group.bills || []).forEach(b => {
      (b.contributions || []).forEach(c => { used[c.memberId] = true; });
      (b.splits || []).forEach(s => { used[s.memberId] = true; });
    });
    (group.settlements || []).forEach(s => { used[s.fromId] = true; used[s.toId] = true; });
    const out: Record<string, boolean> = {};
    group.members.forEach(m => { out[m.id] = !used[m.id]; });
    return out;
  }, [group]);

  const askArchive = (memberId: string, name: string, isArchived: boolean) => {
    if (isArchived) {
      // Restore without confirmation
      archiveMember(group.id, memberId, false);
    } else {
      // Archive with confirmation
      Alert.alert(
        'Archive Member',
        `Archive ${name}? You can restore them later from the archived section.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Archive', style: 'destructive', onPress: () => archiveMember(group.id, memberId, true) }
        ]
      );
    }
  };

  const askDelete = (memberId: string, name: string) => {
    Alert.alert(
      'Delete Member',
      `Permanently delete ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteMember(group.id, memberId);
          } catch (e: any) {
            Alert.alert('Cannot delete', e?.message || String(e));
          }
        }}
      ]
    );
  };

  const MemberRow = ({ m, isLast }: { m: any; isLast: boolean }) => {
    const deletable = canDelete[m.id];
    const initials = m.name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase() || '').join('') || '?';

    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.s12,
        paddingHorizontal: spacing.s16,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: borderSubtle,
      }}>
        {/* Avatar and Info */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: m.archived
              ? withAlpha(textMuted, isDark ? 0.15 : 0.1)
              : withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: m.archived ? borderSubtle : withAlpha(accentPrimary, 0.3),
          }}>
            <Text style={{
              color: m.archived ? textMuted : accentPrimary,
              fontWeight: '800',
              fontSize: 14
            }}>
              {initials}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{
              color: m.archived ? textMuted : textPrimary,
              fontWeight: '600',
              fontSize: 15
            }} numberOfLines={1}>
              {m.name}
              {m.archived && <Text style={{ color: textMuted, fontWeight: '500', fontSize: 13 }}> (Archived)</Text>}
            </Text>
            {m.contact && (
              <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                {m.contact}
              </Text>
            )}
          </View>
        </View>

        {/* Action Icons */}
        <View style={{ flexDirection: 'row', gap: spacing.s4, alignItems: 'center' }}>
          {/* Edit */}
          <Pressable
            onPress={() => nav.navigate('AddMember', { groupId: group.id, memberId: m.id })}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: pressed ? surface2 : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            })}
            hitSlop={4}
          >
            <Icon name="edit-3" size={18} colorToken="accent.primary" />
          </Pressable>

          {/* Archive/Restore */}
          <Pressable
            onPress={() => askArchive(m.id, m.name, m.archived)}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: pressed ? surface2 : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            })}
            hitSlop={4}
          >
            <Icon
              name={m.archived ? "archive-restore" : "archive"}
              size={18}
              color={m.archived ? accentPrimary : warningColor}
            />
          </Pressable>

          {/* Delete (only if no transaction history) */}
          {deletable && (
            <Pressable
              onPress={() => askDelete(m.id, m.name)}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: pressed ? withAlpha(dangerColor, 0.1) : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              })}
              hitSlop={4}
            >
              <Icon name="trash-2" size={18} color={dangerColor} />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const active = group.members.filter(m => !m.archived);
  const archived = group.members.filter(m => m.archived);

  return (
    <>
      {/* Floating Gradient Header */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: -insets.top,
            left: 0,
            right: 0,
            zIndex: 10,
            pointerEvents: 'none',
          },
          gradientAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={[
            bgDefault,
            bgDefault,
            withAlpha(bgDefault, 0.95),
            withAlpha(bgDefault, 0.8),
            withAlpha(bgDefault, 0.5),
            withAlpha(bgDefault, 0)
          ]}
          style={{
            paddingTop: insets.top + spacing.s16,
            paddingBottom: spacing.s32 + spacing.s20,
            paddingHorizontal: spacing.s16,
          }}
        >
          <Animated.Text
            style={[
              {
                color: textPrimary,
                fontSize: 20,
                fontWeight: '700',
                letterSpacing: -0.5,
                textAlign: 'center',
              },
              floatingTitleAnimatedStyle,
            ]}
          >
            Manage Members
          </Animated.Text>
        </LinearGradient>
      </Animated.View>

      <ScreenScroll
        inTab
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentStyle={{
          paddingTop: spacing.s16,
          paddingBottom: 0,
        }}
      >
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s20 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginBottom: spacing.s8 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={({ pressed }) => ({
                padding: spacing.s8,
                marginLeft: -spacing.s8,
                marginTop: -spacing.s4,
                borderRadius: radius.md,
                backgroundColor: pressed ? surface1 : 'transparent',
              })}
              hitSlop={8}
            >
              <Icon name="x" size={28} color={textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Animated.Text style={[{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.s2 }, originalTitleAnimatedStyle]}>
                Manage Members
              </Animated.Text>
            </View>
          </View>

        {/* Add Member Button */}
        <Pressable
          onPress={() => nav.navigate('AddMember', { groupId: group.id })}
          style={({ pressed }) => ({
            backgroundColor: surface1,
            borderRadius: radius.lg,
            padding: spacing.s14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.s8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="user-plus" size={20} colorToken="accent.primary" />
          <Text style={{ color: accentPrimary, fontWeight: '600', fontSize: 15 }}>
            Add member
          </Text>
        </Pressable>

        {/* Active Members */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s12 }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 17 }}>Active Members</Text>
            <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600' }}>
              {active.length} member{active.length === 1 ? '' : 's'}
            </Text>
          </View>
          {active.length === 0 ? (
            <View style={{
              backgroundColor: surface1,
              borderRadius: radius.lg,
              padding: spacing.s24,
              alignItems: 'center',
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
                <Icon name="users-2" size={28} colorToken="accent.primary" />
              </View>
              <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>No active members</Text>
              <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s4, textAlign: 'center' }}>
                Add members to start splitting bills
              </Text>
            </View>
          ) : (
            <View style={{
              backgroundColor: surface1,
              borderRadius: radius.lg,
              overflow: 'hidden',
            }}>
              {active.map((m, idx) => (
                <MemberRow key={m.id} m={m} isLast={idx === active.length - 1} />
              ))}
            </View>
          )}
        </View>

        {/* Archived Members */}
        {archived.length > 0 && (
          <View>
            <Pressable
              onPress={() => setShowArchived(s => !s)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s16,
                backgroundColor: pressed ? surface1 : 'transparent',
                borderRadius: radius.md,
                marginBottom: showArchived ? spacing.s12 : 0,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 17 }}>
                  Archived Members
                </Text>
                <View style={{
                  backgroundColor: withAlpha(textMuted, isDark ? 0.15 : 0.1),
                  paddingHorizontal: spacing.s8,
                  paddingVertical: spacing.s4,
                  borderRadius: radius.sm,
                }}>
                  <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700' }}>
                    {archived.length}
                  </Text>
                </View>
              </View>
              <Icon
                name={showArchived ? "chevron-up" : "chevron-down"}
                size={20}
                colorToken="text.muted"
              />
            </Pressable>
            {showArchived && (
              <View style={{
                backgroundColor: surface1,
                borderRadius: radius.lg,
                overflow: 'hidden',
              }}>
                {archived.map((m, idx) => (
                  <MemberRow key={m.id} m={m} isLast={idx === archived.length - 1} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Extra spacing to extend to bottom */}
        <View style={{ height: spacing.s32 }} />
      </View>
    </ScreenScroll>
    </>
  );
}
