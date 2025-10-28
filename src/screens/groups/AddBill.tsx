import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import DateTimeSheet from '../../components/DateTimeSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';
import { formatCurrency } from '../../lib/format';
import type { ID } from '../../types/groups';

const KEY_ADVANCED_OPEN = 'fingrow/ui/addbill/advancedOpen';

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

export default function AddBill() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, addBill } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<string | null>(null);

  const activeMembers = useMemo(() => group?.members.filter(m => !m.archived) ?? [], [group]);
  const [participants, setParticipants] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(activeMembers.map(m => [m.id, true]))
  );
  const participantIds = Object.entries(participants).filter(([_, v]) => v).map(([k]) => k);

  const [mode, setMode] = useState<'equal' | 'exact'>('equal');
  const [exacts, setExacts] = useState<Record<string, string>>({});

  // Tax & Fees
  const [showTaxFees, setShowTaxFees] = useState(false);
  const [tax, setTax] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [vat, setVat] = useState('');

  // Date & Time
  const [billDate, setBillDate] = useState(new Date());
  const [dtOpen, setDtOpen] = useState(false);

  const amountNum = useMemo(() => Number(amount) || 0, [amount]);
  const sumExacts = useMemo(() => participantIds.reduce((acc, id) => acc + (Number(exacts[id] || 0) || 0), 0), [exacts, participantIds]);

  // Calculate total tax/fees
  const taxNum = Number(tax) || 0;
  const serviceChargeNum = Number(serviceCharge) || 0;
  const vatNum = Number(vat) || 0;
  const totalFees = useMemo(() => {
    const base = amountNum;
    const taxAmt = base * (taxNum / 100);
    const serviceAmt = base * (serviceChargeNum / 100);
    const vatAmt = base * (vatNum / 100);
    return taxAmt + serviceAmt + vatAmt;
  }, [amountNum, taxNum, serviceChargeNum, vatNum]);

  const finalTotal = amountNum + totalFees;

  const toggleParticipant = (id: string) => setParticipants(p => ({ ...p, [id]: !p[id] }));

  const onSave = async () => {
    if (!group) return;
    const amt = parseFloat(amount || '0');
    if (isNaN(amt) || amt <= 0) { Alert.alert('Enter a valid amount'); return; }
    if (participantIds.length === 0) { Alert.alert('Select at least one participant'); return; }
    if (!paidBy) { Alert.alert('Select who paid'); return; }

    let exactsMap: Record<string, number> | undefined = undefined;

    // Calculate combined tax percentage
    let combinedTaxPct = taxNum + serviceChargeNum + vatNum;
    let baseAmount = amt;

    if (mode === 'exact') {
      // In custom mode: if custom amounts don't sum to base amount, that's OK
      // The difference will be treated as additional fees/tax split proportionally
      exactsMap = Object.fromEntries(Object.entries(exacts).map(([k, v]) => [k as ID, Number(v) || 0]));

      // Calculate the sum of custom amounts
      const customSum = participantIds.reduce((acc, id) => acc + (Number(exacts[id] || 0) || 0), 0);

      // If custom amounts don't sum to total amount, add the difference to the tax
      if (Math.abs(customSum - amt) > 0.01) {
        const difference = amt - customSum;
        // Convert the absolute difference to a percentage of the custom sum
        const additionalTaxPct = (difference / customSum) * 100;
        combinedTaxPct += additionalTaxPct;
        // Use custom sum as the base amount
        baseAmount = customSum;
      }
    }

    try {
      await addBill({
        groupId: group.id,
        title: title.trim() || 'Untitled bill',
        amount: baseAmount,
        taxMode: 'pct',
        tax: combinedTaxPct,
        discountMode: 'abs',
        discount: 0,
        participants: participantIds as ID[],
        splitMode: mode,
        exacts: exactsMap,
        proportionalTax: true,
        payerMode: 'single',
        paidBy: paidBy as ID
      });
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Cannot save bill', e?.message || String(e));
    }
  };

  if (!group) {
    return (
      <ScreenScroll>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800' }}>Add Bill</Text>
          <Text style={{ color: get('text.muted') as string }}>Group not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  const accentPrimary = get('accent.primary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const borderSubtle = get('border.subtle') as string;
  const successColor = get('semantic.success') as string;

  const inputStyle = {
    borderWidth: 1,
    borderColor: borderSubtle,
    borderRadius: radius.lg,
    paddingVertical: spacing.s14,
    paddingHorizontal: spacing.s16,
    color: textPrimary,
    backgroundColor: surface1,
    fontSize: 16
  };

  // Color palette for avatars
  const avatarColors = [
    { bg: '#EEF2FF', border: '#818CF8', text: '#4F46E5' }, // Indigo
    { bg: '#FCE7F3', border: '#F472B6', text: '#DB2777' }, // Pink
    { bg: '#DBEAFE', border: '#60A5FA', text: '#2563EB' }, // Blue
    { bg: '#D1FAE5', border: '#34D399', text: '#059669' }, // Green
    { bg: '#FEF3C7', border: '#FBBF24', text: '#D97706' }, // Amber
    { bg: '#E0E7FF', border: '#A78BFA', text: '#7C3AED' }, // Purple
  ];

  // Soft sage green for selected state
  const selectedColor = {
    bg: '#D1FAE5',
    border: '#6EE7B7',
    text: '#047857'
  };

  const getAvatarColor = (index: number, active: boolean) => {
    if (active) {
      return {
        bg: selectedColor.bg,
        border: selectedColor.border,
        text: selectedColor.text
      };
    }
    const colorSet = avatarColors[index % avatarColors.length];
    // Dim unselected avatars significantly
    return {
      bg: isDark ? withAlpha(colorSet.border, 0.08) : withAlpha(colorSet.bg, 0.3),
      border: isDark ? withAlpha(colorSet.border, 0.25) : withAlpha(colorSet.border, 0.3),
      text: isDark ? withAlpha(colorSet.border, 0.4) : withAlpha(colorSet.text, 0.4)
    };
  };

  return (
    <>
    <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s24 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s20 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              opacity: pressed ? 0.6 : 1,
            })}
            hitSlop={8}
          >
            <Icon name="x" size={28} color={textMuted} />
          </Pressable>
          <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' }}>
            Add Bill
          </Text>
          <Pressable
            onPress={onSave}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: successColor,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
            hitSlop={8}
          >
            <Icon name="check" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Combined Amount, Date & Bill Name - Direct on Background */}
        <View style={{
          marginBottom: spacing.s24,
          gap: spacing.s16
        }}>
          {/* Top row: Calendar button + Amount */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s16 }}>
            {/* Calendar button on left */}
            <Pressable
              onPress={() => setDtOpen(true)}
              style={({ pressed }) => ({
                alignItems: 'center',
                gap: spacing.s4,
                opacity: pressed ? 0.7 : 1,
                justifyContent: 'center'
              })}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, 0.12),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name="calendar" size={22} color={accentPrimary} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: textPrimary, fontSize: 11, fontWeight: '700' }}>
                  {billDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={{ color: textMuted, fontSize: 10 }}>
                  {billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </Pressable>

            {/* Amount input on right */}
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="$0"
                keyboardType="decimal-pad"
                placeholderTextColor={withAlpha(textMuted, 0.3)}
                autoFocus
                style={{
                  color: textPrimary,
                  fontSize: 56,
                  fontWeight: '800',
                  letterSpacing: -2,
                  textAlign: 'right',
                  width: '100%'
                }}
              />
              {participantIds.length > 0 && finalTotal > 0 && (
                <View style={{ marginTop: spacing.s4, alignItems: 'flex-end' }}>
                  <Text style={{ color: textMuted, fontSize: 13, fontWeight: '500' }}>
                    {formatCurrency(finalTotal / participantIds.length)} per person
                  </Text>
                  {totalFees > 0 && (
                    <Text style={{ color: textMuted, fontSize: 11, marginTop: spacing.s2 }}>
                      (includes {formatCurrency(totalFees)} in fees)
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          {/* Bill description at bottom */}
          <View>
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              For what?
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Dinner, groceries, rent..."
              placeholderTextColor={textMuted}
              style={{
                color: textPrimary,
                fontSize: 16,
                fontWeight: '500',
                padding: 0
              }}
            />
          </View>
        </View>

        {/* Who's In */}
        <View style={{ marginBottom: spacing.s24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s14 }}>
            <Text style={{ color: textPrimary, fontSize: 17, fontWeight: '600' }}>
              Split with
            </Text>
            <Pressable onPress={() => setParticipants(Object.fromEntries(activeMembers.map(m => [m.id, true])))}>
              <Text style={{ color: accentPrimary, fontWeight: '600', fontSize: 13 }}>Select all</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: spacing.s12, paddingRight: spacing.s16 }}
          >
            {activeMembers.map((member, index) => {
              const active = !!participants[member.id];
              const initials = member.name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase() || '').join('') || '?';
              const colors = getAvatarColor(index, active);

              return (
                <Pressable
                  key={member.id}
                  onPress={() => toggleParticipant(member.id)}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    gap: spacing.s8,
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }]
                  })}
                >
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.bg,
                    borderWidth: 3,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.border,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: active ? 0.3 : 0.1,
                    shadowRadius: 8,
                    elevation: active ? 4 : 2
                  }}>
                    {active && (
                      <View style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: successColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: get('background.default') as string
                      }}>
                        <Icon name="check" size={12} color="#FFFFFF" />
                      </View>
                    )}
                    <Text style={{
                      color: colors.text,
                      fontSize: 20,
                      fontWeight: '700'
                    }}>
                      {initials}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: active ? textPrimary : textMuted,
                      fontSize: 13,
                      fontWeight: active ? '600' : '500',
                      maxWidth: 80,
                      textAlign: 'center'
                    }}
                  >
                    {member.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Who Paid */}
        <View style={{ marginBottom: spacing.s24 }}>
          <Text style={{ color: textPrimary, fontSize: 17, fontWeight: '600', marginBottom: spacing.s16 }}>
            Who paid?
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: spacing.s12, paddingRight: spacing.s16 }}
          >
            {activeMembers.map((member, index) => {
              const active = paidBy === member.id;
              const initials = member.name.trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase() || '').join('') || '?';
              const colors = getAvatarColor(index, active);

              return (
                <Pressable
                  key={member.id}
                  onPress={() => setPaidBy(member.id)}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    gap: spacing.s8,
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }]
                  })}
                >
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.bg,
                    borderWidth: 3,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.border,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: active ? 0.3 : 0.1,
                    shadowRadius: 8,
                    elevation: active ? 4 : 2
                  }}>
                    {active && (
                      <View style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: successColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: get('background.default') as string
                      }}>
                        <Icon name="check" size={12} color="#FFFFFF" />
                      </View>
                    )}
                    <Text style={{
                      color: colors.text,
                      fontSize: 20,
                      fontWeight: '700'
                    }}>
                      {initials}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: active ? textPrimary : textMuted,
                      fontSize: 13,
                      fontWeight: active ? '600' : '500',
                      maxWidth: 80,
                      textAlign: 'center'
                    }}
                  >
                    {member.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Split Method - Combined Card */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: borderSubtle,
          overflow: 'hidden',
          marginBottom: spacing.s24
        }}>
          <View style={{ padding: spacing.s16 }}>
            <Text style={{ color: textPrimary, fontSize: 17, fontWeight: '600', marginBottom: spacing.s12 }}>
              How to split
            </Text>
            <View style={{
              flexDirection: 'row',
              backgroundColor: isDark ? surface2 : get('background.default') as string,
              borderRadius: radius.lg,
              padding: 6,
              gap: 6
            }}>
              <Pressable
                onPress={() => setMode('equal')}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: radius.md,
                  backgroundColor: mode === 'equal' ? accentPrimary : 'transparent',
                  paddingVertical: spacing.s14,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                  shadowColor: mode === 'equal' ? accentPrimary : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: mode === 'equal' ? 2 : 0
                })}
              >
                <Text style={{ color: mode === 'equal' ? textOnPrimary : textPrimary, fontWeight: '700', fontSize: 16 }}>
                  Equally
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('exact')}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: radius.md,
                  backgroundColor: mode === 'exact' ? accentPrimary : 'transparent',
                  paddingVertical: spacing.s14,
                  alignItems: 'center',
                  opacity: pressed ? 0.8 : 1,
                  shadowColor: mode === 'exact' ? accentPrimary : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: mode === 'exact' ? 2 : 0
                })}
              >
                <Text style={{ color: mode === 'exact' ? textOnPrimary : textPrimary, fontWeight: '700', fontSize: 16 }}>
                  Custom
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Custom Amounts - Expands when Custom is selected */}
          {mode === 'exact' && (
            <View style={{
              borderTopWidth: 1,
              borderTopColor: borderSubtle,
              padding: spacing.s16,
              gap: spacing.s12
            }}>
              <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600' }}>
                Enter each person's share
              </Text>
              <View style={{ gap: spacing.s10 }}>
                {participantIds.map(pid => {
                  const member = activeMembers.find(m => m.id === pid);
                  if (!member) return null;
                  return (
                    <View key={pid} style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: surface2,
                      borderRadius: radius.lg,
                      paddingLeft: spacing.s16,
                      paddingRight: spacing.s12,
                      paddingVertical: spacing.s14,
                      gap: spacing.s12
                    }}>
                      <Text style={{ color: textPrimary, flex: 1, fontWeight: '600', fontSize: 15 }}>{member.name}</Text>
                      <Text style={{ color: textMuted, fontSize: 20, fontWeight: '300' }}>$</Text>
                      <TextInput
                        value={exacts[pid] ?? ''}
                        onChangeText={t => setExacts(s => ({ ...s, [pid]: t }))}
                        placeholder="0"
                        placeholderTextColor={textMuted}
                        keyboardType="decimal-pad"
                        style={{
                          width: 80,
                          textAlign: 'right',
                          color: textPrimary,
                          fontWeight: '700',
                          fontSize: 18
                        }}
                      />
                    </View>
                  );
                })}
              </View>
              {Math.abs(sumExacts - amountNum) > 0.01 && amountNum > 0 && (
                <View style={{
                  marginTop: spacing.s4,
                  padding: spacing.s12,
                  backgroundColor: withAlpha(get('semantic.info') as string, isDark ? 0.15 : 0.1),
                  borderRadius: radius.md,
                  borderLeftWidth: 3,
                  borderLeftColor: get('semantic.info') as string
                }}>
                  <Text style={{ color: textPrimary, fontSize: 13, fontWeight: '600', marginBottom: spacing.s4 }}>
                    {sumExacts < amountNum
                      ? `${formatCurrency(amountNum - sumExacts)} unassigned`
                      : `${formatCurrency(sumExacts - amountNum)} over base`}
                  </Text>
                  <Text style={{ color: textMuted, fontSize: 12 }}>
                    {sumExacts < amountNum
                      ? 'Any difference + tax/fees will be split proportionally based on custom amounts'
                      : 'Tax & fees will be added on top of these amounts'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Tax & Fees (Collapsible) - At Bottom */}
        <View>
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: borderSubtle,
            overflow: 'hidden'
          }}>
            <Pressable
              onPress={() => setShowTaxFees(!showTaxFees)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s16,
                opacity: pressed ? 0.7 : 1
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                <Icon name={showTaxFees ? 'chevron-down' : 'chevron-right'} size={20} color={textMuted} />
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Tax & Fees {totalFees > 0 ? `(${formatCurrency(totalFees)})` : ''}
                </Text>
              </View>
              {totalFees > 0 && (
                <View style={{
                  backgroundColor: withAlpha(get('semantic.info') as string, 0.15),
                  paddingHorizontal: spacing.s10,
                  paddingVertical: spacing.s4,
                  borderRadius: radius.sm
                }}>
                  <Text style={{ color: get('semantic.info') as string, fontSize: 12, fontWeight: '700' }}>
                    {((totalFees / amountNum) * 100).toFixed(1)}%
                  </Text>
                </View>
              )}
            </Pressable>

            {showTaxFees && (
              <View style={{
                paddingHorizontal: spacing.s16,
                paddingBottom: spacing.s16,
                gap: spacing.s10,
                borderTopWidth: 1,
                borderTopColor: borderSubtle,
                paddingTop: spacing.s12
              }}>
                {/* Tax */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: surface2,
                  borderRadius: radius.md,
                  paddingLeft: spacing.s14,
                  paddingRight: spacing.s12,
                  paddingVertical: spacing.s12,
                  gap: spacing.s12
                }}>
                  <Text style={{ color: textPrimary, flex: 1, fontSize: 15 }}>Tax</Text>
                  <TextInput
                    value={tax}
                    onChangeText={setTax}
                    placeholder="0"
                    placeholderTextColor={textMuted}
                    keyboardType="decimal-pad"
                    style={{
                      width: 60,
                      textAlign: 'right',
                      color: textPrimary,
                      fontWeight: '600',
                      fontSize: 16
                    }}
                  />
                  <Text style={{ color: textMuted, fontSize: 16 }}>%</Text>
                </View>

                {/* Service Charge */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: surface2,
                  borderRadius: radius.md,
                  paddingLeft: spacing.s14,
                  paddingRight: spacing.s12,
                  paddingVertical: spacing.s12,
                  gap: spacing.s12
                }}>
                  <Text style={{ color: textPrimary, flex: 1, fontSize: 15 }}>Service Charge</Text>
                  <TextInput
                    value={serviceCharge}
                    onChangeText={setServiceCharge}
                    placeholder="0"
                    placeholderTextColor={textMuted}
                    keyboardType="decimal-pad"
                    style={{
                      width: 60,
                      textAlign: 'right',
                      color: textPrimary,
                      fontWeight: '600',
                      fontSize: 16
                    }}
                  />
                  <Text style={{ color: textMuted, fontSize: 16 }}>%</Text>
                </View>

                {/* VAT */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: surface2,
                  borderRadius: radius.md,
                  paddingLeft: spacing.s14,
                  paddingRight: spacing.s12,
                  paddingVertical: spacing.s12,
                  gap: spacing.s12
                }}>
                  <Text style={{ color: textPrimary, flex: 1, fontSize: 15 }}>VAT</Text>
                  <TextInput
                    value={vat}
                    onChangeText={setVat}
                    placeholder="0"
                    placeholderTextColor={textMuted}
                    keyboardType="decimal-pad"
                    style={{
                      width: 60,
                      textAlign: 'right',
                      color: textPrimary,
                      fontWeight: '600',
                      fontSize: 16
                    }}
                  />
                  <Text style={{ color: textMuted, fontSize: 16 }}>%</Text>
                </View>

                {totalFees > 0 && (
                  <View style={{
                    marginTop: spacing.s8,
                    padding: spacing.s12,
                    backgroundColor: withAlpha(get('semantic.info') as string, isDark ? 0.1 : 0.08),
                    borderRadius: radius.md,
                    borderLeftWidth: 3,
                    borderLeftColor: get('semantic.info') as string
                  }}>
                    <Text style={{ color: textMuted, fontSize: 13 }}>
                      Total with fees: <Text style={{ fontWeight: '700', color: textPrimary }}>{formatCurrency(finalTotal)}</Text>
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </ScreenScroll>

    <DateTimeSheet
      visible={dtOpen}
      date={billDate}
      onCancel={() => setDtOpen(false)}
      onConfirm={(d) => {
        setBillDate(d);
        setDtOpen(false);
      }}
    />
    </>
  );
}
