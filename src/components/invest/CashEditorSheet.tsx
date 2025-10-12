import React from 'react';
import { View, Text, TextInput, Pressable, Keyboard, ScrollView, Platform } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore } from '../../store/invest';

type Props = {
  visible: boolean;
  onClose: () => void;
  portfolioId: string | null;
  currency: string;
};

export default function CashEditorSheet({ visible, onClose, portfolioId, currency }: Props) {
  const { get } = useThemeTokens();
  const store = useInvestStore() as any;
  const [mode, setMode] = React.useState<'deposit'|'withdraw'>('deposit');
  const [amount, setAmount] = React.useState('');

  React.useEffect(() => { if (!visible) { setMode('deposit'); setAmount(''); } }, [visible]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;

  const onSave = async () => {
    try { Keyboard.dismiss(); } catch {}
    const n = Number(amount || '0');
    if (!portfolioId || !n) { onClose(); return; }
    const signed = mode === 'deposit' ? n : -n;
    try { await store.addCash(signed, { portfolioId }); } catch {}
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={300}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: spacing.s16 }}>
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>Adjust cash</Text>
          <View style={{ flexDirection:'row', gap: spacing.s8 }}>
            <Pressable accessibilityRole="button" onPress={() => setMode('deposit')} style={({ pressed }) => ({ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, borderWidth: 1, backgroundColor: mode==='deposit' ? (get('accent.primary') as string) : (pressed ? (get('surface.level2') as string) : (get('surface.level1') as string)), borderColor: get('component.button.secondary.border') as string })}>
              <Text style={{ color: mode==='deposit' ? (get('text.onPrimary') as string) : text, fontWeight:'700' }}>Deposit</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setMode('withdraw')} style={({ pressed }) => ({ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, borderWidth: 1, backgroundColor: mode==='withdraw' ? (get('semantic.danger') as string) : (pressed ? (get('surface.level2') as string) : (get('surface.level1') as string)), borderColor: get('component.button.secondary.border') as string })}>
              <Text style={{ color: mode==='withdraw' ? (get('text.onPrimary') as string) : text, fontWeight:'700' }}>Withdraw</Text>
            </Pressable>
          </View>
          <View>
            <Text style={{ color: muted, marginBottom: spacing.s4 }}>Amount ({currency})</Text>
            <TextInput keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={muted} style={{ color: text, backgroundColor: get('surface.level2') as string, borderColor: get('border.subtle') as string, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.s12, height: 44 }} />
          </View>
          <Pressable accessibilityRole="button" onPress={onSave} style={{ marginTop: spacing.s8, backgroundColor: get('component.button.primary.bg') as string, height: 44, borderRadius: radius.lg, alignItems:'center', justifyContent:'center' }}>
            <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Save</Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

