import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import { Card } from '../components/Card';
import Button from '../components/Button';
import { useDebtsStore } from '../store/debts';
import { useAccountsStore } from '../store/accounts';
import { formatCurrency } from '../lib/format';

function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
    const int = parseInt(expanded, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

const AnimatedPressable: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}> = ({ onPress, children, style }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const DebtsList: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const { items: debts, hydrate: hydrateDebts } = useDebtsStore();
  const { accounts } = useAccountsStore();

  useEffect(() => {
    hydrateDebts();
  }, [hydrateDebts]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const warningColor = get('semantic.warning') as string;
  const errorColor = get('semantic.error') as string;

  const debtsList = debts || [];

  // Separate credit cards from regular accounts
  const creditCards = useMemo(
    () => (accounts || []).filter(acc => acc.kind === 'credit' && acc.includeInNetWorth !== false),
    [accounts]
  );

  const totalCreditCardDebt = creditCards.reduce((s, a) => s + Math.abs(a.balance || 0), 0);
  const totalDebt = debtsList.reduce((s, d) => s + (d.balance || 0), 0);
  const totalAllDebt = totalDebt + totalCreditCardDebt;

  // Calculate debt due in next 30 days
  const debtDue = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let total = 0;
    const list: { id: string; name: string; minDue: number; due: Date; type: 'debt' | 'credit' }[] = [];

    for (const d of debtsList) {
      const due = d.dueISO ? new Date(d.dueISO) : null;
      if (due && !isNaN(due.getTime()) && due <= cutoff) {
        total += d.minDue || 0;
        list.push({ id: d.id, name: d.name, minDue: d.minDue || 0, due, type: 'debt' });
      }
    }

    list.sort((a, b) => a.due.getTime() - b.due.getTime());
    return { total, list };
  }, [debtsList]);

  // Animations
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 400 });
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const getDaysUntil = (date: Date) => {
    const now = new Date();
    const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return `${Math.abs(days)}d overdue`;
    return `${days}d`;
  };

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
    >
      {/* Header */}
      <Animated.View style={[{ gap: spacing.s8 }, fadeStyle]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={28} color={text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: muted, fontSize: 14, fontWeight: '600' }}>
              Your Debts
            </Text>
            <Text style={{ color: text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: spacing.s2 }}>
              Debt Overview
            </Text>
            <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
              Track and manage your debt payoff journey
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Summary Card */}
      <Animated.View style={fadeStyle}>
        <Card
          style={{
            backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.14),
            padding: spacing.s20,
            borderWidth: 2,
            borderColor: withAlpha(warningColor, 0.3),
          }}
        >
          <View style={{ gap: spacing.s16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Total balance</Text>
                <Text style={{ color: text, fontSize: 32, fontWeight: '800', marginTop: spacing.s6, letterSpacing: -0.8 }}>
                  {formatCurrency(totalAllDebt)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Credit cards</Text>
                <Text style={{ color: text, fontSize: 24, fontWeight: '800', marginTop: spacing.s4 }}>
                  {formatCurrency(totalCreditCardDebt)}
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: withAlpha(border, 0.3) }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: muted, fontSize: 12 }}>Due next 30 days</Text>
                <Text style={{ color: onSurface, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                  {formatCurrency(debtDue.total)}
                </Text>
                <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                  {debtDue.list.length} payment{debtDue.list.length === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: muted, fontSize: 12 }}>Total debts</Text>
                <Text style={{ color: onSurface, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                  {debtsList.length + creditCards.length}
                </Text>
                <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                  {creditCards.length} card{creditCards.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* No Debts */}
      {debtsList.length === 0 && creditCards.length === 0 ? (
        <Animated.View style={fadeStyle}>
          <Card style={{ backgroundColor: cardBg, padding: spacing.s20 }}>
            <View style={{ gap: spacing.s16, alignItems: 'center' }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius.xl,
                  backgroundColor: withAlpha(warningColor, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="target" size={32} color={warningColor} />
              </View>
              <View style={{ alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                  No debts tracked
                </Text>
                <Text style={{ color: muted, textAlign: 'center', lineHeight: 20 }}>
                  Add your debts or credit cards to monitor payoff progress and due dates
                </Text>
              </View>
              <Button
                title="Add debt"
                onPress={() => nav.navigate('AddDebt')}
                style={{ width: '100%' }}
              />
            </View>
          </Card>
        </Animated.View>
      ) : (
        <>
          {/* Credit Cards */}
          {creditCards.length > 0 && (
            <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
                Credit Cards ({creditCards.length})
              </Text>
              <View style={{ gap: spacing.s10 }}>
                {creditCards.map(card => (
                  <AnimatedPressable
                    key={card.id}
                    onPress={() => nav.navigate('AccountDetail', { id: card.id })}
                    style={{
                      backgroundColor: cardBg,
                      borderRadius: radius.lg,
                      padding: spacing.s16,
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: radius.lg,
                            backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.15),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon name="credit-card" size={24} colorToken="semantic.warning" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>{card.name}</Text>
                          <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                            {card.institution || 'Credit Card'}
                            {card.mask ? ` • ${card.mask}` : ''}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: text, fontWeight: '800', fontSize: 20 }}>
                        {formatCurrency(Math.abs(card.balance))}
                      </Text>
                    </View>
                  </AnimatedPressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Other Debts */}
          {debtsList.length > 0 && (
            <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
                Other Debts ({debtsList.length})
              </Text>
              <View style={{ gap: spacing.s10 }}>
                {debtsList.map(debt => {
                  const dueDate = debt.dueISO ? new Date(debt.dueISO) : null;
                  const dueLabel =
                    dueDate && !isNaN(dueDate.getTime())
                      ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'No due date';
                  const daysUntil = dueDate && !isNaN(dueDate.getTime()) ? getDaysUntil(dueDate) : null;

                  return (
                    <AnimatedPressable
                      key={debt.id}
                      onPress={() => nav.navigate('DebtDetail', { id: debt.id })}
                      style={{
                        backgroundColor: cardBg,
                        borderRadius: radius.lg,
                        padding: spacing.s16,
                        borderWidth: 1,
                        borderColor: border,
                      }}
                    >
                      <View style={{ gap: spacing.s10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
                            <View
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: radius.lg,
                                backgroundColor: withAlpha(errorColor, isDark ? 0.2 : 0.15),
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icon name="target" size={24} colorToken="semantic.error" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>{debt.name}</Text>
                              <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                                {debt.type?.toUpperCase() || 'DEBT'} • {debt.apr ?? 0}% APR
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: text, fontWeight: '800', fontSize: 20 }}>
                            {formatCurrency(debt.balance)}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginLeft: 60 }}>
                          <View>
                            <Text style={{ color: muted, fontSize: 12 }}>Min payment</Text>
                            <Text style={{ color: onSurface, fontWeight: '600', fontSize: 14, marginTop: 2 }}>
                              {formatCurrency(debt.minDue)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: muted, fontSize: 12 }}>Due {dueLabel}</Text>
                            {daysUntil && (
                              <Text style={{ color: onSurface, fontWeight: '600', fontSize: 14, marginTop: 2 }}>
                                {daysUntil}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </>
      )}

      {/* Quick Actions */}
      <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
        <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
          Quick Actions
        </Text>
        <View style={{ gap: spacing.s8 }}>
          <Button
            title="Add debt"
            onPress={() => nav.navigate('AddDebt')}
            variant="secondary"
            icon="plus"
          />
          {totalAllDebt > 0 && (
            <Button
              title="Payoff simulator"
              onPress={() => nav.navigate('PayoffSimulator')}
              variant="secondary"
              icon="target"
            />
          )}
        </View>
      </Animated.View>
    </ScreenScroll>
  );
};

export default DebtsList;
