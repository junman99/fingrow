
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useTxStore } from '../store/transactions';

type Tx = {
  id: string;
  title?: string;
  amount: number | string;
  date: string;
  type?: 'expense' | 'income';
  category?: string;
};

export const TransactionRow: React.FC<{
  tx: Tx;
  isLast?: boolean;
}> = ({ tx, isLast }) => {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { remove } = useTxStore();

  const REVEAL = 64;
  const DELETE_AT = 160;

  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = e.translationX;
      } else {
        translateX.value = e.translationX * 0.2; // resist right swipe
      }
    })
    .onEnd(() => {
      const x = translateX.value;
      if (x < -DELETE_AT) {
        translateX.value = withTiming(-600, { duration: 180 }, (finished) => {
          if (finished) runOnJS(remove)(tx.id);
        });
      } else if (x < -REVEAL) {
        translateX.value = withSpring(-REVEAL, { damping: 18, stiffness: 180 });
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={{ backgroundColor: get('surface.level1') as string }}>
      {/* Delete action bg */}
      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button"
          onPress={() => remove(tx.id)}
          style={[styles.deleteBtn, { backgroundColor: get('semantic.dangerSoft') as string }]}
          hitSlop={10}
        >
          <Text style={{ color: get('semantic.danger') as string, fontWeight: '700' }}>Delete</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, rowStyle]}>
          <Pressable
            onPress={() => nav.navigate('EditTransaction', { id: tx.id })}
            style={[styles.inner, { borderBottomColor: get('border.subtle') as string }, isLast ? { borderBottomWidth: 0 } : { borderBottomWidth: StyleSheet.hairlineWidth }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>{tx.title || tx.category || 'Transaction'}</Text>
              <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>
                {new Date(tx.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>
              {`${tx.type === 'income' ? '+' : '-'}$${Math.abs(Number(tx.amount) || 0).toFixed(0)}`}
            </Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { },
  inner: {
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.s16,
  },
  actionRow: {
    position: 'absolute',
    right: 0, left: 0, top: 0, bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.s12,
  },
  deleteBtn: {
    paddingVertical: spacing.s8,
    paddingHorizontal: spacing.s12,
    borderRadius: radius.lg,
  },
});

export default TransactionRow;
