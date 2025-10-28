
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, View, Text } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import SparklineMini from './SparklineMini';
import { useInvestStore } from '../../store/invest';
import { formatCurrency, formatPercent } from '../../lib/format';

export default function WatchRow({ sym, onPress }: { sym: string; onPress?: () => void }) {
  const { get } = useThemeTokens();
  const { quotes } = useInvestStore();
  const nav = useNavigation<any>();
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
  const _line = (q?.line || []);
  const line7 = Array.isArray(_line) ? _line.slice(Math.max(0, _line.length - 7)) : _line;
  const last = q?.last ?? 0;
  const change = q?.change ?? 0;
  const changePct = q?.changePct ?? 0;
  const positive = changePct >= 0;

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const good = get('semantic.success') as string;
  const bad = get('semantic.danger') as string;
  const cur = (useInvestStore.getState().activePortfolio()?.baseCurrency || 'USD').toUpperCase();
  const accent = positive ? good : bad;

  return (
    <Pressable accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => ({
        backgroundColor: 'transparent',
        padding: spacing.s12,
        paddingVertical: spacing.s16,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Left: symbol/name */}
        <View style={{ flex: 1, gap: spacing.s2 }}>
          <Text style={{ color: text, fontWeight: '800' }}>{sym}</Text>
          <Text style={{ color: muted, fontSize: 12 }}>{formatCurrency(last, cur, { compact: false })}</Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: spacing.s4 }}>
          <Text style={{ color: positive ? good : bad, fontWeight: '600' }}>
            {`${change >= 0 ? '+' : ''}${formatCurrency(Math.abs(change), cur, { compact: true })} (${formatPercent(changePct)})`}
          </Text>
          <SparklineMini data={line7} width={76} height={24} positive={positive} />
        </View>
      </View>
    </Pressable>
  );
}

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
