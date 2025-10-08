
import React from 'react';
import { View, Text, TextInput, Pressable, Keyboard, ScrollView, Platform, Animated } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore } from '../../store/invest';
import { useProfileStore } from '../../store/profile';
import DateTimeSheet from '../DateTimeSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  mode?: 'add'|'edit';
  lotId?: string;
  initial?: { side?: 'buy'|'sell'; qty?: number; price?: number; fees?: number; date?: string; };
  visible: boolean;
  onClose: () => void;
  symbol: string;
  portfolioId: string | null;
};

export default function TransactionEditorSheet({ visible, onClose, symbol, portfolioId, mode='add', lotId, initial }: Props) {
  const { get } = useThemeTokens();
  const store = useInvestStore() as any;
  const { profile } = useProfileStore();
  const insets = useSafeAreaInsets();

  // Smooth keyboard-driven footer animation
  const kb = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height || 0;
      const dur = e?.duration ?? 250;
      Animated.timing(kb, { toValue: h, duration: dur, useNativeDriver: false }).start();
    };
    const onHide = (e: any) => {
      const dur = e?.duration ?? 200;
      Animated.timing(kb, { toValue: 0, duration: dur, useNativeDriver: false }).start();
    };
    const s1 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const s2 = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    return () => { s1.remove(); s2.remove(); };
  }, [kb]);

  const [side, setSide] = React.useState<'buy'|'sell'>(initial?.side || 'buy');
  const [qtyInput, setQtyInput] = React.useState(initial?.qty != null ? String(initial.qty) : '');
  const [priceInput, setPriceInput] = React.useState(initial?.price != null ? String(initial.price) : '');
  const [feesInput, setFeesInput] = React.useState(initial?.fees != null ? String(initial.fees) : '');
  const [date, setDate] = React.useState<Date>(initial?.date ? new Date(initial.date) : new Date());
  const [openDate, setOpenDate] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      setSide('buy'); setQtyInput(''); setPriceInput(''); setFeesInput(''); setDate(new Date()); setOpenDate(false);
    }
  }, [visible]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const onPrimary = get('text.onPrimary') as string;

  const onSave = async () => {
    try { Keyboard.dismiss(); } catch {}
    const qty = Number(qtyInput || '0');
    const price = Number(priceInput || '0');
    const fees = feesInput ? Number(feesInput) : 0;
    if (!symbol || !portfolioId || !qty || !price) { onClose(); return; }

    const cur = ((profile?.currency) || 'USD').toUpperCase();
    if (mode === 'edit' && lotId) {
      await store.updateLot(symbol, lotId, { side, qty, price, date: date.toISOString(), fees }, { portfolioId });
    } else {
      await store.addLot(symbol, { side, qty, price, date: date.toISOString(), fees }, { name: symbol, type: 'stock', currency: cur }, { portfolioId });
    }
    try { await store.refreshQuotes([symbol]); } catch {}
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={420}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: spacing.s24 }}>
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 18, marginBottom: spacing.s4 }}>New transaction</Text>

          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <Pressable accessibilityRole="button" onPress={() => setSide('buy')} style={({ pressed }) => ({
              paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, borderWidth: 1,
              backgroundColor: side === 'buy' ? (get('accent.primary') as string) : (pressed ? (get('surface.level2') as string) : (get('surface.level1') as string)),
              borderColor: get('component.button.secondary.border') as string
            })}>
              <Text style={{ color: side === 'buy' ? onPrimary : text, fontWeight: '700' }}>Buy</Text>
            </Pressable>
            <Pressable onPress={() => setSide('sell')} style={({ pressed }) => ({
              paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, borderWidth: 1,
              backgroundColor: side === 'sell' ? (get('semantic.danger') as string) : (pressed ? (get('surface.level2') as string) : (get('surface.level1') as string)),
              borderColor: get('component.button.secondary.border') as string
            })}>
              <Text style={{ color: side === 'sell' ? onPrimary : text, fontWeight: '700' }}>Sell</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, marginBottom: spacing.s4 }}>Units</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={muted}
                value={qtyInput}
                onChangeText={setQtyInput}
                style={{ color: text, backgroundColor: get('surface.level2') as string, borderColor: border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.s12, height: 44 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, marginBottom: spacing.s4 }}>Price</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={muted}
                value={priceInput}
                onChangeText={setPriceInput}
                style={{ color: text, backgroundColor: get('surface.level2') as string, borderColor: border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.s12, height: 44 }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, marginBottom: spacing.s4 }}>Date</Text>
              <Pressable onPress={() => setOpenDate(true)} style={{ borderColor: border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.s12, height: 44, justifyContent: 'center', backgroundColor: get('surface.level2') as string }}>
                <Text style={{ color: text }}>{date.toDateString()}</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, marginBottom: spacing.s4 }}>Fees (optional)</Text>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={muted}
                value={feesInput}
                onChangeText={setFeesInput}
                style={{ color: text, backgroundColor: get('surface.level2') as string, borderColor: border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.s12, height: 44 }}
              />
            </View>
          </View>

          <View style={{ height: spacing.s12 }} />
        </View>
      </ScrollView>

      <Animated.View style={{
        paddingHorizontal: spacing.s16,
        paddingTop: spacing.s8,
        paddingBottom: Math.max(insets.bottom, 16),
        transform: [{ translateY: Animated.multiply(kb, -1) }],
        backgroundColor: get('surface.level1') as string
      }}>
        <Pressable onPress={onSave} style={{ backgroundColor: get('component.button.primary.bg') as string || (get('accent.primary') as string), height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: onPrimary, fontWeight: '700' }}>Save</Text>
        </Pressable>
      </Animated.View>

      <DateTimeSheet visible={openDate} date={date} onCancel={() => setOpenDate(false)} onConfirm={(d) => { setDate(d); setOpenDate(false); }} />
    </BottomSheet>
  );
}
