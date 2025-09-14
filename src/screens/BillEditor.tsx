import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { AppHeader } from '../components/AppHeader';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/Button';
import Input from '../components/Input';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useRecurringStore, Recurring, Freq } from '../store/recurring';

export default function BillEditor() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { items, hydrate, ready, add, update } = useRecurringStore();

  const editingId: string | undefined = route.params?.id;
  const prefillAmount: number | undefined = route.params?.amount;
  const prefillCategory: string | undefined = route.params?.category;
  const prefillLabel: string | undefined = route.params?.label;

  const editing = items?.find(it => it.id === editingId);

  const [label, setLabel] = useState(editing?.label ?? (prefillLabel || ''));
  const [category, setCategory] = useState(editing?.category ?? (prefillCategory || 'bills'));
  const [amount, setAmount] = useState<string>((editing?.amount ?? prefillAmount ?? 0).toString());
  const [freq, setFreq] = useState<Freq>(editing?.freq ?? 'monthly');
  const [anchorISO, setAnchorISO] = useState<string>(editing?.anchorISO ?? new Date().toISOString());
  const [autoPost, setAutoPost] = useState<boolean>(editing?.autoPost ?? false);
  const [remind, setRemind] = useState<boolean>(editing?.remind ?? true);
  const [active, setActive] = useState<boolean>(editing?.active !== false);
  const [autoMatch, setAutoMatch] = useState<boolean>(editing?.autoMatch !== false);

  useEffect(() => { if (!ready) hydrate(); }, [ready]);

  const onSave = async () => {
    const payload = {
      label: label || category,
      category,
      amount: Math.max(0, Math.round(Number(amount)||0)),
      freq,
      anchorISO,
      autoPost,
      remind,
      active,
      autoMatch
    };
    if (editing) {
      await update(editing.id, payload);
    } else {
      await add(payload as any);
    }
    nav.goBack();
  };

  const Seg = (f: Freq, text: string) => {
    const on = freq === f;
    return (
      <Pressable onPress={() => setFreq(f)} style={({ pressed }) => ({
        paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill,
        backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string),
        opacity: pressed ? 0.9 : 1
      })}>
        <Text style={{ color: on ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight: '700' }}>{text}</Text>
      </Pressable>
    );
  };

  return (
    <ScreenScroll allowBounce>
      <AppHeader title={editing ? 'Edit bill' : 'Add bill'} onBack={() => nav.goBack()} />
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <Input label="Label" placeholder="e.g., Rent, Spotify" value={label} onChangeText={setLabel} />
        <Input label="Category" placeholder="bills" value={category} onChangeText={setCategory} />
        <Input label="Amount (S$)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <View style={{ flexDirection:'row', gap: spacing.s8, alignItems:'center' }}>
          <Text style={{ color: get('text.muted') as string }}>Cadence:</Text>
          {Seg('monthly','Monthly')}
          {Seg('biweekly','Bi-weekly')}
          {Seg('weekly','Weekly')}
        </View>
        <Text style={{ color: get('text.muted') as string }}>Anchor date: {new Date(anchorISO).toDateString()}</Text>
        <Button title="Set anchor to today" variant="secondary" onPress={() => setAnchorISO(new Date().toISOString())} />

        <View style={{ flexDirection:'row', gap: spacing.s12 }}>
          <Button title={autoPost ? 'Auto-post: ON' : 'Auto-post: OFF'} variant="secondary" onPress={() => setAutoPost(v=>!v)} />
          <Button title={remind ? 'Remind: ON' : 'Remind: OFF'} variant="secondary" onPress={() => setRemind(v=>!v)} />
          <Button title={active ? 'Active' : 'Inactive'} variant="secondary" onPress={() => setActive(v=>!v)} />
          <Button title={autoMatch ? "Auto-match: ON" : "Auto-match: OFF"} variant="secondary" onPress={() => setAutoMatch(v=>!v)} />
        </View>

        <Button title="Save" variant="primary" onPress={onSave} />
      </View>
    </ScreenScroll>
  );
}