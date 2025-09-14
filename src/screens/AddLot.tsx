import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useInvestStore } from '../store/invest';
import DateTimeSheet from '../components/DateTimeSheet';

export function AddLot() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const symbol = route.params?.symbol as string;

  const [side, setSide] = useState<'buy'|'sell'>('buy');
  const [qty, setQty] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [fee, setFee] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);

  const { addLot } = useInvestStore();

  const onSave = async () => {
    if (!qty || !price) return;
    await addLot(symbol, {
      side,
      qty: Number(qty),
      price: Number(price),
      fee: fee ? Number(fee) : undefined,
      date: date.toISOString(),
    }, { name: symbol, type: 'stock', currency: 'USD' });
    nav.goBack();
  };

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg = get('surface.level1') as string;
  const accent = get('accent.primary') as string;

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: text, fontWeight:'700', fontSize: 18 }}>{symbol} · Add lot</Text>

        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          {(['buy','sell'] as const).map(k => {
            const on = side === k;
            return (
              <Pressable key={k} onPress={() => setSide(k)} style={{ backgroundColor: on ? accent : get('surface.level2') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
                <Text style={{ color: on ? get('text.onPrimary') as string : text, fontWeight:'700' }}>{k.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s12, gap: spacing.s8 }}>
          <Text style={{ color: muted }}>Quantity</Text>
          <TextInput keyboardType="decimal-pad" value={qty} onChangeText={setQty} placeholder="0" placeholderTextColor={muted} style={{ color: text, paddingVertical: spacing.s8 }} />

          <Text style={{ color: muted, marginTop: spacing.s8 }}>Price</Text>
          <TextInput keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor={muted} style={{ color: text, paddingVertical: spacing.s8 }} />

          <Text style={{ color: muted, marginTop: spacing.s8 }}>Fee (optional)</Text>
          <TextInput keyboardType="decimal-pad" value={fee} onChangeText={setFee} placeholder="0.00" placeholderTextColor={muted} style={{ color: text, paddingVertical: spacing.s8 }} />

          <Pressable onPress={() => setOpen(true)} style={{ alignSelf:'flex-start', backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, marginTop: spacing.s8 }}>
            <Text style={{ color: text }}>Date: {date.toLocaleString()}</Text>
          </Pressable>
        </View>

        <Pressable onPress={onSave} style={{ backgroundColor: accent, paddingHorizontal: spacing.s12, paddingVertical: spacing.s12, borderRadius: radius.lg, alignItems:'center' }}>
          <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Save</Text>
        </Pressable>
      </View>

      <DateTimeSheet visible={open} date={date} onCancel={() => setOpen(false)} onConfirm={(d)=>{ setDate(d); setOpen(false); }} />
    </Screen>
  );
}