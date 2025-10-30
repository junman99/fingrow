import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, Animated, FlatList } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Icon from '../components/Icon';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';

function withAlpha(hex: string, alpha: number) {
  if (!hex) return hex;
  const raw = hex.replace('#', '');
  const bigint = parseInt(raw.length === 3 ? raw.repeat(2) : raw, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function fmtMoney(n: number) {
  try { return new Intl.NumberFormat(undefined, { style:'currency', currency:'SGD', maximumFractionDigits:0 }).format(n); }
  catch { return `S$${n.toFixed(0)}`; }
}

function formatDate(d: Date) {
  const now = new Date();
  const start = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((start(d) - start(now)) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function startOfMonth(d: Date) { const n = new Date(d.getFullYear(), d.getMonth(), 1); n.setHours(0,0,0,0); return n; }
function endOfMonth(d: Date) { const n = new Date(d.getFullYear(), d.getMonth()+1, 0); n.setHours(23,59,59,999); return n; }

type Tx = ReturnType<typeof useTxStore.getState>['transactions'][number];

export default function CategoryTransactions() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { transactions } = useTxStore();

  const categoryName = route.params?.category || 'Uncategorized';

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const accentPrimary = get('accent.primary') as string;
  const dangerColor = get('semantic.danger') as string;
  const borderSubtle = get('border.subtle') as string;

  const today = new Date();
  const period = { start: startOfMonth(today), end: endOfMonth(today) };

  // Filter transactions by category and current month
  const categoryTxs = useMemo(() => {
    return (transactions || [])
      .filter((t: any) =>
        t.type === 'expense' &&
        (t.category === categoryName || (!t.category && categoryName === 'Uncategorized')) &&
        new Date(t.date) >= period.start &&
        new Date(t.date) <= period.end
      )
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, categoryName, period]);

  const totalSpent = categoryTxs.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  const txCount = categoryTxs.length;

  const fmtTime = (date: Date) => {
    if (isNaN(date.getTime())) return '';
    const h = date.getHours();
    const m = date.getMinutes();
    const hh = ((h % 12) || 12).toString();
    const mm = m.toString().padStart(2, '0');
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${hh}:${mm} ${ampm}`;
  };

  const renderTransaction = ({ item, index }: { item: Tx; index: number }) => {
    const date = new Date(item.date);
    const amount = Math.abs(Number(item.amount) || 0);
    const isLast = index === categoryTxs.length - 1;
    const categoryInitial = (item.category || categoryName || 'T').charAt(0).toUpperCase();

    return (
      <Pressable
        onPress={() => nav.navigate('EditTransaction', { id: item.id })}
        style={({ pressed }) => ({
          paddingVertical: spacing.s12,
          paddingHorizontal: spacing.s16,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: borderSubtle,
          backgroundColor: pressed ? withAlpha(surface2, 0.5) : surface1
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Category indicator - circular with initial */}
          <View style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: withAlpha(dangerColor, isDark ? 0.2 : 0.12),
            marginRight: spacing.s12,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Text style={{
              color: dangerColor,
              fontWeight: '700',
              fontSize: 16
            }}>
              {categoryInitial}
            </Text>
          </View>

          {/* Content */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{
              color: textPrimary,
              fontWeight: '700',
              fontSize: 15
            }}>
              {item.note || item.description || item.category || 'Transaction'}
            </Text>
            <Text numberOfLines={1} style={{
              color: textMuted,
              fontSize: 13,
              marginTop: 2
            }}>
              {fmtTime(date)} • {item.category || categoryName}
            </Text>
          </View>

          {/* Amount */}
          <Text style={{
            color: dangerColor,
            fontWeight: '700',
            fontSize: 15,
            marginLeft: spacing.s8
          }}>
            -${amount.toFixed(2)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s24 }}>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        paddingHorizontal: spacing.s16,
        paddingTop: spacing.s12,
        gap: spacing.s20
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? surface1 : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={28} color={textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.s2 }}>
              {categoryName}
            </Text>
            <Text style={{ color: textMuted, fontSize: 14, marginTop: spacing.s4 }}>
              {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Summary Stats */}
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <View style={{
            flex: 1,
            padding: spacing.s16,
            borderRadius: radius.xl,
            backgroundColor: withAlpha(dangerColor, isDark ? 0.15 : 0.08),
            borderWidth: 1,
            borderColor: withAlpha(dangerColor, 0.25)
          }}>
            <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Spent
            </Text>
            <Text style={{ color: textPrimary, fontWeight: '900', fontSize: 32, letterSpacing: -1 }}>
              {fmtMoney(totalSpent)}
            </Text>
          </View>
          <View style={{
            flex: 1,
            padding: spacing.s16,
            borderRadius: radius.xl,
            backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08),
            borderWidth: 1,
            borderColor: withAlpha(accentPrimary, 0.25)
          }}>
            <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Transactions
            </Text>
            <Text style={{ color: textPrimary, fontWeight: '900', fontSize: 32, letterSpacing: -1 }}>
              {txCount}
            </Text>
          </View>
        </View>

        {/* Transactions List */}
        <View style={{ gap: spacing.s8 }}>
          <Text style={{ color: textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Recent Activity
          </Text>

          {txCount === 0 ? (
            <View style={{
              padding: spacing.s24,
              borderRadius: radius.xl,
              backgroundColor: surface1,
              borderWidth: 1,
              borderColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5),
              alignItems: 'center'
            }}>
              <Text style={{ color: textMuted, fontSize: 15, textAlign: 'center' }}>
                No transactions this month
              </Text>
            </View>
          ) : (
            <View style={{
              borderRadius: radius.xl,
              backgroundColor: surface1,
              borderWidth: 1,
              borderColor: withAlpha(borderSubtle, isDark ? 0.3 : 0.5),
              overflow: 'hidden'
            }}>
              <FlatList
                data={categoryTxs}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => renderTransaction({ item, index })}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>
      </Animated.View>
    </ScreenScroll>
  );
}
