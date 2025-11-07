
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, View, Text, Image } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore } from '../store';
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

export default function WatchRow({ sym, onPress, portfolioCurrency }: { sym: string; onPress?: () => void; portfolioCurrency?: string }) {
  const { get } = useThemeTokens();
  const { quotes, fxRates, holdings } = useInvestStore();
  const { profile } = useProfileStore();
  const nav = useNavigation<any>();
  const [imageError, setImageError] = React.useState(false);

  const handlePress = React.useCallback(() => {
    if (typeof onPress === 'function') {
      onPress();
      // Give sheet a moment to start closing before navigating
      requestAnimationFrame(() => {
        setTimeout(() => {
          try { nav.navigate('AddLot', { symbol: sym }); } catch (e) {}
        }, 50);
      });
      return;
    }
    try { nav.navigate('AddLot', { symbol: sym }); } catch (e) {}
  }, [onPress, nav, sym]);

  const q = quotes[sym];
  const h = holdings[sym];

  // Get the native currency of the ticker
  // Priority: 1) holding metadata, 2) infer from symbol, 3) default USD
  const tickerCurrency = React.useMemo(() => {
    if (h?.currency) return h.currency.toUpperCase();

    // Infer currency from symbol patterns
    // Most Yahoo Finance tickers are USD by default
    // Crypto is typically priced in USD (BTC-USD, ETH-USD)
    // UK stocks end in .L (London, GBP), Japanese stocks end in .T (Tokyo, JPY), etc.
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
  }, [sym, h?.currency]);

  // Get display currency - use portfolioCurrency if provided, otherwise fall back to investment currency
  const displayCurrency = portfolioCurrency
    ? portfolioCurrency.toUpperCase()
    : (profile.investCurrency || profile.currency || 'USD').toUpperCase();

  // Prices from Yahoo/FMP are in the ticker's native currency
  const lastNative = q?.last ?? 0;
  const changeNative = q?.change ?? 0;

  // Convert to display currency (portfolio currency if provided, otherwise investment currency)
  const last = convertCurrency(fxRates, lastNative, tickerCurrency, displayCurrency);
  const change = convertCurrency(fxRates, changeNative, tickerCurrency, displayCurrency);
  const changePct = q?.changePct ?? 0;
  const positive = changePct >= 0;
  const companyName = q?.fundamentals?.companyName || sym;
  const logoUrl = q?.fundamentals?.logo;

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const good = get('semantic.success') as string;
  const bad = get('semantic.danger') as string;
  const cur = displayCurrency;

  const logoColor = getLogoColor(sym);
  const logoLetter = sym.charAt(0).toUpperCase();
  const shouldShowImage = logoUrl && !imageError;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => ({
        backgroundColor: 'transparent',
        padding: spacing.s12,
        paddingVertical: spacing.s14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
        {/* Company Logo */}
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: shouldShowImage ? 'transparent' : logoColor,
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
              {logoLetter}
            </Text>
          )}
        </View>

        {/* Left: Ticker and Company Name */}
        <View style={{ flex: 1, gap: spacing.s2 }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 15 }}>{sym}</Text>
          <Text style={{ color: muted, fontSize: 12 }} numberOfLines={1}>{companyName}</Text>
        </View>

        {/* Right: Price and Change */}
        <View style={{ alignItems: 'flex-end', gap: spacing.s2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
              {formatCurrency(last, cur).replace(/[^\d,.-]/g, '')}
            </Text>
            <Text style={{ color: muted, fontSize: 11, marginLeft: 3, fontWeight: '600' }}>
              {cur}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4 }}>
            <Text style={{ color: positive ? good : bad, fontWeight: '600', fontSize: 13 }}>
              {change >= 0 ? '+' : ''}{formatCurrency(Math.abs(change), cur, { compact: true })}
            </Text>
            <Text style={{ color: positive ? good : bad, fontWeight: '600', fontSize: 13 }}>
              {formatPercent(changePct)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
