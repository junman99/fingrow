import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useInvestStore } from '../store/invest';
import { toStooqSymbol } from '../lib/stooq';
import { baseCryptoSymbol } from '../lib/coingecko';
import { useNavigation } from '@react-navigation/native';

type Item = { symbol: string; provider: string };

export default function Search() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { addWatch, watchlist } = useInvestStore();
  const [q, setQ] = useState('');

  const results: Item[] = useMemo(() => {
    const sym = q.trim().toUpperCase();
    if (!sym) return [];
    // For MVP, we just map to .US provider symbol
    const st = toStooqSymbol(sym);
    const out: Item[] = [];
    if (st) out.push({ symbol: sym, provider: st.toUpperCase() });
    const base = baseCryptoSymbol(sym);
    if (base) out.push({ symbol: sym, provider: 'COINGECKO' });
    return out;
  }, [q]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg = get('surface.level1') as string;
  const accent = get('accent.primary') as string;

  const onAdd = async (sym: string) => {
    await addWatch(sym);
    nav.goBack();
  };

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: text, fontWeight:'700', fontSize: 18 }}>Search</Text>
        <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s12 }}>
          <TextInput
            placeholder="Enter symbol (e.g., AAPL, TSLA, SPY)"
            placeholderTextColor={muted}
            autoCapitalize="characters"
            autoCorrect={false}
            value={q}
            onChangeText={setQ}
            style={{ color: text, paddingVertical: spacing.s8 }}
          />
        </View>

        {results.length === 0 ? (
          <Text style={{ color: muted }}>Type a US symbol to add to your watchlist.</Text>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(it) => it.symbol}
            renderItem={({ item }) => (
              <Pressable onPress={() => onAdd(item.symbol)} style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s12, marginBottom: spacing.s8 }}>
                <Text style={{ color: text, fontWeight:'700' }}>{item.symbol}</Text>
                <Text style={{ color: muted }}>{item.provider}</Text>
                <View style={{ marginTop: spacing.s8, alignSelf:'flex-start', backgroundColor: accent, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
                  <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Add to watchlist</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}