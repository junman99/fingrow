
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
  const handlePress = React.useCallback(() => { if (typeof onPress === 'function') return onPress(); try { nav.navigate('Instrument', { sym }); } catch (e) {} }, [onPress, nav, sym]);

  const q = quotes[sym];
  const _line = (q?.line || []);
  const line7 = Array.isArray(_line) ? _line.slice(Math.max(0, _line.length - 7)) : _line;
  const last = q?.last ?? 0;
  const change = q?.change ?? 0;
  const changePct = q?.changePct ?? 0;
  const positive = changePct >= 0;

  const bg = get('surface.level1') as string;
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const good = get('semantic.success') as string;
  const bad = get('semantic.danger') as string;
  const cur = (useInvestStore.getState().activePortfolio()?.baseCurrency || 'USD').toUpperCase();

  return (
    <Pressable accessibilityRole="button"
      onPress={onPress}
      style={{
        backgroundColor: bg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: border,
        padding: spacing.s16,
        marginBottom: spacing.s8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Left: symbol/name */}
        <View style={{ flex: 1, gap: spacing.s2 }}>
          <Text style={{ color: text, fontWeight: '700' }}>{sym}</Text>
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
