/**
 * TickerLogo Component
 * Displays company logo from Logo.dev with fallback to ticker initial
 */

import React, { useEffect, useState } from 'react';
import { View, Image, Text } from 'react-native';
import { getTickerLogoUrl } from '../lib/tickerLogo';
import { useThemeTokens } from '../theme/ThemeProvider';

type Props = {
  ticker: string;
  size?: number;
  fallbackColor?: string;
};

function withAlpha(hex: string, alpha: number) {
  if (!hex || typeof hex !== 'string') return hex;
  if (hex.startsWith('#')) {
    const clean = hex.slice(1, 7);
    const padded = clean.length === 6 ? clean : clean.padEnd(6, '0');
    const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
    return `#${padded}${a}`;
  }
  return hex;
}

export const TickerLogo: React.FC<Props> = ({ ticker, size = 40, fallbackColor }) => {
  const { get, isDark } = useThemeTokens();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const accentPrimary = (fallbackColor || get('accent.primary')) as string;

  useEffect(() => {
    let mounted = true;

    console.log(`🖼️ [TickerLogo] Fetching logo for ${ticker}...`);
    setLoading(true);
    setError(false);

    getTickerLogoUrl(ticker)
      .then(url => {
        if (mounted) {
          console.log(`🖼️ [TickerLogo] Got URL for ${ticker}:`, url);
          setLogoUrl(url);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error(`🖼️ [TickerLogo] Error for ${ticker}:`, err);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [ticker]);

  // Fallback: Show first letter of ticker
  const renderFallback = () => {
    const initial = ticker ? ticker[0].toUpperCase() : '?';
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: withAlpha(accentPrimary, 0.3),
        }}
      >
        <Text
          style={{
            color: accentPrimary,
            fontWeight: '800',
            fontSize: size * 0.4,
          }}
        >
          {initial}
        </Text>
      </View>
    );
  };

  // Show logo if available
  if (!loading && logoUrl && !error) {
    // Use a subtle gray background that works with both light and dark logos
    const logoBg = isDark ? '#2A2A2A' : '#F5F5F5';

    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2, // Fully circular
          overflow: 'hidden',
          backgroundColor: logoBg, // Subtle gray background
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={{ uri: logoUrl }}
          style={{
            width: size * 0.7, // 70% of container for more padding
            height: size * 0.7,
          }}
          onError={() => setError(true)}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Fallback
  return renderFallback();
};
