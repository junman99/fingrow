import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import CenterModal from '../../../components/CenterModal';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import { useInvestStore } from '../store';

type Props = {
  visible: boolean;
  onClose: () => void;
  portfolioId: string | null;
};

export default function EditPortfolioModal({ visible, onClose, portfolioId }: Props) {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const primary = get('component.button.primary.bg') as string;
  const onPrimary = get('component.button.primary.text') as string;
  const disabledBg = get('component.button.disabled.bg') as string;
  const disabledText = get('component.button.disabled.text') as string;

  const portfolios = useInvestStore(s => s.portfolios);
  const renamePortfolio = useInvestStore(s => s.renamePortfolio);

  const p = useMemo(() => (portfolioId ? (portfolios as any)[portfolioId] : null), [portfolioId, portfolios]);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [benchmark, setBenchmark] = useState('None');

  useEffect(() => {
    if (p && visible) {
      setName(p.name || '');
      setCurrency((p.baseCurrency || 'USD').toUpperCase());
      setBenchmark((p.benchmark || 'None'));
    }
  }, [p?.id, visible]);

  const canSave = !!portfolioId && name.trim().length > 0;

  const onSave = async () => {
    if (!canSave) return;
    try {
      await renamePortfolio(portfolioId!, name.trim());
      // Write baseCurrency/benchmark directly for now
      const s: any = (useInvestStore as any).getState();
      const map = { ...(s.portfolios || {}) };
      const prev = map[portfolioId!];
      map[portfolioId!] = { ...prev, baseCurrency: (currency||'USD').toUpperCase(), benchmark: benchmark === 'None' ? undefined : benchmark, updatedAt: new Date().toISOString() };
      (useInvestStore as any).setState({ portfolios: map });
      if (typeof s.persist === 'function') await s.persist();
      onClose();
    } catch (e) {
      Alert.alert('Could not save', String(e));
    }
  };

  return (
    <CenterModal visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s12 }}>
        <Text style={{ color: text, marginTop: spacing.s8, marginBottom: spacing.s6, fontWeight: '700' }}>Edit portfolio</Text>

        <Text style={{ color: text, marginTop: spacing.s8, marginBottom: spacing.s6, fontWeight: '600' }}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Portfolio name"
          placeholderTextColor={muted}
          style={{ color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, paddingHorizontal: spacing.s12, paddingVertical: spacing.s10 }}
        />

        <Text style={{ color: text, marginTop: spacing.s16, marginBottom: spacing.s6, fontWeight: '600' }}>Base currency</Text>
        <TextInput
          value={currency}
          onChangeText={(v)=> setCurrency((v || '').toUpperCase().replace(/[^A-Z]/g,'').slice(0,3))}
          placeholder="USD, SGD, EUR"
          placeholderTextColor={muted}
          style={{ color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, paddingHorizontal: spacing.s12, paddingVertical: spacing.s10 }}
          autoCapitalize="characters"
        />

        <Text style={{ color: text, marginTop: spacing.s16, marginBottom: spacing.s6, fontWeight: '600' }}>Benchmark</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap: spacing.s8, marginTop: spacing.s8 }}>
          {['None','SPY','QQQ','BTC'].map((b) => (
            <Pressable key={b} onPress={() => setBenchmark(b)} style={{ borderWidth:1, borderColor: border, borderRadius: 999, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
              <Text style={{ color: text }}>{b}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: spacing.s16 }} />

        <Pressable
          onPress={onSave}
          disabled={!canSave}
          accessibilityRole="button"
          style={{ backgroundColor: canSave ? primary : disabledBg, paddingVertical: spacing.s12, borderRadius: 999, alignItems: 'center' }}
        >
          <Text style={{ color: canSave ? onPrimary : disabledText, fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>
    </CenterModal>
  );
}