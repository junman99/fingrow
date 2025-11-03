
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, View, Text, Image, InteractionManager } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import SparklineMini from './SparklineMini';
import { useInvestStore } from '../../store/invest';
import { useProfileStore } from '../../store/profile';
import { formatCurrency, formatPercent } from '../../lib/format';
import { convertCurrency } from '../../lib/fx';

function getLogoColor(symbol: string): string {
  // Generate consistent color based on symbol
  const colors = [
    '#5B9A8B', '#D4735E', '#88AB8E', '#C85C3D', '#E8B86D',
    '#7FE7CC', '#FF9B71', '#A4BE7B', '#6366f1', '#8b5cf6',
  ];
  const index = symbol.charCodeAt(0) % colors.length;
  return colors[index];
}

const HoldingRow = React.memo(({ sym, onPress, portfolioId, variant = 'card' }: { sym: string; onPress?: () => void; portfolioId?: string; variant?: 'card' | 'list' }) => {
  const { get } = useThemeTokens();
  const holdings = useInvestStore(s => s.holdings);
  const quotes = useInvestStore(s => s.quotes);
  const portfolios = useInvestStore(s => s.portfolios);
  const fxRates = useInvestStore(s => s.fxRates);
  const { profile } = useProfileStore();
  const nav = useNavigation<any>();
  const [imageError, setImageError] = React.useState(false);

  const handlePress = React.useCallback(() => {
    const isCashRow = sym === 'CASH';
    const targetScreen = isCashRow ? 'CashManagement' : 'AddLot';
    const params = isCashRow ? { portfolioId } : { symbol: sym, portfolioId };

    if (typeof onPress === 'function') {
      onPress();
      // Give sheet a moment to start closing before navigating
      requestAnimationFrame(() => {
        setTimeout(() => {
          try { nav.navigate(targetScreen, params); } catch (e) {}
        }, 50);
      });
      return;
    }
    // Defer navigation to after interactions complete
    InteractionManager.runAfterInteractions(() => {
      try { nav.navigate(targetScreen, params); } catch (e) {}
    });
  }, [onPress, nav, sym, portfolioId]);


  const isCash = sym === 'CASH';
  const p = portfolioId ? portfolios[portfolioId] : useInvestStore.getState().activePortfolio();

  // Use portfolio currency (not investment currency!)
  const portfolioCurrency = (p?.baseCurrency || 'USD').toUpperCase();
  const cur = portfolioCurrency;

  const h = isCash ? null : (portfolioId ? (portfolios[portfolioId]?.holdings?.[sym]) : holdings[sym]);
  const q = isCash ? null : quotes[sym];
  const qty = isCash ? 0 : (h?.lots || []).reduce((acc, l) => acc + (l.side === 'buy' ? l.qty : -l.qty), 0);

  // Get the native currency of the ticker
  // Priority: 1) holding metadata, 2) infer from symbol, 3) default USD
  const tickerCurrency = React.useMemo(() => {
    if (isCash) return portfolioCurrency;
    if (h?.currency) return h.currency.toUpperCase();

    // Infer currency from symbol patterns
    const s = sym.toUpperCase();

    // Crypto symbols (BTC-USD, ETH-USD) - priced in USD
    if (s.includes('-USD') || s.includes('USD')) return 'USD';

    // Exchange-specific suffixes
    if (s.endsWith('.L')) return 'GBP';  // London Stock Exchange
    if (s.endsWith('.T')) return 'JPY';  // Tokyo Stock Exchange
    if (s.endsWith('.TO')) return 'CAD'; // Toronto Stock Exchange
    if (s.endsWith('.AX')) return 'AUD'; // Australian Stock Exchange
    if (s.endsWith('.HK')) return 'HKD'; // Hong Kong Stock Exchange
    if (s.endsWith('.PA')) return 'EUR'; // Paris (Euronext)
    if (s.endsWith('.DE')) return 'EUR'; // Deutsche Börse
    if (s.endsWith('.SW')) return 'CHF'; // Swiss Exchange

    // Default to USD for all others (US stocks, most ETFs)
    return 'USD';
  }, [sym, h?.currency, isCash, portfolioCurrency]);

  // Convert ticker price from native currency to portfolio currency
  const lastNative = isCash ? 1 : (q?.last ?? 0);
  const last = isCash ? 1 : convertCurrency(fxRates, lastNative, tickerCurrency, portfolioCurrency);
  const val = isCash ? Number(p?.cash || 0) : qty * last;

  const changePct = isCash ? 0 : (q?.changePct ?? 0);
  const changeNative = isCash ? 0 : (q?.change ?? 0);
  const change = isCash ? 0 : convertCurrency(fxRates, changeNative, tickerCurrency, portfolioCurrency);
  const changeAbs = isCash ? 0 : change * qty; // Today's change in absolute value
  const positive = changePct >= 0;

  // Calculate total gain/loss for this holding
  const { totalGainLoss, totalGainPct } = React.useMemo(() => {
    if (isCash || !h || !h.lots || h.lots.length === 0) return { totalGainLoss: 0, totalGainPct: 0 };
    let totalCost = 0;
    let currentQty = 0;
    for (const lot of h.lots) {
      // Lot prices are stored in the ticker's native currency, need to convert to portfolio currency
      const lotPriceConverted = convertCurrency(fxRates, lot.price, tickerCurrency, portfolioCurrency);
      if (lot.side === 'buy') {
        totalCost += lot.qty * lotPriceConverted;
        currentQty += lot.qty;
      } else {
        // For sell lots, reduce cost proportionally
        totalCost -= lot.qty * lotPriceConverted;
        currentQty -= lot.qty;
      }
    }
    const currentValue = currentQty * last;
    const gainLoss = currentValue - totalCost;
    const gainPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
    return { totalGainLoss: gainLoss, totalGainPct: gainPct };
  }, [isCash, h, last, fxRates, tickerCurrency, portfolioCurrency]);

  const totalGainPositive = totalGainPct >= 0;
  const companyName = q?.fundamentals?.companyName || sym;
  const logoUrl = q?.fundamentals?.logo;

  const bgBase = get('surface.level1') as string;
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const good = get('semantic.success') as string;
  const bad = get('semantic.danger') as string;
  const accent = get('accent.primary') as string;

  const tone = isCash ? accent : (positive ? good : bad);
  const cardBg = variant === 'card' ? withAlpha(tone, isCash ? 0.14 : 0.1) : variant === 'list' ? 'transparent' : bgBase;
  const cardBorder = variant === 'card' ? withAlpha(tone, 0.28) : variant === 'list' ? 'transparent' : border;

  const logoColor = getLogoColor(sym);
  const logoLetter = sym.charAt(0).toUpperCase();
  const shouldShowImage = logoUrl && !imageError && !isCash;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${sym}`}
      style={({ pressed }) => ({
        backgroundColor: variant==='card' ? cardBg : variant==='list' ? 'transparent' : bgBase,
        borderRadius: variant==='card' ? radius.lg : 0,
        borderWidth: variant==='card' ? 1 : 0,
        borderColor: variant==='card' ? cardBorder : 'transparent',
        padding: variant==='card' ? spacing.s16 : spacing.s12,
        paddingVertical: variant === 'list' ? spacing.s14 : (variant === 'card' ? spacing.s16 : spacing.s12),
        marginBottom: variant==='card' ? spacing.s8 : 0,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
        {/* Company Logo */}
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: shouldShowImage ? 'transparent' : (isCash ? accent : logoColor),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: shouldShowImage ? spacing.s8 : 0,
        }}>
          {shouldShowImage ? (
            <Image
              source={{ uri: logoUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
              {isCash ? '$' : logoLetter}
            </Text>
          )}
        </View>

        {/* Left: Ticker and Company Name */}
        <View style={{ flex: 1, gap: spacing.s2 }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 15 }}>{isCash ? 'Cash' : sym}</Text>
          {isCash ? (
            <Text style={{ color: muted, fontSize: 12 }}>{cur}</Text>
          ) : (
            <Text style={{ color: muted, fontSize: 12 }} numberOfLines={1}>{companyName}</Text>
          )}
        </View>

        {/* Right: Total Value and Changes */}
        <View style={{ alignItems: 'flex-end', gap: spacing.s2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
              {val.toFixed(2)}
            </Text>
            <Text style={{ color: muted, fontSize: 11, marginLeft: 3, fontWeight: '600' }}>
              {cur}
            </Text>
          </View>
          {isCash ? (
            (() => {
              // weight = cash / (sum holdings + cash)
              const holds = (p?.holdings || {}) as any;
              const syms = Object.keys(holds);
              const totalHold = syms.reduce((acc, s) => {
                const q = (useInvestStore.getState().quotes || {})[s]?.last || 0;
                const lots = (holds[s]?.lots || []) as any[];
                const qty = lots.reduce((a,l)=> a + (l.side==='buy'?l.qty:-l.qty), 0);
                return acc + (q * qty);
              }, 0);
              const total = totalHold + (Number(p?.cash || 0));
              const wt = total > 0 ? (val / total) : 0;
              return <Text style={{ color: muted, fontSize: 12 }}>Weight {(wt*100).toFixed(0)}%</Text>;
            })()
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
              <Text style={{ color: positive ? good : bad, fontWeight: '600', fontSize: 13 }}>
                {changePct >= 0 ? '+' : ''}{formatPercent(changePct)} Today
              </Text>
              <Text style={{ color: totalGainPositive ? good : bad, fontWeight: '600', fontSize: 13 }}>
                {totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}% Total
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

HoldingRow.displayName = 'HoldingRow';

export default HoldingRow;

function withAlpha(color: string, alpha: number): string {
  if (!color) return color;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw.padEnd(6, '0');
    const num = parseInt(hex.slice(0, 6), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const match = color.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([0-9.]+))?\)/i);
  if (match) {
    const [, r, g, b] = match;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
