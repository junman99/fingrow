import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import SparklineMini from './SparklineMini';
import { useInvestStore } from '../../store/invest';
import { formatCurrency, formatPercent } from '../../lib/format';

export default function HoldingRow({ sym, onPress }: { sym: string; onPress?: () => void }) {
  const { get } = useThemeTokens();
  const { holdings, quotes, profile } = useInvestStore();

  const h = holdings[sym];
  const q = quotes[sym];
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
  const cur = (profile?.currency || 'USD').toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: bg,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: border,
        padding: spacing.s12,
        marginBottom: spacing.s8,
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
            <SparklineMini data={q?.line} width={76} height={24} positive={positive} />
            <Text style={{ color: positive ? good : bad, fontWeight: '600' }}>{formatPercent(changePct)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}