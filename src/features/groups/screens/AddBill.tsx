import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, TextInput, Pressable, StyleSheet, ScrollView, Platform, Modal, TouchableWithoutFeedback, Dimensions, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScreenScroll } from '../../../components/ScreenScroll';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import BottomSheet from '../../../components/BottomSheet';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import { useGroupsStore } from '../store';
import { formatCurrency } from '../../../lib/format';
import type { ID } from '../../../types/groups';
import { getAvailableAccounts, getDefaultAccount } from '../utils/transactionIntegration';
import { useAccountsStore } from '../../../store/accounts';

const KEY_ADVANCED_OPEN = 'fingrow/ui/addbill/advancedOpen';

// Common expense categories for group bills
const EXPENSE_CATEGORIES = [
  'Dining',
  'Groceries',
  'Transportation',
  'Entertainment',
  'Travel',
  'Utilities',
  'Shopping',
  'Other',
];

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

  // Transaction integration
  const { accounts } = useAccountsStore();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(() => {
    const defaultAcc = getDefaultAccount();
    return defaultAcc?.id || null;
  });
  const [category, setCategory] = useState('Dining');
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);

  const activeMembers = useMemo(() => group?.members.filter(m => !m.archived) ?? [], [group]);
  const [participants, setParticipants] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(activeMembers.map(m => [m.id, true]))
  );
  const participantIds = Object.entries(participants).filter(([_, v]) => v).map(([k]) => k);

  const [mode, setMode] = useState<'equal' | 'exact' | 'weight' | 'share'>('equal');
  const [exacts, setExacts] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, string>>({});

  // Tax & Fees
  const [tax, setTax] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [vat, setVat] = useState('');

  // Bottom Sheets
  const [splitModeSheet, setSplitModeSheet] = useState(false);
  const [taxFeesSheet, setTaxFeesSheet] = useState(false);
  const [splitModeTab, setSplitModeTab] = useState<'equal' | 'weight' | 'share'>('equal');
  const [showTaxFees, setShowTaxFees] = useState(false);

  // Date & Time
  const [billDate, setBillDate] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showTimeOverlay, setShowTimeOverlay] = useState(false);

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

  // Sync split mode tab with current mode when sheet opens
  useEffect(() => {
    if (splitModeSheet) {
      if (mode === 'equal') setSplitModeTab('equal');
      else if (mode === 'weight') setSplitModeTab('weight');
      else if (mode === 'share') setSplitModeTab('share');
      else setSplitModeTab('equal');
    }
  }, [splitModeSheet, mode]);

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

    if (mode === 'share') {
      // In share mode: if custom amounts don't sum to base amount, that's OK
      // The difference will be treated as additional fees/tax split proportionally
      exactsMap = Object.fromEntries(Object.entries(shares).map(([k, v]) => [k as ID, Number(v) || 0]));

      // Calculate the sum of custom amounts
      const customSum = participantIds.reduce((acc, id) => acc + (Number(shares[id] || 0) || 0), 0);

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

    // Determine if current user is the payer (we'll use first member as currentUser for now)
    // TODO: Get actual current user ID from auth/profile
    const currentUserId = activeMembers[0]?.id;

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
        paidBy: paidBy as ID,
        // Only include transaction fields if trackSpending is enabled
        ...(group.trackSpending && {
          category: category,
          paidFromAccountId: selectedAccount || undefined,
          currentUserId: currentUserId,
        }),
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s16 }}>
            {/* Calendar button on left */}
            <Pressable
              onPress={() => setShowDateTimePicker(true)}
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

            {/* Right side: Amount + Description */}
            <View style={{ flex: 1 }}>
              {/* Amount input */}
              <View style={{ alignItems: 'flex-end' }}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="$0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={withAlpha(textMuted, 0.3)}
                  autoFocus
                  style={{
                    color: textPrimary,
                    fontSize: 30,
                    fontWeight: '800',
                    letterSpacing: -1,
                    textAlign: 'right',
                    width: '100%'
                  }}
                />
              </View>

              {/* Bill description - single line below amount */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: spacing.s12,
                paddingTop: spacing.s12,
                borderTopWidth: 1,
                borderTopColor: borderSubtle,
                gap: spacing.s12
              }}>
                <Text style={{ color: textMuted, fontSize: 15, fontWeight: '600' }}>
                  Add notes
                </Text>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Dinner, groceries, rent..."
                    placeholderTextColor={textMuted}
                    style={{
                      color: textPrimary,
                      fontSize: 15,
                      fontWeight: '500',
                      padding: 0,
                      textAlign: 'right'
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Who's In */}
        <View style={{ marginBottom: spacing.s24 }}>
          <Text style={{ color: textPrimary, fontSize: 17, fontWeight: '600', marginBottom: spacing.s14 }}>
            Split with
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: spacing.s12, paddingRight: spacing.s16, justifyContent: 'flex-end', flexGrow: 1 }}
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
                    width: 45,
                    height: 45,
                    borderRadius: 22.5,
                    backgroundColor: colors.bg,
                    borderWidth: 2,
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
                        top: -3,
                        right: -3,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: successColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: get('background.default') as string
                      }}>
                        <Icon name="check" size={10} color="#FFFFFF" />
                      </View>
                    )}
                    <Text style={{
                      color: colors.text,
                      fontSize: 14,
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
            contentContainerStyle={{ flexDirection: 'row', gap: spacing.s12, paddingRight: spacing.s16, justifyContent: 'flex-end', flexGrow: 1 }}
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
                    width: 45,
                    height: 45,
                    borderRadius: 22.5,
                    backgroundColor: colors.bg,
                    borderWidth: 2,
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
                        top: -3,
                        right: -3,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: successColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: get('background.default') as string
                      }}>
                        <Icon name="check" size={10} color="#FFFFFF" />
                      </View>
                    )}
                    <Text style={{
                      color: colors.text,
                      fontSize: 14,
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

        {/* Category Selection - Only show if trackSpending is enabled */}
        {group.trackSpending && (
          <View style={{ marginBottom: spacing.s24 }}>
            <Text style={{ color: textPrimary, fontSize: 17, fontWeight: '600', marginBottom: spacing.s16 }}>
              Category
            </Text>
            <Pressable
              onPress={() => setShowCategorySheet(true)}
              style={{
                backgroundColor: surface1,
                borderRadius: radius.lg,
                padding: spacing.s16,
                borderWidth: 1,
                borderColor: borderSubtle,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                <Icon name="tag" size={20} colorToken="text.muted" />
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '600' }}>
                  {category}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>
          </View>
        )}

        {/* Account Selection - Only show if trackSpending is enabled and user is the payer */}
        {group.trackSpending && paidBy && accounts.length > 0 && (
          <View style={{ marginBottom: spacing.s24 }}>
            <Text style={{ color: textPrimary, fontSize: 17, fontWeight: '600', marginBottom: spacing.s16 }}>
              Paid from
            </Text>
            <Pressable
              onPress={() => setShowAccountSheet(true)}
              style={{
                backgroundColor: surface1,
                borderRadius: radius.lg,
                padding: spacing.s16,
                borderWidth: 1,
                borderColor: borderSubtle,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                <Icon name="credit-card" size={20} colorToken="text.muted" />
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '600' }}>
                  {selectedAccount ? accounts.find(a => a.id === selectedAccount)?.name || 'Select account' : 'Select account'}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </Pressable>
            <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s8, paddingLeft: spacing.s4 }}>
              This expense will be recorded in your transaction history
            </Text>
          </View>
        )}

        {/* Bill Details - Combined Card */}
        <Text style={{ color: textPrimary, fontSize: 17, fontWeight: '600', marginBottom: spacing.s14 }}>
          Bill Details
        </Text>
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: borderSubtle,
        }}>
          {/* How to split */}
          <Pressable
            onPress={() => setSplitModeSheet(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.s16,
              paddingHorizontal: spacing.s16,
              opacity: pressed ? 0.7 : 1
            })}
          >
            <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
              How to split
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <Text style={{ color: textMuted, fontSize: 15 }}>
                {mode === 'equal' ? 'Equally' : mode === 'weight' ? 'By Weight' : mode === 'share' ? 'By Share' : 'Custom'}
              </Text>
              <Icon name="chevron-right" size={20} color={textMuted} />
            </View>
          </Pressable>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          {/* Tax & Fees */}
          <Pressable
            onPress={() => setTaxFeesSheet(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.s16,
              paddingHorizontal: spacing.s16,
              opacity: pressed ? 0.7 : 1
            })}
          >
            <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
              Tax & Fees
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <Text style={{ color: textMuted, fontSize: 15 }}>
                {totalFees > 0 ? formatCurrency(totalFees) : 'Optional'}
              </Text>
              <Icon name="chevron-right" size={20} color={textMuted} />
            </View>
          </Pressable>
        </View>
      </View>
    </ScreenScroll>

    {/* Split Mode Bottom Sheet */}
    <BottomSheet
      visible={splitModeSheet}
      onClose={() => setSplitModeSheet(false)}
    >
      <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s12 }}>
        How to split
      </Text>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: isDark ? surface2 : get('background.default') as string,
        borderRadius: radius.lg,
        padding: 6,
        gap: 6,
        marginBottom: spacing.s12
      }}>
        <Pressable
          onPress={() => setSplitModeTab('equal')}
          style={({ pressed }) => ({
            flex: 1,
            borderRadius: radius.md,
            backgroundColor: splitModeTab === 'equal' ? accentPrimary : 'transparent',
            paddingVertical: spacing.s8,
            alignItems: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: splitModeTab === 'equal' ? textOnPrimary : textPrimary, fontWeight: '700', fontSize: 15 }}>
            Equally
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSplitModeTab('weight')}
          style={({ pressed }) => ({
            flex: 1,
            borderRadius: radius.md,
            backgroundColor: splitModeTab === 'weight' ? accentPrimary : 'transparent',
            paddingVertical: spacing.s8,
            alignItems: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: splitModeTab === 'weight' ? textOnPrimary : textPrimary, fontWeight: '700', fontSize: 15 }}>
            By Weight
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSplitModeTab('share')}
          style={({ pressed }) => ({
            flex: 1,
            borderRadius: radius.md,
            backgroundColor: splitModeTab === 'share' ? accentPrimary : 'transparent',
            paddingVertical: spacing.s8,
            alignItems: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: splitModeTab === 'share' ? textOnPrimary : textPrimary, fontWeight: '700', fontSize: 15 }}>
            By Share
          </Text>
        </Pressable>
      </View>

        {/* Tab Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {splitModeTab === 'equal' && (
            <View style={{
              flexDirection: 'row',
              gap: spacing.s10,
              marginTop: spacing.s12,
              alignItems: 'flex-start'
            }}>
              <Icon name="info" size={18} color={get('semantic.info') as string} style={{ marginTop: 2 }} />
              <Text style={{ color: textMuted, fontSize: 14, flex: 1, lineHeight: 20 }}>
                Amount will be split equally among all participants
              </Text>
            </View>
          )}

          {splitModeTab === 'weight' && (
            <>
              <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600', marginBottom: spacing.s12, marginTop: spacing.s4 }}>
                Assign weights to each participant
              </Text>
              <View style={{
                backgroundColor: surface1,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: borderSubtle,
              }}>
                {participantIds.map((pid, index) => {
                  const member = activeMembers.find(m => m.id === pid);
                  if (!member) return null;
                  return (
                    <React.Fragment key={pid}>
                      {index > 0 && <View style={{ height: 1, backgroundColor: borderSubtle }} />}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingLeft: spacing.s16,
                        paddingRight: spacing.s12,
                        paddingVertical: spacing.s10,
                        gap: spacing.s12,
                      }}>
                        <Text style={{ color: textPrimary, flex: 1, fontWeight: '600', fontSize: 15 }}>{member.name}</Text>
                        <TextInput
                          value={weights[pid] ?? ''}
                          onChangeText={t => setWeights(s => ({ ...s, [pid]: t }))}
                          placeholder="1"
                          placeholderTextColor={textMuted}
                          keyboardType="decimal-pad"
                          style={{
                            width: 80,
                            textAlign: 'right',
                            color: textPrimary,
                            fontWeight: '700',
                            fontSize: 18,
                            backgroundColor: surface2,
                            paddingHorizontal: spacing.s12,
                            paddingVertical: spacing.s8,
                            borderRadius: radius.md
                          }}
                        />
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
              <View style={{
                flexDirection: 'row',
                gap: spacing.s10,
                marginTop: spacing.s10,
                alignItems: 'flex-start'
              }}>
                <Icon name="info" size={18} color={get('semantic.info') as string} style={{ marginTop: 2 }} />
                <Text style={{ color: textMuted, fontSize: 13, flex: 1, lineHeight: 18 }}>
                  Amount will be divided proportionally by weight. For example, weights of 1, 2, 2 would split the bill 20%, 40%, 40%.
                </Text>
              </View>
            </>
          )}

          {splitModeTab === 'share' && (
            <>
              <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600', marginBottom: spacing.s12, marginTop: spacing.s4 }}>
                Enter each person's share amount
              </Text>
              <View style={{
                backgroundColor: surface1,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: borderSubtle,
              }}>
                {participantIds.map((pid, index) => {
                  const member = activeMembers.find(m => m.id === pid);
                  if (!member) return null;
                  return (
                    <React.Fragment key={pid}>
                      {index > 0 && <View style={{ height: 1, backgroundColor: borderSubtle }} />}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingLeft: spacing.s16,
                        paddingRight: spacing.s12,
                        paddingVertical: spacing.s10,
                        gap: spacing.s12,
                      }}>
                        <Text style={{ color: textPrimary, flex: 1, fontWeight: '600', fontSize: 15 }}>{member.name}</Text>
                        <Text style={{ color: textMuted, fontSize: 20, fontWeight: '300' }}>$</Text>
                        <TextInput
                          value={shares[pid] ?? ''}
                          onChangeText={t => setShares(s => ({ ...s, [pid]: t }))}
                          placeholder="0"
                          placeholderTextColor={textMuted}
                          keyboardType="decimal-pad"
                          style={{
                            width: 80,
                            textAlign: 'right',
                            color: textPrimary,
                            fontWeight: '700',
                            fontSize: 18,
                            backgroundColor: surface2,
                            paddingHorizontal: spacing.s12,
                            paddingVertical: spacing.s8,
                            borderRadius: radius.md
                          }}
                        />
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
              {(() => {
                const sumShares = participantIds.reduce((acc, id) => acc + (Number(shares[id] || 0) || 0), 0);
                return Math.abs(sumShares - amountNum) > 0.01 && amountNum > 0 ? (
                  <View style={{
                    flexDirection: 'row',
                    gap: spacing.s10,
                    marginTop: spacing.s10,
                    alignItems: 'flex-start'
                  }}>
                    <Icon name="alert-circle" size={18} color={get('semantic.warning') as string} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textPrimary, fontSize: 13, fontWeight: '600', marginBottom: spacing.s2 }}>
                        {sumShares < amountNum
                          ? `${formatCurrency(amountNum - sumShares)} unassigned`
                          : `${formatCurrency(sumShares - amountNum)} over base`}
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 12, lineHeight: 16 }}>
                        {sumShares < amountNum
                          ? 'Any difference + tax/fees will be split proportionally based on shares'
                          : 'Tax & fees will be added on top of these amounts'}
                      </Text>
                    </View>
                  </View>
                ) : null;
              })()}
            </>
          )}

          {/* Done Button */}
          <Pressable
            onPress={() => {
              // Set the mode based on current tab
              if (splitModeTab === 'equal') {
                setMode('equal');
              } else if (splitModeTab === 'weight') {
                setMode('weight');
              } else if (splitModeTab === 'share') {
                setMode('share');
              }
              setSplitModeSheet(false);
            }}
            style={({ pressed }) => ({
              backgroundColor: accentPrimary,
              borderRadius: radius.lg,
              paddingVertical: spacing.s14,
              alignItems: 'center',
              marginTop: spacing.s12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: textOnPrimary, fontSize: 16, fontWeight: '700' }}>
              Done
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </BottomSheet>

    {/* Tax & Fees Bottom Sheet */}
    <BottomSheet
      visible={taxFeesSheet}
      onClose={() => setTaxFeesSheet(false)}
    >
      <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s12 }}>
        Tax & Fees
      </Text>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: borderSubtle,
          }}>
            {/* Tax */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: spacing.s16,
              paddingRight: spacing.s12,
              paddingVertical: spacing.s10,
              gap: spacing.s12,
            }}>
              <Text style={{ color: textPrimary, flex: 1, fontSize: 15, fontWeight: '600' }}>Tax</Text>
              <TextInput
                value={tax}
                onChangeText={setTax}
                placeholder="0"
                placeholderTextColor={textMuted}
                keyboardType="decimal-pad"
                style={{
                  width: 70,
                  textAlign: 'right',
                  color: textPrimary,
                  fontWeight: '700',
                  fontSize: 18,
                  backgroundColor: surface2,
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s8,
                  borderRadius: radius.md
                }}
              />
              <Text style={{ color: textMuted, fontSize: 18, fontWeight: '600' }}>%</Text>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: borderSubtle }} />

            {/* Service Charge */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: spacing.s16,
              paddingRight: spacing.s12,
              paddingVertical: spacing.s10,
              gap: spacing.s12,
            }}>
              <Text style={{ color: textPrimary, flex: 1, fontSize: 15, fontWeight: '600' }}>Service Charge</Text>
              <TextInput
                value={serviceCharge}
                onChangeText={setServiceCharge}
                placeholder="0"
                placeholderTextColor={textMuted}
                keyboardType="decimal-pad"
                style={{
                  width: 70,
                  textAlign: 'right',
                  color: textPrimary,
                  fontWeight: '700',
                  fontSize: 18,
                  backgroundColor: surface2,
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s8,
                  borderRadius: radius.md
                }}
              />
              <Text style={{ color: textMuted, fontSize: 18, fontWeight: '600' }}>%</Text>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: borderSubtle }} />

            {/* VAT */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: spacing.s16,
              paddingRight: spacing.s12,
              paddingVertical: spacing.s10,
              gap: spacing.s12,
            }}>
              <Text style={{ color: textPrimary, flex: 1, fontSize: 15, fontWeight: '600' }}>VAT</Text>
              <TextInput
                value={vat}
                onChangeText={setVat}
                placeholder="0"
                placeholderTextColor={textMuted}
                keyboardType="decimal-pad"
                style={{
                  width: 70,
                  textAlign: 'right',
                  color: textPrimary,
                  fontWeight: '700',
                  fontSize: 18,
                  backgroundColor: surface2,
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s8,
                  borderRadius: radius.md
                }}
              />
              <Text style={{ color: textMuted, fontSize: 18, fontWeight: '600' }}>%</Text>
            </View>
          </View>

          {/* Total Calculation */}
          {totalFees > 0 && (
            <View style={{
              marginTop: spacing.s8,
              padding: spacing.s16,
              backgroundColor: withAlpha(get('semantic.info') as string, isDark ? 0.15 : 0.1),
              borderRadius: radius.lg,
              borderLeftWidth: 3,
              borderLeftColor: get('semantic.info') as string
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: textMuted, fontSize: 15, fontWeight: '600' }}>
                  Total fees
                </Text>
                <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>
                  {formatCurrency(totalFees)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.s8 }}>
                <Text style={{ color: textMuted, fontSize: 15, fontWeight: '600' }}>
                  Total with fees
                </Text>
                <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>
                  {formatCurrency(finalTotal)}
                </Text>
              </View>
            </View>
          )}

          {/* Done Button */}
          <Pressable
            onPress={() => setTaxFeesSheet(false)}
            style={({ pressed }) => ({
              backgroundColor: accentPrimary,
              borderRadius: radius.lg,
              paddingVertical: spacing.s14,
              alignItems: 'center',
              marginTop: spacing.s12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: textOnPrimary, fontSize: 16, fontWeight: '700' }}>
              Done
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </BottomSheet>

    {/* Date & Time Picker Modal */}
    <Modal
      visible={showDateTimePicker}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setShowDateTimePicker(false);
        setShowTimeOverlay(false);
      }}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.s16,
      }}>
        <TouchableWithoutFeedback onPress={() => {
          setShowDateTimePicker(false);
          setShowTimeOverlay(false);
        }}>
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        </TouchableWithoutFeedback>

        <View style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: get('background.default') as string,
          borderRadius: 20,
          paddingHorizontal: spacing.s8,
          paddingTop: spacing.s8,
          paddingBottom: spacing.s8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 24,
          elevation: 12,
          position: 'relative',
        }}>
          {/* Date Picker */}
          <View style={{ alignItems: 'center' }}>
            <DateTimePicker
              value={billDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setBillDate(selectedDate);
                }
              }}
              themeVariant={isDark ? 'dark' : 'light'}
            />
          </View>

          {/* Time Selector Button - Bottom Right */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginTop: spacing.s4,
            gap: spacing.s12,
            paddingHorizontal: spacing.s4,
          }}>
            <Pressable
              onPress={() => setShowTimeOverlay(!showTimeOverlay)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s8,
                backgroundColor: get('surface.level1') as string,
                paddingHorizontal: spacing.s16,
                paddingVertical: spacing.s10,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: borderSubtle,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name="clock" size={18} color={accentPrimary} />
              <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                {billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowDateTimePicker(false);
                setShowTimeOverlay(false);
              }}
              style={({ pressed }) => ({
                backgroundColor: accentPrimary,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.s20,
                paddingVertical: spacing.s10,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: textOnPrimary, fontSize: 15, fontWeight: '700' }}>
                Done
              </Text>
            </Pressable>
          </View>

          {/* Time Picker Overlay - Compact Modal */}
          {showTimeOverlay && (
            <View style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: [{ translateX: -140 }, { translateY: -125 }],
              width: 280,
              backgroundColor: get('background.default') as string,
              borderRadius: 16,
              padding: spacing.s16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 10,
            }}>
              <TouchableWithoutFeedback>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ height: 180, justifyContent: 'center', width: '100%' }}>
                    <DateTimePicker
                      value={billDate}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setBillDate(selectedDate);
                        }
                      }}
                      themeVariant={isDark ? 'dark' : 'light'}
                    />
                  </View>

                  {/* Buttons */}
                  <View style={{
                    flexDirection: 'row',
                    gap: spacing.s10,
                    marginTop: spacing.s12,
                    width: '100%',
                  }}>
                    {/* Now button */}
                    <Pressable
                      onPress={() => {
                        const now = new Date();
                        setBillDate(now);
                        setShowTimeOverlay(false);
                      }}
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor: get('surface.level1') as string,
                        borderRadius: radius.lg,
                        paddingVertical: spacing.s8,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: borderSubtle,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '600' }}>
                        Now
                      </Text>
                    </Pressable>

                    {/* Done button */}
                    <Pressable
                      onPress={() => setShowTimeOverlay(false)}
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor: accentPrimary,
                        borderRadius: radius.lg,
                        paddingVertical: spacing.s8,
                        alignItems: 'center',
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text style={{ color: textOnPrimary, fontSize: 14, fontWeight: '700' }}>
                        Done
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          )}
        </View>
      </View>
    </Modal>

    {/* Category Selection Sheet */}
    <BottomSheet visible={showCategorySheet} onClose={() => setShowCategorySheet(false)}>
      <View style={{ paddingVertical: spacing.s16 }}>
        <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', marginBottom: spacing.s20, paddingHorizontal: spacing.s16 }}>
          Select Category
        </Text>
        {EXPENSE_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => {
              setCategory(cat);
              setShowCategorySheet(false);
            }}
            style={({ pressed }) => ({
              paddingVertical: spacing.s14,
              paddingHorizontal: spacing.s16,
              backgroundColor: category === cat ? withAlpha(accentPrimary, 0.1) : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: category === cat ? accentPrimary : textPrimary, fontSize: 16, fontWeight: category === cat ? '700' : '500' }}>
                {cat}
              </Text>
              {category === cat && (
                <Icon name="check" size={20} colorToken="accent.primary" />
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </BottomSheet>

    {/* Account Selection Sheet */}
    <BottomSheet visible={showAccountSheet} onClose={() => setShowAccountSheet(false)}>
      <View style={{ paddingVertical: spacing.s16 }}>
        <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', marginBottom: spacing.s20, paddingHorizontal: spacing.s16 }}>
          Select Account
        </Text>
        {accounts.map((account) => (
          <Pressable
            key={account.id}
            onPress={() => {
              setSelectedAccount(account.id);
              setShowAccountSheet(false);
            }}
            style={({ pressed }) => ({
              paddingVertical: spacing.s14,
              paddingHorizontal: spacing.s16,
              backgroundColor: selectedAccount === account.id ? withAlpha(accentPrimary, 0.1) : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: selectedAccount === account.id ? accentPrimary : textPrimary, fontSize: 16, fontWeight: selectedAccount === account.id ? '700' : '500' }}>
                  {account.name}
                </Text>
                {account.kind && (
                  <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                    {account.kind.charAt(0).toUpperCase() + account.kind.slice(1)}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: selectedAccount === account.id ? accentPrimary : textPrimary, fontSize: 15, fontWeight: '600' }}>
                  {formatCurrency(account.balance)}
                </Text>
                {selectedAccount === account.id && (
                  <Icon name="check" size={20} colorToken="accent.primary" />
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
    </>
  );
}
