import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Screen } from '../../../components/Screen';
import { spacing, radius } from '../../../theme/tokens';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useInvestStore } from '../store/invest';

export default function EditLot() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const symbol = route.params?.symbol as string;
  const lotId = route.params?.lotId as string;
  const { holdings, updateLot, removeLot } = useInvestStore();

  const lots = holdings[symbol]?.lots || [];
  const lot = lots.find(l => l.id === lotId);

  const [side, setSide] = useState<'buy'|'sell'>(lot?.side || 'buy');
  const [qty, setQty] = useState<string>(lot ? String(lot.qty) : '');
  const [price, setPrice] = useState<string>(lot ? String(lot.price) : '');
  const [fee, setFee] = useState<string>(lot && lot.fee ? String(lot.fee) : '');
  const [date, setDate] = useState<Date>(lot ? new Date(lot.date) : new Date());

  useEffect(() => { if (!lot) nav.goBack(); }, [lotId]);

  const onSave = async () => {
    await updateLot(symbol, lotId, {
      side, qty: Number(qty), price: Number(price), fee: fee ? Number(fee) : undefined, date: date.toISOString()
    });
    nav.goBack();
  };
  const onDelete = async () => {
    await removeLot(symbol, lotId);
    nav.goBack();
  };

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg = get('surface.level1') as string;
  const accent = get('accent.primary') as string;

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: text, fontWeight:'700', fontSize: 18 }}>{symbol} · Edit lot</Text>

        <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s12, gap: spacing.s8 }}>
          <Text style={{ color: muted }}>Side</Text>
          <View style={{ flexDirection:'row', gap: spacing.s8 }}>
            {(['buy','sell'] as const).map(k => {
              const on = side === k;
              return (
                <Pressable accessibilityRole="button" key={k} onPress={() => setSide(k)} style={{ backgroundColor: on ? accent : get('surface.level2') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
                  <Text style={{ color: on ? get('text.onPrimary') as string : text, fontWeight:'700' }}>{k.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: muted, marginTop: spacing.s8 }}>Quantity</Text>
          <TextInput keyboardType="decimal-pad" value={qty} onChangeText={setQty} placeholder="0" placeholderTextColor={muted} style={{ color: text, paddingVertical: spacing.s8 }} />

          <Text style={{ color: muted, marginTop: spacing.s8 }}>Price</Text>
          <TextInput keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor={muted} style={{ color: text, paddingVertical: spacing.s8 }} />

          <Text style={{ color: muted, marginTop: spacing.s8 }}>Fee (optional)</Text>
          <TextInput keyboardType="decimal-pad" value={fee} onChangeText={setFee} placeholder="0.00" placeholderTextColor={muted} style={{ color: text, paddingVertical: spacing.s8 }} />
        </View>

        <View style={{ flexDirection:'row', gap: spacing.s12 }}>
          <Pressable onPress={onSave} style={{ flex:1, backgroundColor: accent, paddingHorizontal: spacing.s12, paddingVertical: spacing.s12, borderRadius: radius.lg, alignItems:'center' }}>
            <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Save</Text>
          </Pressable>
          <Pressable onPress={onDelete} style={{ flex:1, backgroundColor: get('semantic.danger') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s12, borderRadius: radius.lg, alignItems:'center' }}>
            <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}