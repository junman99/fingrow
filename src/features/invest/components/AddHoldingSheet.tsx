import React from 'react';
import { View, Text, TextInput, FlatList, Pressable, Dimensions, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import BottomSheet from '../../../components/BottomSheet';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import Icon from '../../../components/Icon';
import { toYahooSymbol } from '../../../lib/yahoo';
import { baseCryptoSymbol, fetchCryptoOhlc } from '../../../lib/coingecko';
import { fetchDailyHistoryYahoo } from '../../../lib/yahoo';
import { useInvestStore } from '../store';
import { useProfileStore } from '../../../store/profile';

type Item = { key: string; symbol: string; provider: 'Yahoo'|'CoinGecko' };

type Props = {
  visible: boolean;
  onClose: () => void;
  portfolioId: string | null;
  mode?: 'holdings' | 'watchlist';
};

/** AddHoldingSheet — bottom sheet picker that stays open for multi-add flow.
 *  - Search bar + Done button at the top
 *  - Results show provider-normalized symbol and latest price (best-effort)
 *  - Select tickers; press Done to register them as empty holdings
 */
export default function AddHoldingSheet({ visible, onClose, portfolioId, mode='holdings' }: Props) {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const windowH = Dimensions.get('window').height;
  // Show at about half screen height (min 360)
  const sheetHeight = Math.max(360, Math.round(windowH * 0.5));

  const [q, setQ] = React.useState('');
  const [items, setItems] = React.useState<Item[]>([]);
  const [prices, setPrices] = React.useState<Record<string, number | null>>({});
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  // derive selected chips (persist across queries)
  const selectedKeys = React.useMemo(() => Object.keys(selected).filter(k => selected[k]), [selected]);
  const selectedChips = React.useMemo(() => {
    return selectedKeys.map((k) => {
      const [code, ...rest] = k.split(':');
      const sym = rest.join(':');
      const provider = code === 'C' ? 'CoinGecko' : 'Yahoo';
      return { key: k, sym, provider };
    });
  }, [selectedKeys]);

  React.useEffect(() => {
    if (!visible) { setQ(''); setItems([]); setPrices({}); setSelected({}); }
  }, [visible]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const surface = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const chip = get('component.button.secondary.bg') as string;

  // Build candidate items from raw query — minimal, provider-aware
  React.useEffect(() => {
    const raw = (q || '').trim();
    if (!raw) { setItems([]); return; }
    const outMap: Record<string, Item> = {};
    // direct symbol transforms
    const c = baseCryptoSymbol(raw);
    if (c) {
      outMap[`C:${c}`] = { key: `C:${c}`, symbol: c, provider: 'CoinGecko' };
    } else {
      const y = toYahooSymbol(raw);
      if (y) outMap[`Y:${y}`] = { key: `Y:${y}`, symbol: y, provider: 'Yahoo' };
    }

    // local suggestions by name/symbol prefix (offline-friendly)
    const SUGGEST: Array<{ symbol: string; name: string }> = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'META', name: 'Meta Platforms, Inc.' },
      { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
      { symbol: 'GOOG', name: 'Alphabet Inc. (Class C)' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' },
      { symbol: 'TSLA', name: 'Tesla, Inc.' },
      { symbol: 'V', name: 'Visa Inc.' },
      { symbol: 'MA', name: 'Mastercard Incorporated' },
      { symbol: 'MU', name: 'Micron Technology, Inc.' },
      { symbol: 'CELH', name: 'Celsius Holdings, Inc.' },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
      { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
      { symbol: 'BTC-USD', name: 'Bitcoin (USD)' },
      { symbol: 'ETH-USD', name: 'Ethereum (USD)' },
    ];
    try {
      const u = raw.toUpperCase();
      const lc = raw.toLowerCase();
      const suggests = SUGGEST.filter(ent => ent.symbol.startsWith(u) || ent.name.toLowerCase().includes(lc)).slice(0, 12);
      suggests.forEach(ent => {
        const k = `Y:${ent.symbol}`;
        if (!outMap[k]) outMap[k] = { key: k, symbol: ent.symbol, provider: 'Yahoo' };
      });
    } catch {}

    setItems(Object.values(outMap));
  }, [q]);

  // Fetch prices best-effort
  React.useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      const out: Record<string, number|null> = {};
      for (const it of items) {
        try {
          if (it.provider === 'CoinGecko') {
            const bars = await fetchCryptoOhlc(it.symbol, 1);
            out[it.key] = bars && bars.length ? (bars[bars.length - 1].c ?? null) : null;
          } else {
            // Yahoo Finance
            const bars = await fetchDailyHistoryYahoo(it.symbol, '1y');
            out[it.key] = bars && bars.length ? (bars[bars.length - 1].close ?? null) : null;
          }
        } catch (e) {
          out[it.key] = null;
        }
      }
      if (alive) { setPrices(out); setLoading(false); }
    };
    if (items.length) run(); else setPrices({});
    return () => { alive = false; };
  }, [JSON.stringify(items)]);

  const onPick = (sym: string, key: string) => { setSelected(prev => ({ ...prev, [key]: !prev[key] })); };

  const profile = useProfileStore(s => s.profile);

  const onDone = async () => {
    try { Keyboard.dismiss(); } catch {}
    const keys = Object.keys(selected).filter(k => selected[k]);
    let pid = portfolioId || (useInvestStore.getState().activePortfolioId as any);
    if (!pid) {
      const portfolios = (useInvestStore.getState().portfolios || {}) as any;
      const ids = Object.keys(portfolios);
      if (ids.length) pid = ids[0];
    }
    console.log('🔵 [AddHoldingSheet] onDone called:', { pid, keysCount: keys.length, mode, portfolioId });
    if (!pid || !keys.length) {
      console.log('⚠️ [AddHoldingSheet] Missing pid or no keys selected. Closing.');
      onClose();
      return;
    }
    if (mode === 'watchlist') {
      const addWatch = (useInvestStore.getState() as any).addWatch;
      for (const k of keys) {
        const sym = k.split(':').slice(1).join(':');
        try {
          console.log('➕ [AddHoldingSheet] Adding watch:', sym, 'to portfolio:', pid);
          await addWatch(sym, { portfolioId: pid });
        } catch (err) {
          console.error('❌ [AddHoldingSheet] Failed to add watch:', sym, err);
        }
      }
    } else {
      const addHolding = (useInvestStore.getState() as any).addHolding;
      const addedSymbols: string[] = [];
      for (const k of keys) {
        const providerCode = k.split(':')[0];
        const sym = k.split(':').slice(1).join(':');
        const type = providerCode === 'C' ? 'crypto' : 'stock';

        // Detect ticker's NATIVE currency from symbol pattern
        let tickerCurrency = 'USD'; // Default
        const s = sym.toUpperCase();
        if (s.includes('-USD') || s.includes('USD')) tickerCurrency = 'USD';
        else if (s.endsWith('.L')) tickerCurrency = 'GBP';
        else if (s.endsWith('.T')) tickerCurrency = 'JPY';
        else if (s.endsWith('.TO')) tickerCurrency = 'CAD';
        else if (s.endsWith('.AX')) tickerCurrency = 'AUD';
        else if (s.endsWith('.HK')) tickerCurrency = 'HKD';
        else if (s.endsWith('.PA') || s.endsWith('.DE')) tickerCurrency = 'EUR';
        else if (s.endsWith('.SW')) tickerCurrency = 'CHF';

        try {
          console.log('➕ [AddHoldingSheet] Adding holding:', sym, 'type:', type, 'currency:', tickerCurrency, 'to portfolio:', pid);
          await addHolding(sym, { name: sym, type, currency: tickerCurrency }, { portfolioId: pid });
          console.log('✅ [AddHoldingSheet] Successfully added holding:', sym);
          addedSymbols.push(sym);
        } catch (err) {
          console.error('❌ [AddHoldingSheet] Failed to add holding:', sym, err);
        }
      }
      // If only one holding was added, navigate to AddLot screen to add a transaction
      if (addedSymbols.length === 1) {
        console.log('🔄 [AddHoldingSheet] Navigating to AddLot for:', addedSymbols[0]);
        onClose();
        // Small delay to ensure sheet closes smoothly before navigation
        setTimeout(() => {
          nav.navigate('AddLot' as never, { symbol: addedSymbols[0], portfolioId: pid } as never);
        }, 100);
        return;
      }
    }
    console.log('✅ [AddHoldingSheet] Finished adding holdings. Closing sheet.');
    onClose();
  };




  // Ensure high-contrast primary button colors in dark mode
  const primary = (get('component.button.primary.bg') as string) || (get('accent.primary') as string);
  const onPrimary = (get('component.button.primary.text') as string) || '#FFFFFF';
  const secondaryBg = get('component.button.secondary.bg') as string;
  const secondaryBorder = get('component.button.secondary.border') as string;
  const primaryBorder = primary;

  const doneLabel = mode === 'watchlist' ? 'Add to Watchlist' : 'Add Holdings';
  const footerH = 64;

  return (
    <BottomSheet visible={visible} onClose={onClose} height={sheetHeight}>
      <View style={{ gap: spacing.s12 }}>
        {/* Selected chips */}
        <View>
          {selectedChips.length ? (
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap: spacing.s8 }}>
              {selectedChips.map(ch => (
                <View key={ch.key} style={{ flexDirection:'row', alignItems:'center', gap: 8, paddingHorizontal: spacing.s12, paddingVertical: spacing.s6, borderRadius: 999, backgroundColor: secondaryBg, borderWidth: 1, borderColor: secondaryBorder }}>
                  <Text style={{ color: text, fontWeight:'700' }}>{ch.sym}</Text>
                  <Pressable accessibilityRole="button" onPress={() => setSelected(prev => ({ ...prev, [ch.key]: false }))} hitSlop={8}>
                    <Text style={{ color: muted, fontWeight:'800' }}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
          <View style={{ flex: 1, backgroundColor: surface, borderRadius: radius.lg, paddingHorizontal: spacing.s12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, borderWidth: 1, borderColor: border }}>
            <TextInput
              blurOnSubmit={false}
              value={q}
              onChangeText={setQ}
              placeholder="Search or type ticker (AAPL, TSLA, BTC...)"
              placeholderTextColor={muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ color: text, fontSize: 16 }}
            />
          </View>
        </View>

        {/* Results */}
        {(!q || !items.length) ? (
          <Text style={{ color: muted }}>Type a symbol to add. Examples: AAPL, MSFT, SPY, BTC, ETH.</Text>
        ) : (
          <FlatList keyboardDismissMode="on-drag" keyboardShouldPersistTaps="always"
            data={items}
            keyExtractor={(it) => it.key}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: border }} />}
            renderItem={({ item }) => {
              const k = item.key;
              const price = prices[k];
              return (
                <Pressable onPress={() => onPick(item.symbol, item.key)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, paddingHorizontal: spacing.s4 })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.s8, gap: spacing.s12 }}>
                    {/* Tick button (left) */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.symbol}`}
                      onPress={() => onPick(item.symbol, item.key)}
                      style={({ pressed }) => ({
                        width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: selected[item.key] ? (get('component.button.primary.bg') as string) : (pressed ? (get('surface.level2') as string) : chip),
                        borderWidth: 1, borderColor: get('component.button.secondary.border') as string,
                      })}
                    >
                      <Icon name="check" size={18} colorToken={selected[item.key] ? 'text.onPrimary' : 'text.primary'} />
                    </Pressable>

                    {/* Symbol + provider */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>{item.symbol}</Text>
                      <Text style={{ color: muted, fontSize: 12 }}>{item.provider}</Text>
                    </View>

                    {/* Price (right) */}
                    <View style={{ minWidth: 90, alignItems: 'flex-end' }}>
                      <Text style={{ color: text, fontWeight: '700' }}>
                        {price == null ? (loading ? '...' : '—') : `${price.toFixed(2)}`}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
            contentContainerStyle={{ paddingBottom: footerH + spacing.s12 }}
          />
        )}
      </View>

      {/* Sticky footer action – floating pill (no card) */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.s12, paddingTop: spacing.s8, paddingBottom: Math.max(insets.bottom, spacing.s12), backgroundColor: 'transparent' }}>
        <View style={{ alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={onDone} disabled={!selectedChips.length}
            style={({ pressed }) => {
              const enabled = selectedChips.length > 0;
              return {
                paddingHorizontal: spacing.s16,
                height: 48,
                minWidth: 200,
                borderRadius: 999,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: enabled ? (primary || '#3B82F6') : secondaryBg,
                borderWidth: 1,
                borderColor: enabled ? (primaryBorder as string) : secondaryBorder,
                opacity: pressed ? 0.94 : 1,
              } as any;
            }}
          >
            <Text style={{ color: selectedChips.length ? (onPrimary as string) : (text as string), fontWeight: '800' }}>
              {doneLabel}{selectedChips.length ? ` (${selectedChips.length})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}
