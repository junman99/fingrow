import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, TextInput, Switch, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGroupsStore } from '../../store/groups';
import { formatCurrency } from '../../lib/format';
import type { ID } from '../../types/groups';

const KEY_ADVANCED_OPEN = 'fingrow/ui/addbill/advancedOpen';

type SplitRow = { memberId: string; name: string; base: number; adj: number; final: number };

export default function AddBill() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, addBill } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [amountMode, setAmountMode] = useState<'subtotal' | 'final'>('subtotal');
  const [tax, setTax] = useState('0');
  const [taxPct, setTaxPct] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [discountPct, setDiscountPct] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [proportionalTax, setProportionalTax] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY_ADVANCED_OPEN).then(v => {
      if (v === 'false') setAdvancedOpen(false);
    });
  }, []);

  const activeMembers = useMemo(() => group?.members.filter(m => !m.archived) ?? [], [group]);
  const [participants, setParticipants] = useState<Record<string, boolean>>(() => Object.fromEntries(activeMembers.map(m => [m.id, true])));
  const participantIds = Object.entries(participants).filter(([_, v]) => v).map(([k]) => k);

  const [mode, setMode] = useState<'equal' | 'shares' | 'exact'>('equal');
  const [shares, setShares] = useState<Record<string, string>>({});
  const [exacts, setExacts] = useState<Record<string, string>>({});

  const [payerMode, setPayerMode] = useState<'single' | 'multi-even' | 'multi-custom'>('single');
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [payersEven, setPayersEven] = useState<Record<string, boolean>>({});
  const [payersCustom, setPayersCustom] = useState<Record<string, boolean>>({});
  const [contribs, setContribs] = useState<Record<string, string>>({});

  const amountNum = useMemo(() => Number(amount) || 0, [amount]);
  const baseSubtotal = useMemo(() => {
    if (amountMode === 'final' && mode === 'exact' && proportionalTax) {
      const base = participantIds.reduce((a, id) => a + (Number(exacts[id] || 0) || 0), 0);
      return Math.round(base * 100) / 100;
    }
    return amountNum;
  }, [amountMode, amountNum, mode, proportionalTax, exacts, participantIds]);

  const taxVal = useMemo(() => (taxPct ? baseSubtotal * (Number(tax) || 0) / 100 : (Number(tax) || 0)), [taxPct, tax, baseSubtotal]);
  const discVal = useMemo(() => (discountPct ? baseSubtotal * (Number(discount) || 0) / 100 : (Number(discount) || 0)), [discountPct, discount, baseSubtotal]);
  const finalAmount = useMemo(() => {
    if (amountMode === 'final' && mode === 'exact' && proportionalTax) return amountNum;
    const f = baseSubtotal + (taxVal || 0) - (discVal || 0);
    return Math.round(f * 100) / 100;
  }, [amountMode, amountNum, baseSubtotal, taxVal, discVal, mode, proportionalTax]);

  const sumExacts = useMemo(() => participantIds.reduce((acc, id) => acc + (Number(exacts[id] || 0) || 0), 0), [exacts, participantIds]);
  const sumContribs = useMemo(() => Object.values(contribs).reduce((a, b) => a + (Number(b) || 0), 0), [contribs]);
  const remaining = useMemo(() => Math.round((finalAmount - sumContribs) * 100) / 100, [finalAmount, sumContribs]);

  const toggleParticipant = (id: string) => setParticipants(p => ({ ...p, [id]: !p[id] }));

  const previewRows: SplitRow[] = useMemo(() => {
    const ids = participantIds;
    const base = baseSubtotal;
    const tax = taxVal || 0; const disc = discVal || 0;
    let baseSplits: { id: string; val: number }[] = [];
    if (mode === 'equal') {
      const each = Math.floor((base / (ids.length || 1)) * 100) / 100;
      let assigned = Math.round(each * (ids.length || 1) * 100) / 100;
      let remainder = Math.round((base - assigned) * 100) / 100;
      baseSplits = ids.map((id, idx) => ({ id, val: idx === ids.length - 1 ? Math.round((each + remainder) * 100) / 100 : each }));
    } else if (mode === 'shares') {
      const weights = ids.map(id => Number(shares[id] || 1));
      const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
      let assigned = 0;
      baseSplits = ids.map((id, idx) => {
        let share = Math.round((base * (weights[idx] / weightSum)) * 100) / 100;
        if (idx === ids.length - 1) share = Math.round((base - assigned) * 100) / 100;
        assigned = Math.round((assigned + share) * 100) / 100;
        return { id, val: share };
      });
    } else {
      if (mode === 'exact' && proportionalTax) {
        const totals = ids.map(id => Number(exacts[id] || 0));
        const sumEx = Math.round((totals.reduce((a, b) => a + b, 0)) * 100) / 100;
        if (Math.abs(sumEx - base) > 0.01) return [];
        baseSplits = ids.map(id => ({ id, val: Math.round((Number(exacts[id] || 0)) * 100) / 100 }));
      } else if (mode === 'exact' && !proportionalTax) {
        const totals = ids.map(id => Number(exacts[id] || 0));
        const s = Math.round(totals.reduce((a, b) => a + b, 0) * 100) / 100;
        if (Math.abs(s - (finalAmount || 0)) > 0.01) return [];
        return ids.map(id => ({
          memberId: id,
          name: activeMembers.find(m => m.id === id)?.name || '—',
          base: 0,
          adj: 0,
          final: Math.round((Number(exacts[id] || 0)) * 100) / 100
        }));
      }
    }
    const baseSum = Math.round(baseSplits.reduce((a, b) => a + b.val, 0) * 100) / 100 || 1;
    return ids.map((id, idx) => {
      const baseShare = baseSplits.find(s => s.id === id)?.val ?? 0;
      let finalShare = proportionalTax ? Math.round((baseShare + (baseShare / baseSum) * (tax - disc)) * 100) / 100 : baseShare;
      if (idx === ids.length - 1) finalShare = Math.round((finalAmount - (baseSplits.slice(0, idx).reduce((a, b) => a + (proportionalTax ? (b.val + (b.val / baseSum) * (tax - disc)) : b.val), 0))) * 100) / 100;
      const adj = Math.round((finalShare - baseShare) * 100) / 100;
      return { memberId: id, name: activeMembers.find(m => m.id === id)?.name || '—', base: baseShare, adj, final: finalShare };
    });
  }, [participantIds, baseSubtotal, taxVal, discVal, mode, proportionalTax, shares, exacts, finalAmount, activeMembers]);

  const onSave = async () => {
    if (!group) return;
    const amt = parseFloat(amount || '0');
    if (isNaN(amt) || amt <= 0) { Alert.alert('Enter a valid amount'); return; }
    if (participantIds.length === 0) { Alert.alert('Select at least one participant'); return; }

    const canInferFinal = (mode === 'exact' && proportionalTax && (Number(tax || 0) === 0) && (Number(discount || 0) === 0) && Math.abs(sumExacts - amt) > 0.01);
    const treatAsFinal = (amountMode === 'final' && mode === 'exact' && proportionalTax) || canInferFinal;

    let payloadAmount = amt;
    let payloadTaxMode: 'abs' | 'pct' = taxPct ? 'pct' : 'abs';
    let payloadTax = Number(tax || 0) || 0;
    let payloadDiscMode: 'abs' | 'pct' = discountPct ? 'pct' : 'abs';
    let payloadDisc = Number(discount || 0) || 0;
    let exactsMap: Record<string, number> | undefined = undefined;
    let sharesMap: Record<string, number> | undefined = undefined;
    let propTax = proportionalTax;

    if (mode === 'shares') {
      sharesMap = Object.fromEntries(Object.entries(shares).map(([k, v]) => [k as ID, Number(v) || 0]));
    }
    if (mode === 'exact') {
      exactsMap = Object.fromEntries(Object.entries(exacts).map(([k, v]) => [k as ID, Number(v) || 0]));
    }

    if (treatAsFinal) {
      const baseSum = Math.round((sumExacts) * 100) / 100;
      if (baseSum <= 0) { Alert.alert('Enter base amounts for at least one participant'); return; }
      const adj = Math.round((amt - baseSum) * 100) / 100;
      payloadAmount = baseSum;
      payloadTaxMode = 'abs'; payloadDiscMode = 'abs';
      if (adj >= 0) { payloadTax = adj; payloadDisc = 0; } else { payloadTax = 0; payloadDisc = Math.abs(adj); }
      propTax = true;
    } else {
      if (mode === 'exact' && !proportionalTax) {
        const f = baseSubtotal + (taxVal || 0) - (discVal || 0);
        const sumF = Math.round(sumExacts * 100) / 100;
        const fin = Math.round(f * 100) / 100;
        if (Math.abs(sumF - fin) > 0.01) {
          Alert.alert(`Exact amounts must sum to ${fin.toFixed(2)}`);
          return;
        }
      } else if (mode === 'exact' && proportionalTax) {
        const sumBase = Math.round(sumExacts * 100) / 100;
        if (Math.abs(sumBase - baseSubtotal) > 0.01) {
          Alert.alert(`Exact base amounts must sum to ${baseSubtotal.toFixed(2)}`);
          return;
        }
      }
    }

    let payerModeValue = payerMode;
    let paidByVal: ID | undefined = undefined;
    let payersEvenIds: ID[] | undefined = undefined;
    let contributions: Record<ID, number> | undefined = undefined;

    if (payerMode === 'single') {
      if (!paidBy) { Alert.alert('Select who paid'); return; }
      paidByVal = paidBy as ID;
    } else if (payerMode === 'multi-even') {
      const ids = Object.entries(payersEven).filter(([_, v]) => v).map(([k]) => k);
      if (ids.length === 0) { Alert.alert('Select at least one payer'); return; }
      payersEvenIds = ids as ID[];
    } else {
      const entries = Object.entries(contribs).filter(([_, v]) => (Number(v) || 0) > 0);
      const total = Math.round(entries.reduce((a, [, v]) => a + (Number(v) || 0), 0) * 100) / 100;
      if (Math.abs(total - finalAmount) > 0.01) { Alert.alert(`Contributions must sum to ${finalAmount.toFixed(2)}`); return; }
      contributions = Object.fromEntries(entries.map(([k, v]) => [k as ID, Number(v) || 0]));
    }

    try {
      await addBill({
        groupId: group.id,
        title: title.trim() || 'Untitled bill',
        amount: payloadAmount,
        taxMode: payloadTaxMode,
        tax: payloadTax,
        discountMode: payloadDiscMode,
        discount: payloadDisc,
        participants: participantIds as ID[],
        splitMode: mode,
        shares: sharesMap,
        exacts: exactsMap,
        proportionalTax: propTax,
        payerMode: payerModeValue,
        paidBy: paidByVal,
        payersEven: payersEvenIds,
        contributions
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
          <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>Add bill</Text>
          <Text style={{ color: get('text.muted') as string }}>Group not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  const showAdvanced = advancedOpen && !(amountMode === 'final' && mode === 'exact' && proportionalTax);
  const derivedAdj = (amountMode === 'final' && mode === 'exact' && proportionalTax) ? Math.round((amountNum - sumExacts) * 100) / 100 : 0;

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const textOnSurface = get('text.onSurface') as string;
  const borderSubtle = get('border.subtle') as string;
  const backgroundDefault = get('background.default') as string;

  const sectionCardStyle = useMemo(() => ({
    backgroundColor: surface1,
    borderRadius: radius.xl,
    padding: spacing.s16,
    gap: spacing.s12,
    borderWidth: 1,
    borderColor: withAlpha(borderSubtle, isDark ? 0.6 : 1)
  }), [surface1, borderSubtle, isDark]);

  const amountPlaceholder = (amountMode === 'final' && mode === 'exact' && proportionalTax)
    ? 'Final receipt total'
    : (taxPct || discountPct) ? 'Subtotal amount' : 'Total amount';

  const splitLabel = mode === 'equal' ? 'Split equally'
    : mode === 'shares' ? 'Weighted shares'
    : proportionalTax ? 'Exact before tax' : 'Exact final amounts';

  const payerLabel = payerMode === 'single' ? 'One person paid'
    : payerMode === 'multi-even' ? 'Split payer evenly'
    : 'Custom contributions';

  const toggleAdvanced = () => {
    const next = !advancedOpen;
    setAdvancedOpen(next);
    AsyncStorage.setItem(KEY_ADVANCED_OPEN, next ? 'true' : 'false');
  };

  const chipStyle = (active: boolean) => ({
    paddingHorizontal: spacing.s12,
    paddingVertical: spacing.s8,
    borderRadius: radius.pill,
    backgroundColor: active ? withAlpha(accentPrimary, isDark ? 0.20 : 0.12) : surface2,
    borderWidth: 1,
    borderColor: active ? accentPrimary : withAlpha(borderSubtle, 0.7)
  });

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
        <View style={{ gap: spacing.s8 }}>
          <Text style={{ color: textMuted, fontSize: 12, letterSpacing: 0.8, fontWeight: '700', textTransform: 'uppercase' }}>
            New shared bill
          </Text>
          <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', lineHeight: 36, letterSpacing: -0.5 }}>
            {finalAmount > 0 ? formatCurrency(finalAmount) : 'Set the total'}
          </Text>
          <Text style={{ color: textMuted, fontSize: 14 }}>
            {splitLabel} • {participantIds.length} participant{participantIds.length === 1 ? '' : 's'} • {payerLabel}
          </Text>
        </View>

        <View style={sectionCardStyle}>
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Bill details</Text>
            <Text style={{ color: textMuted, fontSize: 12 }}>Give it a name and add the receipt amount.</Text>
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Bill title (optional)"
            placeholderTextColor={textMuted}
            style={{
              borderWidth: 1,
              borderColor: withAlpha(borderSubtle, 0.7),
              borderRadius: radius.lg,
              paddingVertical: spacing.s10,
              paddingHorizontal: spacing.s12,
              color: textPrimary,
              backgroundColor: surface2
            }}
          />

          <View style={{
            flexDirection: 'row',
            backgroundColor: withAlpha(surface2, 0.6),
            borderRadius: radius.pill,
            padding: 4,
            gap: 4
          }}>
            {[
              { value: 'subtotal', label: 'Subtotal amount' },
              { value: 'final', label: 'Final total' }
            ].map(opt => {
              const active = amountMode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    if (opt.value === 'final') {
                      setAmountMode('final');
                      setProportionalTax(true);
                    } else {
                      setAmountMode('subtotal');
                    }
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderRadius: radius.pill,
                    backgroundColor: active ? accentPrimary : 'transparent',
                    paddingVertical: spacing.s8,
                    paddingHorizontal: spacing.s12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1
                  })}
                >
                  <Text style={{ color: active ? textOnPrimary : textPrimary, fontWeight: '600' }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder={amountPlaceholder}
            keyboardType="decimal-pad"
            placeholderTextColor={textMuted}
            style={{
              borderWidth: 1,
              borderColor: withAlpha(borderSubtle, 0.7),
              borderRadius: radius.lg,
              paddingVertical: spacing.s12,
              paddingHorizontal: spacing.s12,
              color: textPrimary,
              backgroundColor: surface2,
              fontSize: 18,
              fontWeight: '700'
            }}
          />
        </View>

        <View style={sectionCardStyle}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Participants</Text>
              <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s4 }}>Tap to include everyone sharing this bill.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.s4 }}>
              <Pressable onPress={() => setParticipants(Object.fromEntries(activeMembers.map(m => [m.id, true])))} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ color: accentPrimary, fontWeight: '600', fontSize: 12 }}>Select all</Text>
              </Pressable>
              <Pressable onPress={() => setParticipants(Object.fromEntries(activeMembers.map(m => [m.id, false])))} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ color: textMuted, fontWeight: '600', fontSize: 12 }}>Clear</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {activeMembers.map(member => {
              const active = !!participants[member.id];
              return (
                <Pressable
                  key={member.id}
                  onPress={() => toggleParticipant(member.id)}
                  style={({ pressed }) => ({
                    ...chipStyle(active),
                    opacity: pressed ? 0.8 : 1
                  })}
                >
                  <Text style={{ color: active ? accentPrimary : textPrimary, fontWeight: '600' }}>{member.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: textMuted, fontSize: 12 }}>
            {participantIds.length === 0 ? 'No one selected yet.' : `${participantIds.length} participant${participantIds.length === 1 ? '' : 's'} selected.`}
          </Text>
        </View>

        <View style={sectionCardStyle}>
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Split it up</Text>
            <Text style={{ color: textMuted, fontSize: 12 }}>Choose how everyone shares the bill.</Text>
          </View>

          <View style={{
            flexDirection: 'row',
            backgroundColor: withAlpha(surface2, 0.6),
            borderRadius: radius.pill,
            padding: 4,
            gap: 4
          }}>
            {[
              { value: 'equal', label: 'Equal' },
              { value: 'shares', label: 'Shares' },
              { value: 'exact', label: 'Exact' }
            ].map(opt => {
              const active = mode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setMode(opt.value as typeof mode)}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderRadius: radius.pill,
                    backgroundColor: active ? accentPrimary : 'transparent',
                    paddingVertical: spacing.s8,
                    paddingHorizontal: spacing.s12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1
                  })}
                >
                  <Text style={{ color: active ? textOnPrimary : textPrimary, fontWeight: '600' }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'equal' && (
            <Text style={{ color: textMuted, fontSize: 12 }}>
              {participantIds.length || '—'} participant{participantIds.length === 1 ? '' : 's'} will split equally.
            </Text>
          )}

          {mode === 'shares' && (
            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: textMuted, fontSize: 12 }}>Enter weights – higher numbers pay more.</Text>
              <View style={{ gap: spacing.s8 }}>
                {participantIds.map(pid => {
                  const member = activeMembers.find(m => m.id === pid);
                  if (!member) return null;
                  return (
                    <View key={pid} style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: withAlpha(borderSubtle, 0.7),
                      backgroundColor: surface2,
                      paddingHorizontal: spacing.s12,
                      paddingVertical: spacing.s10,
                      gap: spacing.s12
                    }}>
                      <Text style={{ color: textPrimary, flex: 1, fontWeight: '600' }}>{member.name}</Text>
                      <TextInput
                        value={shares[pid] ?? ''}
                        onChangeText={t => setShares(s => ({ ...s, [pid]: t }))}
                        placeholder="1"
                        placeholderTextColor={textMuted}
                        keyboardType="decimal-pad"
                        style={{
                          width: 80,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: withAlpha(borderSubtle, 0.7),
                          paddingVertical: spacing.s8,
                          paddingHorizontal: spacing.s8,
                          textAlign: 'right',
                          color: textPrimary
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {mode === 'exact' && (
            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: textMuted, fontSize: 12 }}>
                {proportionalTax
                  ? 'Enter base amounts before tax/discount. We’ll apply adjustments evenly.'
                  : 'Enter each person’s final amount after tax/discount.'}
              </Text>
              <View style={{ gap: spacing.s8 }}>
                {participantIds.map(pid => {
                  const member = activeMembers.find(m => m.id === pid);
                  if (!member) return null;
                  return (
                    <View key={pid} style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: withAlpha(borderSubtle, 0.7),
                      backgroundColor: surface2,
                      paddingHorizontal: spacing.s12,
                      paddingVertical: spacing.s10,
                      gap: spacing.s12
                    }}>
                      <Text style={{ color: textPrimary, flex: 1, fontWeight: '600' }}>{member.name}</Text>
                      <TextInput
                        value={exacts[pid] ?? ''}
                        onChangeText={t => setExacts(s => ({ ...s, [pid]: t }))}
                        placeholder={proportionalTax ? 'Base amount' : 'Final amount'}
                        placeholderTextColor={textMuted}
                        keyboardType="decimal-pad"
                        style={{
                          width: 100,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: withAlpha(borderSubtle, 0.7),
                          paddingVertical: spacing.s8,
                          paddingHorizontal: spacing.s8,
                          textAlign: 'right',
                          color: textPrimary
                        }}
                      />
                    </View>
                  );
                })}
              </View>
              {amountMode === 'final' && mode === 'exact' && proportionalTax ? (
                <Text style={{ color: derivedAdj >= 0 ? get('semantic.success') as string : get('semantic.warning') as string, fontSize: 12 }}>
                  We’ll distribute the {derivedAdj >= 0 ? 'additional' : 'remaining'} {formatCurrency(Math.abs(derivedAdj))} proportionally.
                </Text>
              ) : null}
            </View>
          )}
        </View>

        <View style={sectionCardStyle}>
          <Pressable
            onPress={toggleAdvanced}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.s4,
              opacity: pressed ? 0.7 : 1
            })}
          >
            <View>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Tax & discounts</Text>
              <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s4 }}>Optional adjustments for receipt extras.</Text>
            </View>
            <View style={{ transform: [{ rotate: advancedOpen ? '90deg' : '0deg' }] }}>
              <Icon name="chevron-right" size={20} colorToken="text.muted" />
            </View>
          </Pressable>

          {showAdvanced && (
            <View style={{ gap: spacing.s12 }}>
              <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                <View style={{ flex: 1, gap: spacing.s8 }}>
                  <Text style={{ color: textPrimary, fontWeight: '600' }}>Tax {taxPct ? '(%)' : ''}</Text>
                  <TextInput
                    value={tax}
                    onChangeText={setTax}
                    placeholder={taxPct ? 'e.g. 7 for 7%' : 'Tax amount'}
                    keyboardType="decimal-pad"
                    placeholderTextColor={textMuted}
                    style={{
                      borderWidth: 1,
                      borderColor: withAlpha(borderSubtle, 0.7),
                      borderRadius: radius.lg,
                      paddingVertical: spacing.s10,
                      paddingHorizontal: spacing.s12,
                      color: textPrimary,
                      backgroundColor: surface2
                    }}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: textMuted }}>Percent</Text>
                    <Switch value={taxPct} onValueChange={setTaxPct} />
                  </View>
                </View>
                <View style={{ flex: 1, gap: spacing.s8 }}>
                  <Text style={{ color: textPrimary, fontWeight: '600' }}>Discount {discountPct ? '(%)' : ''}</Text>
                  <TextInput
                    value={discount}
                    onChangeText={setDiscount}
                    placeholder={discountPct ? 'e.g. 10 for 10%' : 'Discount amount'}
                    keyboardType="decimal-pad"
                    placeholderTextColor={textMuted}
                    style={{
                      borderWidth: 1,
                      borderColor: withAlpha(borderSubtle, 0.7),
                      borderRadius: radius.lg,
                      paddingVertical: spacing.s10,
                      paddingHorizontal: spacing.s12,
                      color: textPrimary,
                      backgroundColor: surface2
                    }}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: textMuted }}>Percent</Text>
                    <Switch value={discountPct} onValueChange={setDiscountPct} />
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: textMuted }}>Apply proportionally to everyone</Text>
                <Switch
                  value={proportionalTax}
                  onValueChange={setProportionalTax}
                  disabled={amountMode === 'final' && mode === 'exact'}
                />
              </View>
            </View>
          )}
        </View>

        <View style={sectionCardStyle}>
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Who paid?</Text>
            <Text style={{ color: textMuted, fontSize: 12 }}>Choose how the receipt was covered.</Text>
          </View>

          <View style={{
            flexDirection: 'row',
            backgroundColor: withAlpha(surface2, 0.6),
            borderRadius: radius.pill,
            padding: 4,
            gap: 4
          }}>
            {[
              { value: 'single', label: 'One person' },
              { value: 'multi-even', label: 'Split evenly' },
              { value: 'multi-custom', label: 'Custom amounts' }
            ].map(opt => {
              const active = payerMode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setPayerMode(opt.value as typeof payerMode)}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderRadius: radius.pill,
                    backgroundColor: active ? accentPrimary : 'transparent',
                    paddingVertical: spacing.s8,
                    paddingHorizontal: spacing.s12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1
                  })}
                >
                  <Text style={{ color: active ? textOnPrimary : textPrimary, fontWeight: '600' }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {payerMode === 'single' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
              {activeMembers.map(member => {
                const active = paidBy === member.id;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => setPaidBy(member.id)}
                    style={({ pressed }) => ({
                      ...chipStyle(active),
                      opacity: pressed ? 0.8 : 1
                    })}
                  >
                    <Text style={{ color: active ? accentPrimary : textPrimary, fontWeight: '600' }}>{member.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {payerMode === 'multi-even' && (
            <View style={{ gap: spacing.s12 }}>
              <Text style={{ color: textMuted, fontSize: 12 }}>Select everyone who chipped in equally.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                {activeMembers.map(member => {
                  const active = !!payersEven[member.id];
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => setPayersEven(prev => ({ ...prev, [member.id]: !prev[member.id] }))}
                      style={({ pressed }) => ({
                        ...chipStyle(active),
                        opacity: pressed ? 0.8 : 1
                      })}
                    >
                      <Text style={{ color: active ? accentPrimary : textPrimary, fontWeight: '600' }}>{member.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {payerMode === 'multi-custom' && (
            <View style={{ gap: spacing.s12 }}>
              <Text style={{ color: textMuted, fontSize: 12 }}>Toggle contributors and enter the amount each person paid.</Text>
              <View style={{ gap: spacing.s8 }}>
                {activeMembers.map(member => {
                  const active = !!payersCustom[member.id];
                  return (
                    <View key={member.id} style={{
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: withAlpha(borderSubtle, 0.7),
                      backgroundColor: active ? withAlpha(accentPrimary, isDark ? 0.20 : 0.12) : surface2,
                      paddingHorizontal: spacing.s12,
                      paddingVertical: spacing.s10,
                      gap: spacing.s8
                    }}>
                      <Pressable
                        onPress={() => setPayersCustom(prev => ({ ...prev, [member.id]: !prev[member.id] }))}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          opacity: pressed ? 0.7 : 1
                        })}
                      >
                        <Text style={{ color: textPrimary, fontWeight: '600' }}>{member.name}</Text>
                        <Icon name={active ? 'check' : 'plus'} size={18} colorToken={active ? 'accent.primary' : 'text.muted'} />
                      </Pressable>
                      <TextInput
                        value={contribs[member.id] ?? ''}
                        onChangeText={t => setContribs(s => ({ ...s, [member.id]: t }))}
                        placeholder="0.00"
                        placeholderTextColor={textMuted}
                        keyboardType="decimal-pad"
                        onFocus={() => setPayersCustom(prev => ({ ...prev, [member.id]: true }))}
                        style={{
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: withAlpha(borderSubtle, 0.7),
                          paddingVertical: spacing.s8,
                          paddingHorizontal: spacing.s8,
                          textAlign: 'right',
                          color: textPrimary,
                          opacity: active ? 1 : 0.6
                        }}
                        editable={active}
                      />
                    </View>
                  );
                })}
              </View>
              <Text style={{ color: remaining === 0 ? get('semantic.success') as string : get('semantic.warning') as string, fontWeight: '600' }}>
                Remaining to allocate: {formatCurrency(remaining)}
              </Text>
            </View>
          )}
        </View>

        <View style={sectionCardStyle}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Split preview</Text>
            <Text style={{ color: textMuted, fontSize: 12 }}>{previewRows.length} person{previewRows.length === 1 ? '' : 's'}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: textMuted }}>Final amount</Text>
            <Text style={{ color: textPrimary, fontWeight: '700' }}>{formatCurrency(finalAmount)}</Text>
          </View>
          {previewRows.length > 0 ? (
            <View style={{ gap: spacing.s8 }}>
              {previewRows.map(row => (
                <View key={row.memberId} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: radius.lg,
                  backgroundColor: surface2,
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s8
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textPrimary, fontWeight: '600' }}>{row.name}</Text>
                    <Text style={{ color: textMuted, fontSize: 12 }}>
                      Base {formatCurrency(row.base)} {row.adj !== 0 ? `· Adj ${row.adj > 0 ? '+' : ''}${formatCurrency(Math.abs(row.adj))}` : ''}
                    </Text>
                  </View>
                  <Text style={{ color: textPrimary, fontWeight: '700' }}>{formatCurrency(row.final)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: textMuted, fontSize: 12 }}>Add amounts to see the breakdown.</Text>
          )}
        </View>

        <View style={{ gap: spacing.s12 }}>
          <Button title="Save bill" onPress={onSave} />
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
