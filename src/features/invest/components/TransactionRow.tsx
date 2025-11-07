
import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import Icon from '../../components/Icon';
import { useInvestStore } from '../store';

type Lot = { id: string; side: 'buy'|'sell'; qty: number; price: number; date: string; fees?: number };
type Props = {
  lot: Lot;
  currency: string;
  symbol: string;
  onEdit: (lot: Lot) => void;
  onDelete: (lot: Lot) => void;
};

function getLogoColor(symbol: string): string {
  const colors = [
    '#5B9A8B', '#D4735E', '#88AB8E', '#C85C3D', '#E8B86D',
    '#7FE7CC', '#FF9B71', '#A4BE7B', '#6366f1', '#8b5cf6',
  ];
  const index = symbol.charCodeAt(0) % colors.length;
  return colors[index];
}

export default function TransactionRow({ lot, currency, symbol, onEdit, onDelete }: Props) {
  const { get } = useThemeTokens();
  const swipeRef = React.useRef<Swipeable>(null);
  const [imageError, setImageError] = React.useState(false);

  const quotes = useInvestStore(s => s.quotes);
  const q = quotes[symbol] || {};
  const logoUrl = q?.fundamentals?.logo;

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const danger = get('semantic.danger') as string;
  const success = get('semantic.success') as string;
  const border = get('border.subtle') as string;

  const logoColor = getLogoColor(symbol);
  const logoLetter = symbol.charAt(0).toUpperCase();
  const shouldShowImage = logoUrl && !imageError;

  const totalValue = lot.qty * lot.price;

  // Format date as "1 Jan 2025"
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderRightActions = () => (
    <View style={{ flexDirection:'row', alignItems:'stretch', height: '100%' }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => { try { swipeRef.current?.close(); } catch(e) {} ; onEdit(lot); }}
        style={{
          width: 80,
          alignItems:'center',
          justifyContent:'center',
          backgroundColor: get('accent.primary') as string
        }}
      >
        <Icon name="edit" size={20} colorToken="text.onPrimary" />
        <Text style={{
          color: get('text.onPrimary') as string,
          fontWeight:'700',
          fontSize: 13,
          marginTop: spacing.s4
        }}>
          Edit
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => { try { swipeRef.current?.close(); } catch(e) {} ; onDelete(lot); }}
        style={{
          width: 80,
          alignItems:'center',
          justifyContent:'center',
          backgroundColor: get('semantic.danger') as string
        }}
      >
        <Icon name="trash" size={20} colorToken="text.onPrimary" />
        <Text style={{
          color: get('text.onPrimary') as string,
          fontWeight:'700',
          fontSize: 13,
          marginTop: spacing.s4
        }}>
          Delete
        </Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <View style={{
        paddingVertical: spacing.s12,
        paddingHorizontal: spacing.s16,
        backgroundColor: get('surface.level1') as string
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
          {/* Logo */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: shouldShowImage ? 'transparent' : logoColor,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {shouldShowImage ? (
              <Image
                source={{ uri: logoUrl }}
                style={{ width: 40, height: 40 }}
                onError={() => setImageError(true)}
              />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
                {logoLetter}
              </Text>
            )}
          </View>

          {/* Left: Ticker + Buy/Sell, Shares @ Price */}
          <View style={{ flex: 1, minWidth: 0, gap: spacing.s4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <Text style={{ color: text, fontWeight: '800', fontSize: 15 }}>{symbol}</Text>
              <Text style={{
                color: lot.side === 'buy' ? success : danger,
                fontWeight: '700',
                fontSize: 13
              }}>
                {lot.side === 'buy' ? 'Buy' : 'Sell'}
              </Text>
            </View>
            <Text style={{ color: muted, fontSize: 13 }}>
              {lot.qty} shares @ {Intl.NumberFormat(undefined, { style:'currency', currency }).format(lot.price)}
            </Text>
          </View>

          {/* Right: Total Value, Date */}
          <View style={{ alignItems:'flex-end', gap: spacing.s4, marginLeft: spacing.s8 }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
              {Intl.NumberFormat(undefined, { style:'currency', currency }).format(totalValue)}
            </Text>
            <Text style={{ color: muted, fontSize: 12 }}>
              {formatDate(lot.date)}
            </Text>
          </View>
        </View>
      </View>
    </Swipeable>
  );
}
