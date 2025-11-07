import React from 'react';
import { Text, View, Platform } from 'react-native';
import { radius, spacing } from '../../theme/tokens';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { type Portfolio } from '../store';

/**
 * PortfolioAvatar
 * - Shows up to 3 overlapped circular badges representing the dominant instrument "origins"
 *   (e.g., 🇺🇸 for US equities, ₿ for crypto, 🇭🇰 for HK, 🇸🇬 for SG, etc.).
 * - We derive categories by scanning holdings symbols and grouping into: 'crypto', ISO-region.
 * - Order by weight (largest first). If mix of US + crypto, you'll see 🇺🇸 overlapped with ₿.
 */
export default function PortfolioAvatar({ portfolio, quotes }: { portfolio: Portfolio; quotes: any }) {
  const { get } = useThemeTokens();
  const codes = computeTopOrigins(portfolio, quotes);
  const size = 28;
  const overlap = 10;

  return (
    <View accessibilityRole="image" accessibilityLabel={`Portfolio origins: ${codes.join(', ')}`}
      style={{ width: size + (codes.length-1)* (size - overlap), height: size, flexDirection:'row', alignItems:'center' }}>
      {codes.map((code, i) => (
        <View key={i} style={{
          width: size, height: size, borderRadius: radius.pill,
          backgroundColor: get('surface.level2') as string,
          alignItems:'center', justifyContent:'center',
          marginLeft: i===0 ? 0 : -overlap,
          borderWidth: 1, borderColor: get('border.subtle') as string,
          overflow: 'hidden'
        }}>
          <Text
            style={{
              fontSize: Math.round(size * 0.64),
              fontWeight:'700',
              color: get('text.onSurface') as string,
              textAlign: 'center',
              // Better vertical centering for emoji on Android
              textAlignVertical: 'center' as any,
              includeFontPadding: false as any,
              marginTop: Platform.OS === 'android' ? -1 : 0,
              // Nudge slightly to the right for perfect optical centering
              transform: [{ translateX: 1 }],
            }}
          >
            {renderBadge(code)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Compute top 1-3 "origins" based on weighted holdings
function computeTopOrigins(p: Portfolio, quotes: any): string[] {
  const weights: Record<string, number> = {}; // key -> weight sum
  const holdings = p.holdings || {};
  const symbols = Object.keys(holdings);
  if (symbols.length === 0) return ['–'];

  for (const sym of symbols) {
    const lots = holdings[sym]?.lots || [];
    const qty = lots.reduce((s, l) => s + (l.side==='buy'? l.qty : -l.qty), 0);
    if (!qty) continue;
    const px = quotes[sym]?.last ?? 0;
    const w = Math.max(0, px * qty);
    const origin = classifySymbol(sym);
    weights[origin] = (weights[origin] || 0) + w;
  }
  const total = Object.values(weights).reduce((a,b)=>a+b,0) || 1;
  const pairs = Object.entries(weights).map(([k,v])=> [k, v/total] as const).sort((a,b)=> b[1]-a[1]);
  return pairs.slice(0,3).map(([k])=>k);
}

// Classify symbol into origin: 'CRYPTO', 'US', 'HK', 'SG', ...
function classifySymbol(sym: string): string {
  const S = sym.toUpperCase();
  // Crypto: ends with -USD or contains -USDT / -BTC etc.
  if (/-U(SD|SDT|SDC)$/.test(S) || S === 'BTC' || S.startsWith('BTC') || S.includes('BTC-')) return 'CRYPTO';
  // Common Yahoo suffixes for regions
  const map: Array<[RegExp, string]> = [
    [/\.HK$/, 'HK'], [/\.SI$/, 'SG'], [/\.L$/, 'GB'], [/\.TO$/, 'CA'], [/\.NS$/, 'IN'],
    [/\.AX$/, 'AU'], [/\.T$/, 'JP'], [/\.SS$/, 'CN'], [/\.SZ$/, 'CN'], [/\.PA$/, 'FR'],
    [/\.DE$/, 'DE'], [/\.MI$/, 'IT'], [/\.SW$/, 'CH'], [/\.AS$/, 'NL'], [/\.KS$/, 'KR'],
  ];
  for (const [rx, code] of map) if (rx.test(S)) return code;
  // Default equities w/o suffix -> US
  return 'US';
}

function renderBadge(code: string): string {
  switch (code) {
    case 'CRYPTO': return '₿';
    case 'US': return '🇺🇸';
    case 'HK': return '🇭🇰';
    case 'SG': return '🇸🇬';
    case 'GB': return '🇬🇧';
    case 'CA': return '🇨🇦';
    case 'IN': return '🇮🇳';
    case 'AU': return '🇦🇺';
    case 'JP': return '🇯🇵';
    case 'CN': return '🇨🇳';
    case 'FR': return '🇫🇷';
    case 'DE': return '🇩🇪';
    case 'IT': return '🇮🇹';
    case 'CH': return '🇨🇭';
    case 'NL': return '🇳🇱';
    case 'KR': return '🇰🇷';
    default: return '🌐';
  }
}
