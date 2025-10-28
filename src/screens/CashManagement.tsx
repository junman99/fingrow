import React from 'react';
import { View, Text, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { Screen } from '../components/Screen';
import { useInvestStore } from '../store/invest';
import { formatCurrency } from '../lib/format';
import Icon from '../components/Icon';
import CashEditorSheet from '../components/invest/CashEditorSheet';

export default function CashManagement() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const store = useInvestStore() as any;

  const portfolioId = route.params?.portfolioId as (string | undefined);

  const { portfolios = {} } = store;
  const p = portfolioId ? portfolios[portfolioId] : null;
  const cur = (p?.baseCurrency || 'USD').toUpperCase();
  const currentCash = Number(p?.cash || 0);
  const cashEvents = (p?.cashEvents || []) as Array<{ date: string; amount: number }>;

  // Sort cash events by date (newest first)
  const sortedEvents = React.useMemo(() => {
    return [...cashEvents].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [cashEvents]);

  // Calculate cumulative balance at each transaction
  const eventsWithBalance = React.useMemo(() => {
    // Start from the oldest and accumulate forward
    const reversed = [...sortedEvents].reverse();
    let runningBalance = 0;
    const withBalance = reversed.map(event => {
      runningBalance += event.amount;
      return { ...event, balance: runningBalance };
    });
    // Reverse back to newest first
    return withBalance.reverse();
  }, [sortedEvents]);

  // Group by month (YYYY-MM)
  const monthGroups = React.useMemo(() => {
    const groups: Record<string, Array<{ date: string; amount: number; balance: number }>> = {};
    eventsWithBalance.forEach(event => {
      const d = new Date(event.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    // keep keys sorted desc by month
    const keys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return keys.map(k => ({ key: k, items: groups[k] }));
  }, [eventsWithBalance]);

  const [showCashEditor, setShowCashEditor] = React.useState(false);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;

  // Calculate total deposits and withdrawals
  const totals = React.useMemo(() => {
    let deposits = 0;
    let withdrawals = 0;
    cashEvents.forEach(event => {
      if (event.amount > 0) deposits += event.amount;
      else withdrawals += Math.abs(event.amount);
    });
    return { deposits, withdrawals };
  }, [cashEvents]);

  return (
    <Screen>
      <ScrollView
        alwaysBounceVertical={Platform.OS === 'ios'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: spacing.s24 }}
      >
        {/* Header with Back Button */}
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s8 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={({ pressed }) => ({
                padding: spacing.s8,
                marginLeft: -spacing.s8,
                borderRadius: radius.md,
                backgroundColor: pressed ? get('surface.level2') as string : 'transparent',
              })}
              hitSlop={8}
            >
              <Icon name="chevron-left" size={24} color={text} />
            </Pressable>
          </View>
          <Text style={{ color: text, fontWeight: '800', fontSize: 28, letterSpacing: -0.5 }}>
            Cash Management
          </Text>
          <Text style={{ color: muted, fontSize: 14, marginTop: spacing.s2 }}>
            {p?.name || 'Portfolio'}
          </Text>
        </View>

        {/* Summary Cards */}
        <View style={{ paddingHorizontal: spacing.s16, marginBottom: spacing.s16 }}>
          <View
            style={{
              backgroundColor: get('surface.level1') as string,
              borderRadius: radius.lg,
              padding: spacing.s16,
              marginBottom: spacing.s8,
            }}
          >
            <Text
              style={{
                color: muted,
                fontSize: 11,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: spacing.s4,
              }}
            >
              Current Balance
            </Text>
            <Text style={{ color: text, fontSize: 32, fontWeight: '800' }}>
              {formatCurrency(currentCash, cur)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: get('surface.level1') as string,
                borderRadius: radius.lg,
                padding: spacing.s12,
              }}
            >
              <Text
                style={{
                  color: muted,
                  fontSize: 11,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: spacing.s4,
                }}
              >
                Total Deposits
              </Text>
              <Text style={{ color: get('semantic.success') as string, fontSize: 18, fontWeight: '800' }}>
                {formatCurrency(totals.deposits, cur)}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: get('surface.level1') as string,
                borderRadius: radius.lg,
                padding: spacing.s12,
              }}
            >
              <Text
                style={{
                  color: muted,
                  fontSize: 11,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: spacing.s4,
                }}
              >
                Total Withdrawals
              </Text>
              <Text style={{ color: get('semantic.danger') as string, fontSize: 18, fontWeight: '800' }}>
                {formatCurrency(totals.withdrawals, cur)}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View
          style={{
            paddingHorizontal: spacing.s16,
            marginBottom: spacing.s16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s8,
          }}
        >
          <Pressable
            onPress={() => setShowCashEditor(true)}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.s8,
              paddingVertical: spacing.s12,
              borderRadius: radius.lg,
              backgroundColor: get('component.button.primary.bg') as string,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Icon name="plus" size={20} colorToken="text.onPrimary" />
            <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 15 }}>
              Add Transaction
            </Text>
          </Pressable>
        </View>

        {/* Transaction History */}
        <View style={{ paddingHorizontal: spacing.s16 }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 18, marginBottom: spacing.s12 }}>
            Transaction History
          </Text>
          {monthGroups.length === 0 ? (
            <View
              style={{
                backgroundColor: get('surface.level1') as string,
                borderRadius: radius.lg,
                padding: spacing.s16,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: text, fontWeight: '700', fontSize: 15, marginBottom: spacing.s4 }}>
                No transactions yet
              </Text>
              <Text style={{ color: muted, fontSize: 13, textAlign: 'center' }}>
                Add your first cash transaction to start tracking
              </Text>
            </View>
          ) : (
            monthGroups.map(group => (
              <View key={group.key} style={{ marginBottom: spacing.s16 }}>
                <View style={{ marginBottom: spacing.s8 }}>
                  <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>
                    {(() => {
                      const [y, m] = group.key.split('-').map((x: string) => Number(x));
                      const d = new Date(y, (m || 1) - 1, 1);
                      return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
                    })()}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s4 }}>
                    <Text style={{ color: muted, fontSize: 12 }}>
                      {group.items.length} {group.items.length === 1 ? 'transaction' : 'transactions'}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    backgroundColor: get('surface.level1') as string,
                    borderRadius: radius.lg,
                    overflow: 'hidden',
                  }}
                >
                  {group.items.map((event, i) => {
                    const isDeposit = event.amount > 0;
                    const date = new Date(event.date);
                    return (
                      <View key={i}>
                        <View style={{ padding: spacing.s12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                                <View
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: radius.pill,
                                    backgroundColor: isDeposit
                                      ? withAlpha(get('semantic.success') as string, 0.15)
                                      : withAlpha(get('semantic.danger') as string, 0.15),
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Icon
                                    name={isDeposit ? 'trending-down' : 'trending-up'}
                                    size={18}
                                    color={
                                      isDeposit
                                        ? (get('semantic.success') as string)
                                        : (get('semantic.danger') as string)
                                    }
                                  />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
                                    {isDeposit ? 'Deposit' : 'Withdrawal'}
                                  </Text>
                                  <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                                    {date.toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text
                                style={{
                                  color: isDeposit
                                    ? (get('semantic.success') as string)
                                    : (get('semantic.danger') as string),
                                  fontWeight: '800',
                                  fontSize: 16,
                                }}
                              >
                                {isDeposit ? '+' : '−'}
                                {formatCurrency(Math.abs(event.amount), cur)}
                              </Text>
                              <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                                Balance: {formatCurrency(event.balance, cur)}
                              </Text>
                            </View>
                          </View>
                        </View>
                        {i < group.items.length - 1 ? (
                          <View
                            style={{
                              height: 1,
                              backgroundColor: get('border.subtle') as string,
                              marginHorizontal: spacing.s12,
                            }}
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {p && (
        <CashEditorSheet
          visible={showCashEditor}
          onClose={() => setShowCashEditor(false)}
          portfolioId={p.id}
          currency={cur}
        />
      )}
    </Screen>
  );
}

function withAlpha(color: string, alpha: number): string {
  if (!color) return color;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw.padEnd(6, '0');
    const num = parseInt(hex.slice(0, 6), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const match = color.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([0-9.]+))?\)/i);
  if (match) {
    const [, r, g, b] = match;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
