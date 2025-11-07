import React, { useState, useMemo } from 'react';
import { View, Text, Alert, Pressable, ScrollView } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { useThemeTokens } from '../../theme/ThemeProvider';
import Icon from '../../components/Icon';
import { spacing, radius } from '../../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useGroupsStore } from '../store';
import { scheduleDaily, getSettings } from '../../lib/notifications';

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

export default function AddReminder() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);

  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [hour, setHour] = useState<number>(19);

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;

  React.useEffect(() => {
    getSettings().then(s => setHour(s.hour));
  }, []);

  // Get unpaid bills with members who haven't paid
  const unpaidBills = useMemo(() => {
    if (!group) return [];
    return group.bills
      .map(bill => {
        const unpaidMembers = bill.splits.filter(s => !s.settled).map(s => s.memberId);
        return { bill, unpaidMembers };
      })
      .filter(item => item.unpaidMembers.length > 0);
  }, [group]);

  const selectedBill = unpaidBills.find(item => item.bill.id === selectedBillId);
  const selectedMember = group?.members.find(m => m.id === selectedMemberId);
  const selectedSplit = selectedBill?.bill.splits.find(s => s.memberId === selectedMemberId);

  const canSave = selectedBillId && selectedMemberId;

  const onSave = async () => {
    if (!group || !selectedBill || !selectedMember || !selectedSplit) return;

    try {
      const key = `${groupId}:${selectedBillId}:${selectedMemberId}`;
      const amount = selectedSplit.share.toFixed(2);
      const title = `Payment Reminder`;
      const body = `${selectedMember.name} owes $${amount} for "${selectedBill.bill.title}"`;

      await scheduleDaily(key, title, body, hour, groupId, selectedBillId, selectedMemberId);
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || String(e));
    }
  };

  if (!group) {
    return (
      <ScreenScroll contentStyle={{ paddingBottom: spacing.s24 }}>
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16 }}>
          <Text style={{ color: textPrimary }}>Group not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s24 }}>
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
              Add Reminder
            </Text>
          </View>
        </View>

        {/* No unpaid bills message */}
        {unpaidBills.length === 0 && (
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
              <Icon name="check-circle" size={28} colorToken="accent.primary" />
            </View>
            <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>All bills settled!</Text>
            <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s4, textAlign: 'center' }}>
              There are no pending payments to remind about
            </Text>
          </View>
        )}

        {/* Select Bill */}
        {unpaidBills.length > 0 && (
          <View style={{ gap: spacing.s16 }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
              Select Bill
            </Text>
            {unpaidBills.map(({ bill, unpaidMembers }) => (
              <Pressable
                key={bill.id}
                onPress={() => {
                  setSelectedBillId(bill.id);
                  setSelectedMemberId(null);
                }}
                style={({ pressed }) => ({
                  backgroundColor: selectedBillId === bill.id ? withAlpha(accentPrimary, isDark ? 0.2 : 0.1) : surface1,
                  borderRadius: radius.lg,
                  padding: spacing.s16,
                  borderWidth: 2,
                  borderColor: selectedBillId === bill.id ? accentPrimary : borderSubtle,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: selectedBillId === bill.id
                      ? withAlpha(accentPrimary, isDark ? 0.25 : 0.15)
                      : withAlpha(textMuted, isDark ? 0.15 : 0.1),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon name="receipt" size={18} color={selectedBillId === bill.id ? accentPrimary : textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>
                      {bill.title}
                    </Text>
                    <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                      ${bill.finalAmount.toFixed(2)} • {unpaidMembers.length} unpaid {unpaidMembers.length === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                  {selectedBillId === bill.id && (
                    <Icon name="check-circle" size={20} color={accentPrimary} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Select Member */}
        {selectedBill && (
          <View style={{ gap: spacing.s16 }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
              Select Member to Remind
            </Text>
            {selectedBill.unpaidMembers.map(memberId => {
              const member = group.members.find(m => m.id === memberId);
              const split = selectedBill.bill.splits.find(s => s.memberId === memberId);
              if (!member || !split) return null;

              const initials = member.name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase() || '').join('') || '?';

              return (
                <Pressable
                  key={memberId}
                  onPress={() => setSelectedMemberId(memberId)}
                  style={({ pressed }) => ({
                    backgroundColor: selectedMemberId === memberId ? withAlpha(accentPrimary, isDark ? 0.2 : 0.1) : surface1,
                    borderRadius: radius.lg,
                    padding: spacing.s16,
                    borderWidth: 2,
                    borderColor: selectedMemberId === memberId ? accentPrimary : borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: selectedMemberId === memberId
                        ? withAlpha(accentPrimary, isDark ? 0.25 : 0.15)
                        : withAlpha(textMuted, isDark ? 0.15 : 0.1),
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: selectedMemberId === memberId ? withAlpha(accentPrimary, 0.3) : borderSubtle,
                    }}>
                      <Text style={{
                        color: selectedMemberId === memberId ? accentPrimary : textMuted,
                        fontWeight: '800',
                        fontSize: 14
                      }}>
                        {initials}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>
                        {member.name}
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                        Owes ${split.share.toFixed(2)}
                      </Text>
                    </View>
                    {selectedMemberId === memberId && (
                      <Icon name="check-circle" size={20} color={accentPrimary} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Time Selection */}
        {selectedMemberId && (
          <View style={{ gap: spacing.s12 }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
              Reminder Time
            </Text>
            <View style={{
              backgroundColor: surface1,
              borderRadius: radius.lg,
              padding: spacing.s16,
              borderWidth: 1,
              borderColor: borderSubtle,
            }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s8 }}>
                {Array.from({ length: 24 }, (_, i) => i).map(h => (
                  <Pressable
                    key={h}
                    onPress={() => setHour(h)}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.s16,
                      paddingVertical: spacing.s10,
                      borderRadius: radius.md,
                      backgroundColor: hour === h ? accentPrimary : surface2,
                      opacity: pressed ? 0.7 : 1,
                      minWidth: 60,
                      alignItems: 'center',
                    })}
                  >
                    <Text style={{
                      color: hour === h ? '#FFFFFF' : textPrimary,
                      fontWeight: hour === h ? '700' : '600',
                      fontSize: 15,
                    }}>
                      {String(h).padStart(2, '0')}:00
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Save Button */}
        {canSave && (
          <Pressable
            onPress={onSave}
            style={({ pressed }) => ({
              backgroundColor: successColor,
              paddingVertical: spacing.s16,
              borderRadius: radius.lg,
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: spacing.s8,
            })}
          >
            <Icon name="check" size={20} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
              Create Reminder
            </Text>
          </Pressable>
        )}
      </View>
    </ScreenScroll>
  );
}
