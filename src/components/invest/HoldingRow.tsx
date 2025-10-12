
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


  const isCash = sym === 'CASH';
  const p = portfolioId ? portfolios[portfolioId] : useInvestStore.getState().activePortfolio();
  const cur = (p?.baseCurrency || 'USD').toUpperCase();
  const h = isCash ? null : (portfolioId ? (portfolios[portfolioId]?.holdings?.[sym]) : holdings[sym]);
  const q = isCash ? null : quotes[sym];
  const _line = isCash ? [] : (q?.line || []);
  const line7 = Array.isArray(_line) ? _line.slice(Math.max(0, _line.length - 7)) : _line;
  const qty = isCash ? 0 : (h?.lots || []).reduce((acc, l) => acc + (l.side === 'buy' ? l.qty : -l.qty), 0);
  const last = isCash ? 1 : (q?.last ?? 0);
  const val = isCash ? Number(p?.cash || 0) : qty * last;
  const changePct = isCash ? 0 : (q?.changePct ?? 0);
  const positive = changePct >= 0;

  const bg = get('surface.level1') as string;
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const good = get('semantic.success') as string;
  const bad = get('semantic.danger') as string;
  

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
          <Text style={{ color: text, fontWeight: '700' }}>{isCash ? 'Cash' : sym}</Text>
          {isCash ? (
            <Text style={{ color: muted, fontSize: 12 }}>{cur}</Text>
          ) : (
            <Text style={{ color: muted, fontSize: 12 }}>{qty} × {formatCurrency(last, cur, { compact: false })}</Text>
          )}
        </View>

        {/* Right: value & % with sparkline */}
        <View style={{ alignItems: 'flex-end', gap: spacing.s4 }}>
          <Text style={{ color: text, fontWeight: '700' }}>{formatCurrency(val, cur, { compact: true })}</Text>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <SparklineMini data={line7} width={76} height={24} positive={positive} />
              <Text style={{ color: positive ? good : bad, fontWeight: '600' }}>{formatPercent(changePct)}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
