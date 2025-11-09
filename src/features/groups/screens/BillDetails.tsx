import React, { useEffect, useState } from 'react';
import { View, Text, Switch, Share, Alert, Pressable, StyleSheet, ScrollView } from 'react-native';
import { ScreenScroll } from '../../../components/ScreenScroll';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useGroupsStore } from '../store';
import { scheduleDaily, cancel, listReminders } from '../../../lib/notifications';
import { formatCurrency } from '../../../lib/format';

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

const fmtTime = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = ((h % 12) || 12).toString();
  const mm = m.toString().padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hh}:${mm} ${ampm}`;
};

export default function BillDetails() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId, billId } = (route?.params ?? {}) as { groupId: string, billId: string };
  const { groups, findBill, markSplitPaid } = useGroupsStore();

  const group = groups.find(g => g.id === groupId);
  const bill = findBill(groupId, billId);

  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const list = await listReminders();
      const byKey: Record<string, boolean> = {};
      list.filter(r => r.groupId === groupId && r.billId === billId).forEach(r => byKey[r.key] = r.enabled !== false);
      setReminders(byKey);
    })();
  }, [groupId, billId]);

  if (!group || !bill) {
    return (
      <ScreenScroll>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>Bill</Text>
          <Text style={{ color: get('text.muted') as string }}>Bill not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  const memberName = (id: string) => group.members.find(m => m.id === id)?.name || '—';

  // Only count splits where contribution doesn't cover share as outstanding
  const remainingUnsettled = bill.splits
    .filter(s => {
      const contribution = bill.contributions.find(c => c.memberId === s.memberId);
      if (!contribution) return !s.settled; // Not a contributor, count if not settled

      // If contribution covers share, they don't owe anything
      if (contribution.amount >= s.share) return false;

      // Otherwise count the remainder if not settled
      return !s.settled;
    })
    .reduce((a,s)=>a+s.share,0);

  // All settled if all people who owe money have settled
  const allSettled = bill.splits
    .filter(s => {
      const contribution = bill.contributions.find(c => c.memberId === s.memberId);
      if (!contribution) return true; // Not a contributor, they need to settle

      // If contribution doesn't cover share, they need to settle
      return contribution.amount < s.share;
    })
    .every(s => s.settled);

  const shareText = () => {
    const lines = bill.splits.map(s => `${memberName(s.memberId)}: ${formatCurrency(s.share)}${s.settled ? ' (paid)' : ''}`);
    return `Bill: ${bill.title} • ${formatCurrency(bill.finalAmount)}\n` + lines.join('\n');
  };

  const toggleReminder = async (memberId: string, enable: boolean) => {
    const key = `${groupId}:${billId}:${memberId}`;
    if (enable) {
      try {
        await scheduleDaily(key, `Reminder: ${bill.title}`, `${memberName(memberId)} owes ${formatCurrency(bill.splits.find(s=>s.memberId===memberId)?.share||0)} in ${group.name}`, 19, groupId, billId, memberId);
      } catch (e: any) {
        Alert.alert('Notifications', e?.message || String(e));
        return;
      }
    } else {
      await cancel(key);
    }
    setReminders(r => ({ ...r, [key]: enable }));
  };

  const markPaid = async (memberId: string) => {
    await markSplitPaid(groupId, billId, memberId);
    await cancel(`${groupId}:${billId}:${memberId}`);
    nav.setParams({}); // refresh
  };

  const accentPrimary = get('accent.primary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const borderSubtle = get('border.subtle') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;
  const dangerColor = get('semantic.danger') as string;

  const billDate = new Date(bill.createdAt || Date.now());

  return (
    <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s20 }}>
        {/* Header with close and edit buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: allSettled
                ? withAlpha(successColor, isDark ? 0.25 : 0.15)
                : withAlpha(warningColor, isDark ? 0.25 : 0.15),
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.s10
            }}>
              <Text style={{ fontSize: 28 }}>
                {allSettled ? '✅' : '📄'}
              </Text>
            </View>
            <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: spacing.s4 }}>
              {bill.title}
            </Text>
            <Text style={{ color: textMuted, fontSize: 13, textAlign: 'center' }}>
              {formatCurrency(bill.finalAmount)} • {billDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at {fmtTime(billDate)}
            </Text>
          </View>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              position: 'absolute',
              top: 0,
              right: 0,
              padding: spacing.s6,
              borderRadius: radius.pill,
              backgroundColor: surface2,
              opacity: pressed ? 0.6 : 1,
            })}
            hitSlop={8}
          >
            <Icon name="x" size={18} color={textMuted} />
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('EditBill', { groupId, billId })}
            style={({ pressed }) => ({
              position: 'absolute',
              top: 0,
              left: 0,
              padding: spacing.s6,
              borderRadius: radius.pill,
              backgroundColor: surface2,
              opacity: pressed ? 0.6 : 1,
            })}
            hitSlop={8}
          >
            <Icon name="edit-3" size={18} color={accentPrimary} />
          </Pressable>
        </View>

        {/* Status Pills */}
        <View style={{
          flexDirection: 'row',
          gap: spacing.s12,
          justifyContent: 'center'
        }}>
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.pill,
            paddingVertical: spacing.s8,
            paddingHorizontal: spacing.s14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s6
          }}>
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: allSettled ? successColor : warningColor
            }} />
            <Text style={{
              color: textPrimary,
              fontSize: 13,
              fontWeight: '600'
            }}>
              {allSettled ? 'Settled' : 'Pending'}
            </Text>
          </View>
          {remainingUnsettled > 0.009 && (
            <View style={{
              backgroundColor: surface1,
              borderRadius: radius.pill,
              paddingVertical: spacing.s8,
              paddingHorizontal: spacing.s14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.s6
            }}>
              <Icon name="alert-circle" size={14} color={dangerColor} />
              <Text style={{
                color: textPrimary,
                fontSize: 13,
                fontWeight: '600'
              }}>
                {formatCurrency(remainingUnsettled)} outstanding
              </Text>
            </View>
          )}
        </View>

        {/* Who Paid */}
        <View>
          <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700', marginBottom: spacing.s12 }}>
            Paid by
          </Text>
          <View style={{ gap: spacing.s8 }}>
            {bill.contributions.map(c => {
              const member = group.members.find(m => m.id === c.memberId);
              if (!member) return null;
              const initials = member.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '?';

              return (
                <View
                  key={c.memberId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: surface1,
                    borderRadius: radius.lg,
                    padding: spacing.s14,
                    
                    
                    gap: spacing.s12
                  }}
                >
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: accentPrimary,
                  }}>
                    <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                      {initials}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                      {member.name}
                    </Text>
                    <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                      Paid the bill
                    </Text>
                  </View>
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                    {formatCurrency(c.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Split Details */}
        <View>
          <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700', marginBottom: spacing.s12 }}>
            Who owes what
          </Text>
          <View style={{ gap: spacing.s8 }}>
            {(() => {
              const nonPayerSplits = bill.splits.filter(s => {
                // Exclude people whose contribution covers their share
                const contribution = bill.contributions.find(c => c.memberId === s.memberId);
                if (!contribution) return true; // Not a contributor, so they owe their share

                // If they contributed more than or equal to their share, they don't owe anything
                return contribution.amount < s.share;
              });

              if (nonPayerSplits.length === 0) {
                return (
                  <View style={{
                    backgroundColor: surface1,
                    borderRadius: radius.lg,
                    padding: spacing.s16,
                    
                    
                    alignItems: 'center'
                  }}>
                    <Icon name="check-circle" size={48} color={successColor} />
                    <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginTop: spacing.s12 }}>
                      All Clear!
                    </Text>
                    <Text style={{ color: textMuted, fontSize: 14, marginTop: spacing.s4, textAlign: 'center' }}>
                      The person who paid has already covered this bill.
                    </Text>
                  </View>
                );
              }

              return nonPayerSplits.map(s => {
              const member = group.members.find(m => m.id === s.memberId);
              if (!member) return null;
              const initials = member.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '?';
              const reminderKey = `${groupId}:${billId}:${s.memberId}`;
              const hasReminder = !!reminders[reminderKey];

              return (
                <View
                  key={s.memberId}
                  style={{
                    backgroundColor: surface1,
                    borderRadius: radius.lg,
                    padding: spacing.s16,
                    
                    borderColor: s.settled ? withAlpha(successColor, 0.3) : borderSubtle,
                    gap: spacing.s12
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: s.settled
                        ? withAlpha(successColor, isDark ? 0.25 : 0.15)
                        : withAlpha(warningColor, isDark ? 0.25 : 0.15),
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: s.settled ? successColor : warningColor,
                    }}>
                      {s.settled ? (
                        <Icon name="check" size={20} color={successColor} />
                      ) : (
                        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                          {initials}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                        {member.name}
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                        {s.settled ? 'Settled' : 'Owes'}
                      </Text>
                    </View>
                    <Text style={{
                      color: s.settled ? successColor : textPrimary,
                      fontWeight: '700',
                      fontSize: 16
                    }}>
                      {formatCurrency(s.share)}
                    </Text>
                  </View>

                  {!s.settled && (
                    <View style={{
                      flexDirection: 'row',
                      gap: spacing.s8,
                      paddingTop: spacing.s12,
                      borderTopWidth: 1,
                      borderTopColor: borderSubtle
                    }}>
                      <Pressable
                        onPress={() => Share.share({
                          message: `Hey ${member.name}, please settle ${formatCurrency(s.share)} for "${bill.title}" in ${group.name}. Thanks!`
                        })}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: spacing.s6,
                          paddingVertical: spacing.s10,
                          borderRadius: radius.md,
                          backgroundColor: surface2,
                          opacity: pressed ? 0.7 : 1
                        })}
                      >
                        <Icon name="send" size={16} color={accentPrimary} />
                        <Text style={{ color: accentPrimary, fontWeight: '600', fontSize: 14 }}>
                          Nudge
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setTimeout(() => markPaid(s.memberId), 0)}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: spacing.s6,
                          paddingVertical: spacing.s10,
                          borderRadius: radius.md,
                          backgroundColor: successColor,
                          opacity: pressed ? 0.85 : 1
                        })}
                      >
                        <Icon name="check" size={16} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                          Mark Paid
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {!s.settled && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: spacing.s12,
                      borderTopWidth: 1,
                      borderTopColor: borderSubtle
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                        <Icon name="bell" size={16} color={textMuted} />
                        <Text style={{ color: textMuted, fontSize: 14 }}>
                          Daily reminder
                        </Text>
                      </View>
                      <Switch
                        value={hasReminder}
                        onValueChange={(v) => {
                          requestAnimationFrame(() => toggleReminder(s.memberId, v));
                        }}
                      />
                    </View>
                  )}
                </View>
              );
            });
            })()}
          </View>
        </View>

        {/* Share Breakdown */}
        <Pressable
          onPress={() => Share.share({ message: shareText() })}
          style={({ pressed }) => ({
            backgroundColor: surface1,
            borderRadius: radius.lg,
            padding: spacing.s16,
            
            
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.s10,
            opacity: pressed ? 0.7 : 1
          })}
        >
          <Icon name="share-2" size={20} color={accentPrimary} />
          <Text style={{ color: accentPrimary, fontWeight: '700', fontSize: 16 }}>
            Share Breakdown
          </Text>
        </Pressable>
      </View>
    </ScreenScroll>
  );
}
