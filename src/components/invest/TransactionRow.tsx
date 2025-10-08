
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';

type Lot = { id: string; side: 'buy'|'sell'; qty: number; price: number; date: string; fees?: number };
type Props = {
  lot: Lot;
  currency: string;
  onEdit: (lot: Lot) => void;
  onDelete: (lot: Lot) => void;
};

export default function TransactionRow({ lot, currency, onEdit, onDelete }: Props) {
  const { get } = useThemeTokens();
  const swipeRef = React.useRef<Swipeable>(null);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const danger = get('semantic.danger') as string;
  const success = get('semantic.success') as string;
  const border = get('border.subtle') as string;

  const renderRightActions = () => (
    <View style={{ flexDirection:'row', alignItems:'stretch', height: '100%' }}>
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => { try { swipeRef.current?.close(); } catch(e) {} ; onEdit(lot); }}
        style={({ pressed }) => ({
          width: 80, alignItems:'center', justifyContent:'center',
          backgroundColor: pressed ? (get('surface.level2') as string) : (get('surface.level1') as string),
          borderLeftWidth: 1, borderColor: border
        })}>
        <Text style={{ color: text, fontWeight:'700' }}>Edit</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => { try { swipeRef.current?.close(); } catch(e) {} ; onDelete(lot); }}
        style={({ pressed }) => ({
          width: 80, alignItems:'center', justifyContent:'center',
          backgroundColor: (get('semantic.danger') as string)
        })}>
        <Text style={{ color: get('text.onPrimary') as string, fontWeight:'800' }}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      friction={1.15}
      rightThreshold={56}
      overshootRight={false}
    >
      <View style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: lot.side === 'buy' ? success : danger, fontWeight:'800' }}>{(lot.side || 'buy').toUpperCase()}</Text>
          <Text style={{ color: muted, fontSize: 12 }}>{new Date(lot.date).toDateString()}</Text>
        </View>
        <View style={{ minWidth: 140, alignItems:'flex-end' }}>
          <Text style={{ color: text, fontWeight:'700' }}>{lot.qty} @ {Intl.NumberFormat(undefined, { style:'currency', currency }).format(lot.price)}</Text>
          {typeof lot.fees === 'number' && lot.fees !== 0 ? <Text style={{ color: muted, fontSize:12 }}>Fees: {Intl.NumberFormat(undefined, { style:'currency', currency }).format(lot.fees || 0)}</Text> : null}
        </View>
      </View>
    </Swipeable>
  );
}
