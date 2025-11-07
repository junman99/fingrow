import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useInvestStore } from '../features/invest';
import { baseCryptoSymbol } from '../lib/coingecko';
import { useNavigation, useRoute } from '@react-navigation/native';

type Item = { symbol: string; provider: string };

export default function Search() {
  const route = useRoute<any>();
  const intent = (route.params?.intent ?? 'watchlist') as 'watchlist' | 'holding';
  const fromPortfolioId = route.params?.portfolioId as (string | undefined);
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { addWatch } = useInvestStore();
  const [q, setQ] = useState('');

  const results: Item[] = useMemo(() => {
    const sym = q.trim().toUpperCase();
    if (!sym) return [];
    const out: Item[] = [];
    // Check if it's a crypto symbol
    const base = baseCryptoSymbol(sym);
    if (base) {
      out.push({ symbol: sym, provider: 'COINGECKO' });
    } else {
      // Default to Yahoo Finance for stocks/ETFs
      out.push({ symbol: sym, provider: 'YAHOO' });
    }
    return out;
  }, [q]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg = get('surface.level1') as string;
  const accent = get('accent.primary') as string;

  const onAdd = async (sym: string) => {
  if (intent === 'holding') {
    nav.navigate('AddLot' as never, { symbol: sym, portfolioId: fromPortfolioId } as never);
  } else {
    await addWatch(sym, { portfolioId: fromPortfolioId });
    nav.goBack();
  }
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
          <Text style={{ color: muted }}>{`Type a US symbol to add to your ${intent === 'holding' ? 'holdings' : 'watchlist'}.`}</Text>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(it) => it.symbol}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" onPress={() => onAdd(item.symbol)} style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s12, marginBottom: spacing.s8 }}>
                <Text style={{ color: text, fontWeight:'700' }}>{item.symbol}</Text>
                <Text style={{ color: muted }}>{item.provider}</Text>
                <View style={{ marginTop: spacing.s8, alignSelf:'flex-start', backgroundColor: accent, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
                  <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>{intent === 'holding' ? 'Add to holdings' : 'Add to watchlist'}</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}