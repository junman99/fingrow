import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore } from '../store';

type Props = {
  visible: boolean;
  onClose: () => void;
  sourceId: string | null;
};

export default function MoveHoldingsSheet({ visible, onClose, sourceId }: Props) {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const primary = get('component.button.primary.bg') as string;
  const onPrimary = get('component.button.primary.text') as string;
  const disabledBg = get('component.button.disabled.bg') as string;
  const disabledText = get('component.button.disabled.text') as string;

  const portfolios = useInvestStore(s => s.portfolios);
  const order = useInvestStore(s => (s as any).portfolioOrder || (s as any).order);
  const moveHolding = useInvestStore(s => (s as any).moveHoldingBetweenPortfolios);

  const src = sourceId ? (portfolios as any)[sourceId] : null;
  const symbols = useMemo(()=> src ? Object.keys(src.holdings || {}) : [], [src?.id, src?.holdings]);
  const [symbol, setSymbol] = useState<string | null>(symbols[0] || null);
  const [destId, setDestId] = useState<string | null>(null);
  const [mode, setMode] = useState<'lots'|'aggregate'>('lots');

  const destList = useMemo(() => {
    const map = portfolios || {};
    const ord = (order && order.length ? order : Object.keys(map));
    return ord.filter((id:string) => id !== sourceId).map((id:string) => ({ id, name: (map as any)[id]?.name || 'Untitled' }));
  }, [portfolios, order, sourceId]);

  const canMove = !!(sourceId && destId && symbol);

  const onMove = async () => {
    if (!canMove) return;
    try {
      await (moveHolding as any)({ symbol: symbol!, fromId: sourceId!, toId: destId!, mode });
      onClose();
      Alert.alert('Moved', `Moved ${symbol} to destination portfolio.`);
    } catch (e) {
      Alert.alert('Could not move', String(e));
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s12 }}>
        <Text style={{ color: text, marginTop: spacing.s8, marginBottom: spacing.s6, fontWeight: '700' }}>Move holdings</Text>

        <Text style={{ color: text, marginTop: spacing.s8, marginBottom: spacing.s6, fontWeight: '600' }}>Symbol</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap: spacing.s8 }}>
          {symbols.map((s) => (
            <Pressable key={s} onPress={() => setSymbol(s)} style={{ borderWidth:1, borderColor: border, borderRadius: 999, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
              <Text style={{ color: text }}>{s}</Text>
            </Pressable>
          ))}
          {symbols.length === 0 && (<Text style={{ color: muted }}>No symbols in source.</Text>)}
        </View>

        <Text style={{ color: text, marginTop: spacing.s16, marginBottom: spacing.s6, fontWeight: '600' }}>Destination</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap: spacing.s8 }}>
          {destList.map((p:any) => (
            <Pressable key={p.id} onPress={() => setDestId(p.id)} style={{ borderWidth:1, borderColor: border, borderRadius: 999, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
              <Text style={{ color: text }}>{p.name}</Text>
            </Pressable>
          ))}
          {destList.length === 0 && (<Text style={{ color: muted }}>No other portfolio available.</Text>)}
        </View>

        <Text style={{ color: text, marginTop: spacing.s16, marginBottom: spacing.s6, fontWeight: '600' }}>Mode</Text>
        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          {(['lots','aggregate'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={{ borderWidth:1, borderColor: border, borderRadius: 999, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
              <Text style={{ color: text }}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: spacing.s16 }} />

        <Pressable
          onPress={onMove}
          disabled={!canMove}
          accessibilityRole="button"
          style={{ backgroundColor: canMove ? primary : disabledBg, paddingVertical: spacing.s12, borderRadius: 999, alignItems: 'center' }}
        >
          <Text style={{ color: canMove ? onPrimary : disabledText, fontWeight: '700' }}>Move</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}