
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, Alert, Animated } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { ScreenScroll } from '../components/ScreenScroll';
import Input from '../components/Input';
import Icon from '../components/Icon';

function withAlpha(color: string, alpha: number) {
  if (!color) return color;
  if (color.startsWith('rgba')) {
    const parts = color.slice(5, -1).split(',').map(part => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb')) {
    const parts = color.slice(4, -1).split(',').map(part => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const raw = color.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Animated pressable for buttons
const AnimatedButton: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'secondary';
  disabled?: boolean;
}> = ({ onPress, children, variant = 'primary', disabled = false }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const { get } = useThemeTokens();

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const bgColor = variant === 'primary'
    ? get('accent.primary') as string
    : variant === 'danger'
    ? get('semantic.danger') as string
    : get('surface.level2') as string;

  const textColor = variant === 'secondary'
    ? get('text.primary') as string
    : get('text.onPrimary') as string;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          paddingVertical: spacing.s16,
          paddingHorizontal: spacing.s24,
          borderRadius: radius.lg,
          backgroundColor: bgColor,
          alignItems: 'center',
          opacity: disabled ? 0.5 : 1
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default function EditTransaction() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id;

  const { transactions, updateTransaction, remove } = useTxStore();
  const tx = useMemo(() => transactions.find(t => t.id === id), [transactions, id]);

  const [note, setNote] = useState(tx?.note || '');
  const [amount, setAmount] = useState(String(Math.abs(tx?.amount ?? 0)));
  const [type, setType] = useState<'income' | 'expense'>(tx?.type || 'expense');
  const [category, setCategory] = useState(tx?.category || '');

  useEffect(() => {
    if (tx) {
      setNote(tx.note || '');
      setAmount(String(Math.abs(tx.amount ?? 0)));
      setType(tx.type || 'expense');
      setCategory(tx.category || '');
    }
  }, [tx]);

  const save = async () => {
    if (!tx) return;
    try {
      await updateTransaction(id, {
        note,
        amount: Number(amount),
        type,
        category,
        date: tx.date, // Keep the original date
      });
      nav.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update transaction');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(id);
              nav.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  };

  if (!tx) {
    return (
      <ScreenScroll style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.s24 }}>
          <View style={{
            width: 64,
            height: 64,
            borderRadius: radius.lg,
            backgroundColor: withAlpha(get('semantic.danger') as string, 0.1),
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.s16
          }}>
            <Icon name="alert-circle" size={32} colorToken="semantic.danger" />
          </View>
          <Text style={{ color: get('text.primary') as string, fontSize: 18, fontWeight: '700', marginBottom: spacing.s8 }}>
            Transaction not found
          </Text>
          <Text style={{ color: get('text.muted') as string, fontSize: 14, textAlign: 'center' }}>
            This transaction may have been deleted or doesn't exist.
          </Text>
        </View>
      </ScreenScroll>
    );
  }

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;
  const dangerColor = get('semantic.danger') as string;

  const isIncome = type === 'income';
  const categoryInitial = (category || 'T').charAt(0).toUpperCase();

  return (
    <ScreenScroll
      style={{ flex: 1 }}
      contentStyle={{ padding: spacing.s16, paddingBottom: spacing.s32 }}
    >
      {/* Header */}
      <View style={{ marginBottom: spacing.s24 }}>
        <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
          Edit Transaction
        </Text>
        <Text style={{ color: textMuted, fontSize: 14, marginTop: spacing.s4 }}>
          Update the details of your transaction
        </Text>
      </View>

      {/* Preview Card */}
      <View style={{
        backgroundColor: surface1,
        borderRadius: radius.lg,
        padding: spacing.s16,
        marginBottom: spacing.s24,
        borderWidth: 1,
        borderColor: get('border.subtle') as string
      }}>
        <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s12 }}>
          PREVIEW
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Category indicator */}
          <View style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            backgroundColor: isIncome ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            marginRight: spacing.s12,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Text style={{
              color: isIncome ? successColor : dangerColor,
              fontWeight: '700',
              fontSize: 18
            }}>
              {categoryInitial}
            </Text>
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{
              color: textPrimary,
              fontWeight: '700',
              fontSize: 16
            }}>
              {note || category || 'Transaction'}
            </Text>
            <Text numberOfLines={1} style={{
              color: textMuted,
              fontSize: 13,
              marginTop: 2
            }}>
              {category}
            </Text>
          </View>

          {/* Amount */}
          <Text style={{
            color: isIncome ? successColor : dangerColor,
            fontWeight: '700',
            fontSize: 18
          }}>
            {isIncome ? '+' : '-'}${Number(amount || 0).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Type Selector */}
      <View style={{ marginBottom: spacing.s16 }}>
        <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.s8 }}>
          TYPE
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <Pressable
            onPress={() => setType('expense')}
            style={{
              flex: 1,
              paddingVertical: spacing.s16,
              paddingHorizontal: spacing.s16,
              borderRadius: radius.lg,
              backgroundColor: type === 'expense' ? withAlpha(dangerColor, 0.15) : surface1,
              borderWidth: 2,
              borderColor: type === 'expense' ? dangerColor : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              gap: spacing.s8,
              justifyContent: 'center'
            }}
          >
            <Icon
              name="arrow-down"
              size={18}
              color={type === 'expense' ? dangerColor : textMuted}
            />
            <Text style={{
              color: type === 'expense' ? dangerColor : textPrimary,
              fontWeight: type === 'expense' ? '700' : '600',
              fontSize: 15
            }}>
              Expense
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setType('income')}
            style={{
              flex: 1,
              paddingVertical: spacing.s16,
              paddingHorizontal: spacing.s16,
              borderRadius: radius.lg,
              backgroundColor: type === 'income' ? withAlpha(successColor, 0.15) : surface1,
              borderWidth: 2,
              borderColor: type === 'income' ? successColor : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              gap: spacing.s8,
              justifyContent: 'center'
            }}
          >
            <Icon
              name="arrow-up"
              size={18}
              color={type === 'income' ? successColor : textMuted}
            />
            <Text style={{
              color: type === 'income' ? successColor : textPrimary,
              fontWeight: type === 'income' ? '700' : '600',
              fontSize: 15
            }}>
              Income
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Amount Input */}
      <View style={{ marginBottom: spacing.s16 }}>
        <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.s8 }}>
          AMOUNT
        </Text>
        <Input
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          style={{ margin: 0 }}
        />
      </View>

      {/* Category Input */}
      <View style={{ marginBottom: spacing.s16 }}>
        <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.s8 }}>
          CATEGORY
        </Text>
        <Input
          value={category}
          onChangeText={setCategory}
          placeholder="e.g., Food, Transport, Salary"
          style={{ margin: 0 }}
        />
      </View>

      {/* Note Input */}
      <View style={{ marginBottom: spacing.s24 }}>
        <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.s8 }}>
          NOTE (OPTIONAL)
        </Text>
        <Input
          value={note}
          onChangeText={setNote}
          placeholder="Add a description..."
          style={{ margin: 0 }}
        />
      </View>

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', gap: spacing.s12, marginBottom: spacing.s16 }}>
        <AnimatedButton onPress={save} variant="primary">
          <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 16 }}>
            Save Changes
          </Text>
        </AnimatedButton>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
        <AnimatedButton onPress={() => nav.goBack()} variant="secondary">
          <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 16 }}>
            Cancel
          </Text>
        </AnimatedButton>
        <AnimatedButton onPress={handleDelete} variant="danger">
          <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 16 }}>
            Delete
          </Text>
        </AnimatedButton>
      </View>
    </ScreenScroll>
  );
}
