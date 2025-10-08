
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, View, Text } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import SparklineMini from './SparklineMini';
import { useInvestStore } from '../../store/invest';
import { formatCurrency, formatPercent } from '../../lib/format';

export default function HoldingRow({ sym, onPress, portfolioId, variant = 'card' }: { sym: string; onPress?: () => void; portfolioId?: string; variant?: 'card' | 'list' }) {
  const { get } = useThemeTokens();
  const { holdings, quotes, profile, portfolios } = useInvestStore();
  const nav = useNavigation<any>();
  const handlePress = React.useCallback(() => { if (typeof onPress === 'function') return onPress(); try { nav.navigate('AddLot', { symbol: sym, portfolioId }); } catch (e) {} }, [onPress, nav, sym, portfolioId]);


  const h = portfolioId ? (portfolios[portfolioId]?.holdings?.[sym]) : holdings[sym];
  const q = quotes[sym];
  const _line = (q?.line || []);
  const line7 = Array.isArray(_line) ? _line.slice(Math.max(0, _line.length - 7)) : _line;
  const qty = (h?.lots || []).reduce((acc, l) => acc + (l.side === 'buy' ? l.qty : -l.qty), 0);
  const last = q?.last ?? 0;
  const val = qty * last;
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
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${sym}`}
      style={{
        backgroundColor: variant==='card' ? bg : 'transparent',
        borderRadius: variant==='card' ? radius.lg : 0,
        borderWidth: variant==='card' ? 1 : 0,
        borderColor: variant==='card' ? border : 'transparent',
        padding: variant==='card' ? spacing.s16 : spacing.s12,
        marginBottom: variant==='card' ? spacing.s8 : 0,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Left: symbol/name */}
        <View style={{ flex: 1, gap: spacing.s2 }}>
          <Text style={{ color: text, fontWeight: '700' }}>{sym}</Text>
          <Text style={{ color: muted, fontSize: 12 }}>{qty} × {formatCurrency(last, cur, { compact: false })}</Text>
        </View>

        {/* Right: value & % with sparkline */}
        <View style={{ alignItems: 'flex-end', gap: spacing.s4 }}>
          <Text style={{ color: text, fontWeight: '700' }}>{formatCurrency(val, cur, { compact: true })}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <SparklineMini data={line7} width={76} height={24} positive={positive} />
            <Text style={{ color: positive ? good : bad, fontWeight: '600' }}>{formatPercent(changePct)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
