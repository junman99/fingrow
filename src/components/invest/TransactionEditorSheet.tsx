
import React from 'react';
import { View, Text, TextInput, Pressable, Keyboard, ScrollView, Platform } from 'react-native';
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


  const [side, setSide] = React.useState<'buy'|'sell'>(initial?.side || 'buy');
  const [qtyInput, setQtyInput] = React.useState(initial?.qty != null ? String(initial.qty) : '');
  const [priceInput, setPriceInput] = React.useState(initial?.price != null ? String(initial.price) : '');
  const [feesInput, setFeesInput] = React.useState(initial?.fees != null ? String(initial.fees) : '');
  const [date, setDate] = React.useState<Date>(initial?.date ? new Date(initial.date) : new Date());
  const [openDate, setOpenDate] = React.useState(false);
  const [affectCash, setAffectCash] = React.useState(mode !== 'edit');

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

    // Use active portfolio if no portfolioId is provided
    const pid = portfolioId || store.activePortfolioId;

    if (!symbol || !qty || !price) {
      console.warn('[TransactionEditorSheet] Missing required fields:', { symbol, qty, price });
      onClose();
      return;
    }

    if (!pid) {
      console.error('[TransactionEditorSheet] No portfolio ID available');
      onClose();
      return;
    }

    const cur = ((profile?.currency) || 'USD').toUpperCase();
    if (mode === 'edit' && lotId) {
      await store.updateLot(symbol, lotId, { side, qty, price, date: date.toISOString(), fees }, { portfolioId: pid });
      if (affectCash) {
        try {
          const gross = qty * price;
          const cf = side === 'buy' ? -(gross + fees) : (gross - fees);
          await store.addCash(cf, { portfolioId: pid });
        } catch {}
      }
    } else {
      await store.addLot(symbol, { side, qty, price, date: date.toISOString(), fees }, { name: symbol, type: 'stock', currency: cur }, { portfolioId: pid });
      if (affectCash) {
        try {
          const gross = qty * price;
          const cf = side === 'buy' ? -(gross + fees) : (gross - fees);
          await store.addCash(cf, { portfolioId: pid });
        } catch {}
      }
    }
    try { await store.refreshQuotes([symbol]); } catch {}
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={500}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: spacing.s24 }}>
        <View style={{ gap: spacing.s16 }}>
          {/* Header */}
          <View>
            <Text style={{ color: text, fontWeight: '800', fontSize: 24, letterSpacing: -0.5 }}>
              {mode === 'edit' ? 'Edit' : 'New'} Transaction
            </Text>
            <Text style={{ color: muted, fontSize: 14, marginTop: spacing.s4 }}>{symbol}</Text>
          </View>

          {/* Buy/Sell Toggle */}
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <Pressable
              onPress={() => setSide('buy')}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: spacing.s12,
                borderRadius: radius.md,
                alignItems: 'center',
                backgroundColor: side === 'buy' ? (get('accent.primary') as string) : (get('surface.level1') as string),
                opacity: pressed ? 0.8 : 1
              })}
            >
              <Text style={{ color: side === 'buy' ? onPrimary : text, fontWeight: '700', fontSize: 15 }}>Buy</Text>
            </Pressable>
            <Pressable
              onPress={() => setSide('sell')}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: spacing.s12,
                borderRadius: radius.md,
                alignItems: 'center',
                backgroundColor: side === 'sell' ? (get('semantic.danger') as string) : (get('surface.level1') as string),
                opacity: pressed ? 0.8 : 1
              })}
            >
              <Text style={{ color: side === 'sell' ? onPrimary : text, fontWeight: '700', fontSize: 15 }}>Sell</Text>
            </Pressable>
          </View>

          {/* Inputs */}
          <View style={{ gap: spacing.s12 }}>
            <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, marginBottom: spacing.s6, fontSize: 13, fontWeight: '600' }}>Shares</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={muted}
                  value={qtyInput}
                  onChangeText={setQtyInput}
                  style={{
                    color: text,
                    backgroundColor: get('surface.level1') as string,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.s12,
                    height: 48,
                    fontSize: 16,
                    fontWeight: '600'
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, marginBottom: spacing.s6, fontSize: 13, fontWeight: '600' }}>Price</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={muted}
                  value={priceInput}
                  onChangeText={setPriceInput}
                  style={{
                    color: text,
                    backgroundColor: get('surface.level1') as string,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.s12,
                    height: 48,
                    fontSize: 16,
                    fontWeight: '600'
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, marginBottom: spacing.s6, fontSize: 13, fontWeight: '600' }}>Date</Text>
                <Pressable
                  onPress={() => setOpenDate(true)}
                  style={{
                    backgroundColor: get('surface.level1') as string,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.s12,
                    height: 48,
                    justifyContent: 'center'
                  }}
                >
                  <Text style={{ color: text, fontWeight: '600' }}>{date.toLocaleDateString()}</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: muted, marginBottom: spacing.s6, fontSize: 13, fontWeight: '600' }}>Fees</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={muted}
                  value={feesInput}
                  onChangeText={setFeesInput}
                  style={{
                    color: text,
                    backgroundColor: get('surface.level1') as string,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.s12,
                    height: 48,
                    fontSize: 16,
                    fontWeight: '600'
                  }}
                />
              </View>
            </View>
          </View>

          {/* Affect Cash Toggle */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: get('surface.level1') as string,
            padding: spacing.s16,
            borderRadius: radius.md
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Adjust cash balance</Text>
              <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>Update portfolio cash</Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: affectCash }}
              onPress={() => setAffectCash(v => !v)}
              style={({ pressed }) => ({
                width: 51,
                height: 31,
                borderRadius: 999,
                backgroundColor: affectCash ? (get('accent.primary') as string) : (get('surface.level2') as string),
                alignItems: affectCash ? 'flex-end' : 'flex-start',
                justifyContent: 'center',
                paddingHorizontal: 2,
                opacity: pressed ? 0.9 : 1
              })}
            >
              <View style={{ width: 27, height: 27, borderRadius: 999, backgroundColor: onPrimary }} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={{
        paddingHorizontal: spacing.s16,
        paddingTop: spacing.s12,
        paddingBottom: Math.max(insets.bottom, 16),
        backgroundColor: get('component.sheet.bg') as string,
        borderTopWidth: 1,
        borderTopColor: get('border.subtle') as string
      }}>
        <Pressable
          onPress={onSave}
          style={({ pressed }) => ({
            backgroundColor: get('component.button.primary.bg') as string || (get('accent.primary') as string),
            height: 50,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.9 : 1
          })}
        >
          <Text style={{ color: onPrimary, fontWeight: '700', fontSize: 16 }}>
            {mode === 'edit' ? 'Update' : 'Save'} Transaction
          </Text>
        </Pressable>
      </View>

      <DateTimeSheet visible={openDate} date={date} onCancel={() => setOpenDate(false)} onConfirm={(d) => { setDate(d); setOpenDate(false); }} />
    </BottomSheet>
  );
}
