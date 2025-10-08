
import React from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import CenterModal from '../CenterModal';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { toStooqSymbol } from '../../lib/stooq';
import { baseCryptoSymbol } from '../../lib/coingecko';
import { useNavigation } from '@react-navigation/native';

type Item = { symbol: string; provider: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  portfolioId: string | null;
};

export default function AddHoldingModal({ visible, onClose, portfolioId }: Props) {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    if (!visible) setQ('');
  }, [visible]);

  const items = React.useMemo(() => {
    const sym = (q || '').trim().toUpperCase();
    if (!sym) return [] as Item[];
    const st = toStooqSymbol(sym);
    const out: Item[] = [];
    if (st) out.push({ symbol: sym, provider: st.toUpperCase() });
    const base = baseCryptoSymbol(sym);
    if (base) out.push({ symbol: sym, provider: 'COINGECKO' });
    return out;
  }, [q]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const inputBg = get('surface.level2') as string;
  const ctaBg = get('component.button.primary.bg') as string;
  const ctaText = get('text.onPrimary') as string;

  const onPick = (sym: string) => {
    // Navigate to AddLot like the Search screen does
    nav.navigate('AddLot' as never, { symbol: sym, portfolioId } as never);
    onClose?.();
  };

  return (
    <CenterModal visible={visible} onClose={onClose} maxWidth={420}>
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>Add holding</Text>
        <View style={{ backgroundColor: inputBg, borderRadius: radius.lg, padding: spacing.s12 }}>
          <TextInput
            placeholder="Enter symbol (e.g., AAPL, TSLA, SPY)"
            placeholderTextColor={muted}
            value={q}
            onChangeText={setQ}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType="default"
            style={{ color: text, fontSize: 16 }}
            returnKeyType="search"
            onSubmitEditing={() => { const sym = (q||'').trim().toUpperCase(); if (sym) onPick(sym); }}
          />
        </View>

        {q.length > 0 && (
          <FlatList
            data={items}
            keyExtractor={(it) => it.provider + ':' + it.symbol}
            style={{ maxHeight: 360 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable onPress={() => onPick(item.symbol)}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, padding: spacing.s12, borderRadius: radius.lg })}
                accessibilityRole="button"
                accessibilityLabel={"Add " + item.symbol + " to holdings"}
              >
                <Text style={{ color: text, fontWeight: '700' }}>{item.symbol}</Text>
                <Text style={{ color: muted, marginTop: spacing.s4 }}>{item.provider}</Text>
                <View style={{ marginTop: spacing.s8, alignSelf: 'flex-start', paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: ctaBg }}>
                  <Text style={{ color: ctaText, fontWeight: '700' }}>Add to holdings</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </CenterModal>
  );
}
