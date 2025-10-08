// NOTE: Replaced AddBill with version that includes live preview, amount mode, proportional toggle, and robust validations.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert, TextInput, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenScroll } from '../../components/ScreenScroll';
import { AppHeader } from '../../components/AppHeader';
import Button from '../../components/Button';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useGroupsStore } from '../../store/groups';
import { formatCurrency } from '../../lib/format';
import type { ID } from '../../types/groups';

const KEY_ADVANCED_OPEN = 'fingrow/ui/addbill/advancedOpen';

type SplitRow = { memberId: string; name: string; base: number; adj: number; final: number };

export default function AddBill() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { groupId } = (route?.params ?? {}) as { groupId: string };
  const { groups, addBill } = useGroupsStore();
  const group = groups.find(g => g.id === groupId);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [amountMode, setAmountMode] = useState<'subtotal'|'final'>('subtotal');
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
  const [participants, setParticipants] = useState<Record<string, boolean>>(() => Object.fromEntries(activeMembers.map(m=>[m.id,true])));
  const participantIds = Object.entries(participants).filter(([_,v])=>v).map(([k])=>k);

  const [mode, setMode] = useState<'equal'|'shares'|'exact'>('equal');
  const [shares, setShares] = useState<Record<string, string>>({});
  const [exacts, setExacts] = useState<Record<string, string>>({});

  const [payerMode, setPayerMode] = useState<'single'|'multi-even'|'multi-custom'>('single');
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [payersEven, setPayersEven] = useState<Record<string, boolean>>({});
  const [payersCustom, setPayersCustom] = useState<Record<string, boolean>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [contribs, setContribs] = useState<Record<string, string>>({});

  const amountNum = useMemo(() => Number(amount) || 0, [amount]);
  const baseSubtotal = useMemo(() => {
    if (amountMode === 'final' && mode === 'exact' && proportionalTax) {
      const base = participantIds.reduce((a,id)=> a + (Number(exacts[id]||0) || 0), 0);
      return Math.round(base*100)/100;
    }
    return amountNum;
  }, [amountMode, amountNum, mode, proportionalTax, exacts, participantIds]);

  const taxVal = useMemo(() => (taxPct ? baseSubtotal * (Number(tax)||0)/100 : (Number(tax)||0)), [taxPct, tax, baseSubtotal]);
  const discVal = useMemo(() => (discountPct ? baseSubtotal * (Number(discount)||0)/100 : (Number(discount)||0)), [discountPct, discount, baseSubtotal]);
  const finalAmount = useMemo(() => {
    if (amountMode === 'final' && mode === 'exact' && proportionalTax) return amountNum;
    const f = baseSubtotal + (taxVal||0) - (discVal||0);
    return Math.round(f*100)/100;
  }, [amountMode, amountNum, baseSubtotal, taxVal, discVal, mode, proportionalTax]);

  const sumExacts = useMemo(() => participantIds.reduce((acc,id)=> acc + (Number(exacts[id]||0) || 0), 0), [exacts, participantIds]);
  const sumContribs = useMemo(() => Object.values(contribs).reduce((a,b)=> a + (Number(b)||0), 0), [contribs]);
  const remaining = useMemo(() => Math.round((finalAmount - sumContribs)*100)/100, [finalAmount, sumContribs]);

  const toggleParticipant = (id: string) => setParticipants(p => ({ ...p, [id]: !p[id] }));

  // --- Preview math (same as store logic) ---
  const previewRows: SplitRow[] = useMemo(() => {
    const ids = participantIds;
    const base = baseSubtotal;
    const tax = taxVal || 0; const disc = discVal || 0;
    let baseSplits: { id: string; val: number }[] = [];
    if (mode === 'equal') {
      const each = Math.floor((base / (ids.length||1)) * 100) / 100;
      let assigned = Math.round(each * (ids.length||1) * 100)/100;
      let remainder = Math.round((base - assigned) * 100)/100;
      baseSplits = ids.map((id, idx) => ({ id, val: idx === ids.length - 1 ? Math.round((each + remainder)*100)/100 : each }));
    } else if (mode === 'shares') {
      const weights = ids.map(id => Number(shares[id]||1));
      const weightSum = weights.reduce((a,b)=>a+b,0) || 1;
      let assigned = 0;
      baseSplits = ids.map((id, idx) => {
        let share = Math.round((base * (weights[idx] / weightSum))*100)/100;
        if (idx === ids.length - 1) share = Math.round((base - assigned)*100)/100;
        assigned = Math.round((assigned + share)*100)/100;
        return { id, val: share };
      });
    } else {
      if (mode === 'exact' && proportionalTax) {
        const totals = ids.map(id => Number(exacts[id]||0));
        const sumEx = Math.round((totals.reduce((a,b)=>a+b,0))*100)/100;
        if (Math.abs(sumEx - base) > 0.01) return [];
        baseSplits = ids.map(id => ({ id, val: Math.round((Number(exacts[id]||0))*100)/100 }));
      } else if (mode === 'exact' && !proportionalTax) {
        // final entered per person
        const totals = ids.map(id => Number(exacts[id]||0));
        const s = Math.round(totals.reduce((a,b)=>a+b,0)*100)/100;
        if (Math.abs(s - (finalAmount||0)) > 0.01) return [];
        return ids.map(id => ({
          memberId: id,
          name: activeMembers.find(m=>m.id===id)?.name || '—',
          base: 0,
          adj: 0,
          final: Math.round((Number(exacts[id]||0))*100)/100
        }));
      }
    }
    const baseSum = Math.round(baseSplits.reduce((a,b)=>a+b.val,0)*100)/100 || 1;
    return ids.map((id, idx) => {
      const baseShare = baseSplits.find(s => s.id === id)?.val ?? 0;
      let finalShare = proportionalTax ? Math.round((baseShare + (baseShare / baseSum) * (tax - disc))*100)/100 : baseShare;
      if (idx === ids.length - 1) finalShare = Math.round((finalAmount - (baseSplits.slice(0, idx).reduce((a,b)=>a + (proportionalTax ? (b.val + (b.val/baseSum)*(tax-disc)) : b.val), 0)))*100)/100;
      const adj = Math.round((finalShare - baseShare)*100)/100;
      return { memberId: id, name: activeMembers.find(m=>m.id===id)?.name || '—', base: baseShare, adj, final: finalShare };
    });
  }, [participantIds, baseSubtotal, taxVal, discVal, mode, proportionalTax, shares, exacts, finalAmount, activeMembers]);

  // Save handler (same as before, with validations)
  const onSave = async () => {
    if (!group) return;
    const amt = parseFloat(amount || '0');
    if (isNaN(amt) || amt <= 0) { Alert.alert('Enter a valid amount'); return; }
    if (participantIds.length === 0) { Alert.alert('Select at least one participant'); return; }

    const canInferFinal = (mode === 'exact' && proportionalTax && (Number(tax||0) === 0) && (Number(discount||0) === 0) && Math.abs(sumExacts - amt) > 0.01);
    const treatAsFinal = (amountMode === 'final' && mode === 'exact' && proportionalTax) || canInferFinal;

    let payloadAmount = amt;
    let payloadTaxMode: 'abs'|'pct' = taxPct ? 'pct' : 'abs';
    let payloadTax = Number(tax||0) || 0;
    let payloadDiscMode: 'abs'|'pct' = discountPct ? 'pct' : 'abs';
    let payloadDisc = Number(discount||0) || 0;
    let exactsMap: Record<string, number> | undefined = undefined;
    let sharesMap: Record<string, number> | undefined = undefined;
    let propTax = proportionalTax;

    if (mode === 'shares') {
      sharesMap = Object.fromEntries(Object.entries(shares).map(([k,v])=>[k as ID, Number(v)||0]));
    }
    if (mode === 'exact') {
      exactsMap = Object.fromEntries(Object.entries(exacts).map(([k,v])=>[k as ID, Number(v)||0]));
    }

    if (treatAsFinal) {
      const baseSum = Math.round((sumExacts)*100)/100;
      if (baseSum <= 0) { Alert.alert('Enter base amounts for at least one participant'); return; }
      const adj = Math.round((amt - baseSum)*100)/100;
      payloadAmount = baseSum;
      payloadTaxMode = 'abs'; payloadDiscMode = 'abs';
      if (adj >= 0) { payloadTax = adj; payloadDisc = 0; } else { payloadTax = 0; payloadDisc = Math.abs(adj); }
      propTax = true;
    } else {
      if (mode === 'exact' && !proportionalTax) {
        const f = baseSubtotal + (taxVal||0) - (discVal||0);
        const sumF = Math.round(sumExacts*100)/100;
        const fin = Math.round(f*100)/100;
        if (Math.abs(sumF - fin) > 0.01) {
          Alert.alert(`Exact amounts must sum to ${fin.toFixed(2)}`);
          return;
        }
      } else if (mode === 'exact' && proportionalTax) {
        const sumBase = Math.round(sumExacts*100)/100;
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
      const ids = Object.entries(payersEven).filter(([_,v])=>v).map(([k])=>k);
      if (ids.length === 0) { Alert.alert('Select at least one payer'); return; }
      payersEvenIds = ids as ID[];
    } else {
      const entries = Object.entries(contribs).filter(([id,v]) => (Number(v)||0) > 0);
      const total = Math.round(entries.reduce((a,[_,v])=> a + (Number(v)||0), 0)*100)/100;
      if (Math.abs(total - finalAmount) > 0.01) { Alert.alert(`Contributions must sum to ${finalAmount.toFixed(2)}`); return; }
      contributions = Object.fromEntries(entries.map(([k,v])=>[k as ID, Number(v)||0]));
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
        <AppHeader title="Add bill" />
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.muted') as string }}>Group not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  const showAdvanced = advancedOpen && !(amountMode === 'final' && mode === 'exact' && proportionalTax);
  const derivedAdj = (amountMode === 'final' && mode === 'exact' && proportionalTax) ? Math.round((amountNum - sumExacts)*100)/100 : 0;

  return (
    <ScreenScroll>
      <AppHeader title="Add bill" />
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Details</Text>

        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ color: get('text.primary') as string }}>Amount is</Text>
          <View style={{ flexDirection:'row', gap: spacing.s8 }}>
            <Button variant={amountMode==='subtotal'?'primary':'secondary'} title="Subtotal" onPress={()=>setAmountMode('subtotal')} />
            <Button variant={amountMode==='final'?'primary':'secondary'} title="Final total" onPress={()=>{ setAmountMode('final'); setProportionalTax(true); }} />
          </View>
        </View>

        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder={ (amountMode === 'final' && mode === 'exact' && proportionalTax) ? 'Final receipt total' : (taxPct || discountPct) ? 'Subtotal amount' : 'Total amount' }
          keyboardType="decimal-pad"
          placeholderTextColor={get('text.muted') as string}
          style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color:get('text.primary') as string, backgroundColor:get('surface.level1') as string }}
        />

        <View style={{ flexDirection: 'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Advanced (Tax & Discount)</Text>
          <Button variant="ghost" title={showAdvanced ? "Hide" : "Show"} onPress={() => { const next = !showAdvanced; setAdvancedOpen(next); AsyncStorage.setItem(KEY_ADVANCED_OPEN, next.toString()); }} />
        </View>

        {showAdvanced ? (
          <View style={{ flexDirection:'row', gap: spacing.s12 }}>
            <View style={{ flex:1, gap: spacing.s8 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight:'600' }}>Tax {taxPct ? '(%)' : ''}</Text>
              <TextInput value={tax} onChangeText={setTax} placeholder={taxPct ? 'e.g. 7 for 7%' : 'Tax amount'} keyboardType="decimal-pad" placeholderTextColor={get('text.muted') as string} style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color:get('text.primary') as string, backgroundColor:get('surface.level1') as string }} />
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <Text style={{ color: get('text.muted') as string }}>Percent</Text>
                <Switch value={taxPct} onValueChange={setTaxPct} />
              </View>
            </View>
            <View style={{ flex:1, gap: spacing.s8 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight:'600' }}>Discount {discountPct ? '(%)' : ''}</Text>
              <TextInput value={discount} onChangeText={setDiscount} placeholder={discountPct ? 'e.g. 10 for 10%' : 'Discount amount'} keyboardType="decimal-pad" placeholderTextColor={get('text.muted') as string} style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color:get('text.primary') as string, backgroundColor:get('surface.level1') as string }} />
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <Text style={{ color: get('text.muted') as string }}>Percent</Text>
                <Switch value={discountPct} onValueChange={setDiscountPct} />
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ color: get('text.muted') as string }}>Apply tax/discount proportionally to splits</Text>
          <Switch value={proportionalTax} onValueChange={setProportionalTax} disabled={amountMode==='final' && mode==='exact'} />
        </View>

        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Participants</Text>
          <Button variant="ghost" title="Select all" onPress={() => setParticipants(Object.fromEntries(activeMembers.map(m=>[m.id,true])))} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
          {activeMembers.map(m => (
            <Button key={m.id} variant={participants[m.id] ? 'primary' : 'secondary'} title={m.name} onPress={() => toggleParticipant(m.id)} />
          ))}
        </View>

        <View style={{ flexDirection:'row', gap: spacing.s8, alignItems:'center' }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Split mode</Text>
          <Button variant={mode==='equal'?'primary':'secondary'} title="Equal" onPress={() => setMode('equal')} />
          <Button variant={mode==='shares'?'primary':'secondary'} title="By shares" onPress={() => setMode('shares')} />
          <Button variant={mode==='exact'?'primary':'secondary'} title="Exact" onPress={() => setMode('exact')} />
        </View>

        {mode === 'shares' ? (
          <View style={{ gap: spacing.s8 }}>
            {activeMembers.filter(m => participantIds.includes(m.id)).map(m => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: get('text.primary') as string, width: 100 }}>{m.name}</Text>
                <TextInput value={shares[m.id] ?? ''} onChangeText={(t)=>setShares(s => ({ ...s, [m.id]: t }))} placeholder="weight (e.g. 1, 2)" keyboardType="decimal-pad" placeholderTextColor={get('text.muted') as string} style={{ flex:1, borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color:get('text.primary') as string, backgroundColor:get('surface.level1') as string }} />
              </View>
            ))}
          </View>
        ) : null}

        {mode === 'exact' ? (
          <View style={{ gap: spacing.s8 }}>
            {activeMembers.filter(m => participantIds.includes(m.id)).map(m => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: get('text.primary') as string, width: 100 }}>{m.name}</Text>
                <TextInput value={exacts[m.id] ?? ''} onChangeText={(t)=>setExacts(s => ({ ...s, [m.id]: t }))} placeholder={(amountMode==='final' && proportionalTax) ? "base (pre-tax)" : proportionalTax ? "base (pre-tax)" : "final amount"} keyboardType="decimal-pad" placeholderTextColor={get('text.muted') as string} style={{ flex:1, borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color:get('text.primary') as string, backgroundColor:get('surface.level1') as string }} />
              </View>
            ))}
            <Text style={{ color: get('text.muted') as string }}>
              {(amountMode==='final' && proportionalTax) ? 'We will derive tax/discount and spread proportionally.' : (proportionalTax ? 'Base exacts must sum to Subtotal' : 'Exact amounts must sum to Final total')}
            </Text>
            {(amountMode==='final' && proportionalTax) ? (
              <Text style={{ color: derivedAdj >= 0 ? get('semantic.success') as string : get('semantic.warning') as string }}>
                Derived combined {derivedAdj >= 0 ? 'tax' : 'discount'}: ${Math.abs(derivedAdj).toFixed(2)} (distributed proportionally)
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* --- Live preview panel --- */}
        {previewRows.length > 0 ? (
          <View style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, gap: spacing.s8 }}>
            <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Preview (post-tax per person)</Text>
            {previewRows.map(r => (
              <Text key={r.memberId} style={{ color: get('text.primary') as string }}>
                {r.name}: base ${r.base.toFixed(2)} {r.adj===0?'':' '+(r.adj>0?'+':'')+r.adj.toFixed(2)} → <Text style={{ fontWeight:'700' }}>${r.final.toFixed(2)}</Text>
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Paid by</Text>
        <View style={{ flexDirection: 'row', gap: spacing.s8, flexWrap:'wrap' }}>
          <Button variant={payerMode==='single'?'primary':'secondary'} title="Single" onPress={() => setPayerMode('single')} />
          <Button variant={payerMode==='multi-even'?'primary':'secondary'} title="Multiple (even)" onPress={() => setPayerMode('multi-even')} />
          <Button variant={payerMode==='multi-custom'?'primary':'secondary'} title="Multiple (custom)" onPress={() => setPayerMode('multi-custom')} />
        </View>

        {payerMode === 'single' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {activeMembers.map(m => (
              <Button key={m.id} variant={paidBy === m.id ? 'primary' : 'secondary'} title={m.name} onPress={() => setPaidBy(m.id)} />
            ))}
          </View>
        ) : payerMode === 'multi-even' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {activeMembers.map(m => (
              <Button key={m.id} variant={payersEven[m.id] ? 'primary' : 'secondary'} title={m.name} onPress={() => setPayersEven(prev => ({ ...prev, [m.id]: !prev[m.id] }))} />
            ))}
          </View>
        ) : (
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: get('text.muted') as string }}>Select payers, then type amounts (custom). You can adjust in Bill Details later too.</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap: spacing.s8 }}>
              {activeMembers.map(m => (
                <Button key={m.id} variant={payersCustom[m.id] ? 'primary' : 'secondary'} title={m.name} onPress={() => setPayersCustom(prev => ({ ...prev, [m.id]: !prev[m.id] }))} />
              ))}
            </View>
            {activeMembers.map(m => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: get('text.primary') as string, width: 90 }}>{m.name}</Text>
                <TextInput value={contribs[m.id] ?? ''} onChangeText={(t)=>setContribs(s => ({ ...s, [m.id]: t }))} placeholder="amount" keyboardType="decimal-pad" placeholderTextColor={get('text.muted') as string} style={{ flex:1, borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color: get('text.primary') as string, backgroundColor:get('surface.level1') as string }} />
              </View>
            ))}
            <Text style={{ color: remaining === 0 ? (get('semantic.success') as string) : (get('semantic.warning') as string) }}>Remaining to allocate: {formatCurrency(remaining)}</Text>
          </View>
        )}

        <View style={{ padding: spacing.s12, borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, gap: spacing.s8 }}>
          <Text style={{ color: get('text.primary') as string }}>Final amount: S${finalAmount.toFixed(2)}</Text>
        </View>

        <Button title="Save bill" onPress={onSave} />
      </View>
    </ScreenScroll>
  );
}
