import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Screen } from '../components/Screen';
import Button from '../components/Button';
import Input from '../components/Input';
import { Card } from '../components/Card';
import Icon from '../components/Icon';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useInvestStore } from '../store/invest';
import { usePlansStore } from '../store/plans';
import { formatCurrency } from '../lib/format';
import { useNavigation, useRoute } from '@react-navigation/native';

type RouteParams = { suggest?: number };

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

export default function DCAPlanner() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { get, isDark } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const border = get('border.subtle') as string;
  const cardBg = get('surface.level1') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const bgDefault = get('background.default') as string;

  const { holdings, quotes, watchlist, hydrate } = useInvestStore();
  const { plan, hydrate: hydratePlan, save } = usePlansStore();

  const suggest = (route.params as RouteParams)?.suggest ?? 0;
  const [amount, setAmount] = useState<string>(suggest ? String(suggest) : (plan?.amount ? String(plan.amount) : '500'));
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    hydratePlan();
  }, []);

  // Candidate symbols: prefer holdings; if empty, use watchlist
  const symbols = useMemo(() => {
    const held = Object.keys(holdings || {});
    if (held.length > 0) return held;
    return watchlist || [];
  }, [holdings, watchlist]);

  // Equal weights by default or from existing plan
  const [weights, setWeights] = useState<Record<string, number>>({});
  useEffect(() => {
    const base: Record<string, number> = {};
    if (plan?.symbols?.length) {
      // Use existing weights but only for available symbols
      const map: Record<string, number> = {};
      for (const s of plan.symbols) map[s.symbol] = s.weight;
      const syms = symbols;
      const sum = syms.reduce((acc, s) => acc + (map[s] || 0), 0);
      if (sum > 0) {
        for (const s of syms) base[s] = (map[s] || 0) / sum;
      } else {
        for (const s of syms) base[s] = 1 / Math.max(1, syms.length);
      }
    } else {
      for (const s of symbols) base[s] = 1 / Math.max(1, symbols.length);
    }
    setWeights(base);
  }, [symbols, plan]);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const planRows = symbols.map(s => {
    const w = (weights[s] || 0) / totalWeight;
    const amt = (parseFloat(amount || '0') || 0) * w;
    const price = quotes[s]?.last || 0;
    const qty = price > 0 ? amt / price : 0;
    return { symbol: s, weight: w, amount: amt, price, qty };
  });

  function setWeight(sym: string, val: number) {
    const next = { ...weights, [sym]: Math.max(0, Math.min(100, val)) };
    setWeights(next);
  }

  function normalizeWeights() {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (sum === 0) return;
    const norm: Record<string, number> = {};
    for (const k of Object.keys(weights)) norm[k] = weights[k] / sum;
    setWeights(norm);
  }

  function resetToEqual() {
    const base: Record<string, number> = {};
    for (const s of symbols) base[s] = 1 / Math.max(1, symbols.length);
    setWeights(base);
  }

  async function onSave() {
    normalizeWeights();
    const amt = parseFloat(amount || '0') || 0;
    const normalizedWeights = { ...weights };
    const sum = Object.values(normalizedWeights).reduce((a, b) => a + b, 0);
    const symbols = planRows.map(r => ({
      symbol: r.symbol,
      weight: sum > 0 ? normalizedWeights[r.symbol] / sum : 0
    }));
    await save({ amount: amt, symbols, period: 'monthly' });
    nav.goBack();
  }

  const monthlyAmount = parseFloat(amount || '0') || 0;
  const yearlyAmount = monthlyAmount * 12;

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.s16,
          gap: spacing.s24,
          paddingBottom: spacing.s32
        }}
      >
        {/* Header */}
        <View>
          <Text style={{ color: text, fontSize: 28, fontWeight: '800' }}>
            DCA Planner
          </Text>
          <Text style={{ color: muted, marginTop: spacing.s6, lineHeight: 20 }}>
            Plan your monthly dollar-cost averaging strategy. This is a planning tool—no automatic investing.
          </Text>
        </View>

        {/* Amount Input */}
        <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginBottom: spacing.s12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="receipt" size={20} colorToken="accent.primary" />
            </View>
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              Monthly investment
            </Text>
          </View>
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="500"
          />
          <View
            style={{
              marginTop: spacing.s12,
              padding: spacing.s12,
              borderRadius: radius.md,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08),
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: muted, fontSize: 13 }}>Yearly total</Text>
              <Text style={{ color: onSurface, fontWeight: '700', fontSize: 14 }}>
                {formatCurrency(yearlyAmount)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Summary Stats */}
        {symbols.length > 0 && monthlyAmount > 0 && (
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <Card style={{ flex: 1, backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.12), padding: spacing.s12 }}>
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Assets</Text>
              <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                {symbols.length}
              </Text>
            </Card>
            <Card style={{ flex: 1, backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.12), padding: spacing.s12 }}>
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Avg per asset</Text>
              <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                {formatCurrency(monthlyAmount / symbols.length)}
              </Text>
            </Card>
          </View>
        )}

        {/* Allocation Section */}
        <View style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Allocation</Text>
            {symbols.length > 1 && (
              <Pressable
                onPress={resetToEqual}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(accentPrimary, pressed ? (isDark ? 0.25 : 0.18) : (isDark ? 0.15 : 0.1)),
                })}
              >
                <Text style={{ color: accentPrimary, fontWeight: '700', fontSize: 13 }}>
                  Reset to equal
                </Text>
              </Pressable>
            )}
          </View>

          {symbols.length === 0 ? (
            <Card style={{ backgroundColor: cardBg, padding: spacing.s24 }}>
              <View style={{ alignItems: 'center', gap: spacing.s12 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radius.lg,
                    backgroundColor: withAlpha(muted, isDark ? 0.15 : 0.1),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="trending-up" size={28} colorToken="text.muted" />
                </View>
                <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                  No holdings yet
                </Text>
                <Text style={{ color: muted, textAlign: 'center', lineHeight: 20 }}>
                  Add holdings to your portfolio or create a watchlist to plan your DCA strategy.
                </Text>
                <Button
                  title="Go to portfolio"
                  onPress={() => nav.navigate('Invest', { screen: 'InvestHome' })}
                  variant="secondary"
                  style={{ marginTop: spacing.s8 }}
                />
              </View>
            </Card>
          ) : (
            <View style={{ gap: spacing.s8 }}>
              {planRows.map((item) => (
                <Card key={item.symbol} style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
                  <View style={{ gap: spacing.s12 }}>
                    {/* Symbol Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: radius.sm,
                            backgroundColor: withAlpha(accentSecondary, isDark ? 0.25 : 0.15),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: accentSecondary, fontWeight: '800', fontSize: 12 }}>
                            {item.symbol.substring(0, 2)}
                          </Text>
                        </View>
                        <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>
                          {item.symbol}
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingHorizontal: spacing.s10,
                          paddingVertical: spacing.s4,
                          borderRadius: radius.pill,
                          backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
                        }}
                      >
                        <Text style={{ color: accentPrimary, fontWeight: '800', fontSize: 13 }}>
                          {(item.weight * 100).toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    {/* Allocation Bar */}
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: withAlpha(border, 0.3),
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${item.weight * 100}%`,
                          backgroundColor: accentPrimary,
                          borderRadius: 3,
                        }}
                      />
                    </View>

                    {/* Weight Input */}
                    <View>
                      <Text style={{ color: muted, fontSize: 12, marginBottom: spacing.s6 }}>
                        Allocation weight
                      </Text>
                      <View style={{ flexDirection: 'row', gap: spacing.s8, alignItems: 'center' }}>
                        <Pressable
                          onPress={() => setWeight(item.symbol, (weights[item.symbol] || 0) - 5)}
                          style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: radius.md,
                            backgroundColor: withAlpha(border, pressed ? 0.5 : 0.3),
                            alignItems: 'center',
                            justifyContent: 'center',
                          })}
                        >
                          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>−</Text>
                        </Pressable>
                        <Input
                          value={String(Math.round((weights[item.symbol] || 0) * 100) / 100)}
                          onChangeText={(val) => {
                            const num = parseFloat(val) || 0;
                            setWeight(item.symbol, num);
                          }}
                          keyboardType="decimal-pad"
                          style={{ flex: 1 }}
                        />
                        <Pressable
                          onPress={() => setWeight(item.symbol, (weights[item.symbol] || 0) + 5)}
                          style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: radius.md,
                            backgroundColor: withAlpha(border, pressed ? 0.5 : 0.3),
                            alignItems: 'center',
                            justifyContent: 'center',
                          })}
                        >
                          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Stats Grid */}
                    <View
                      style={{
                        padding: spacing.s12,
                        borderRadius: radius.md,
                        backgroundColor: withAlpha(text, isDark ? 0.06 : 0.04),
                        gap: spacing.s8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: muted, fontSize: 13 }}>Monthly amount</Text>
                        <Text style={{ color: onSurface, fontWeight: '700', fontSize: 14 }}>
                          {formatCurrency(item.amount)}
                        </Text>
                      </View>
                      {item.price > 0 && (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: muted, fontSize: 13 }}>Current price</Text>
                            <Text style={{ color: onSurface, fontWeight: '600', fontSize: 13 }}>
                              {formatCurrency(item.price)}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: muted, fontSize: 13 }}>Est. shares/month</Text>
                            <Text style={{ color: onSurface, fontWeight: '700', fontSize: 14 }}>
                              {item.qty.toFixed(3)}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: muted, fontSize: 13 }}>Est. shares/year</Text>
                            <Text style={{ color: accentPrimary, fontWeight: '800', fontSize: 14 }}>
                              {(item.qty * 12).toFixed(2)}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                </Card>
              ))}

              {/* Normalize Notice */}
              {(() => {
                const sum = Object.values(weights).reduce((a, b) => a + b, 0);
                const needsNormalization = Math.abs(sum - totalWeight) > 0.01;
                return needsNormalization ? (
                  <View
                    style={{
                      padding: spacing.s12,
                      borderRadius: radius.md,
                      backgroundColor: withAlpha(get('semantic.warning') as string, isDark ? 0.2 : 0.12),
                      flexDirection: 'row',
                      gap: spacing.s10,
                      alignItems: 'center',
                    }}
                  >
                    <Icon name="target" size={18} colorToken="semantic.warning" />
                    <Text style={{ color: onSurface, fontSize: 13, flex: 1, lineHeight: 18 }}>
                      Weights will be normalized to 100% when you save
                    </Text>
                  </View>
                ) : null;
              })()}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {symbols.length > 0 && (
          <View style={{ gap: spacing.s8 }}>
            <Button
              title="Save plan"
              onPress={onSave}
              disabled={monthlyAmount <= 0}
            />
            <Button
              title="Cancel"
              onPress={() => nav.goBack()}
              variant="secondary"
            />
          </View>
        )}

        {/* Info Card */}
        <Card style={{ backgroundColor: withAlpha(accentSecondary, isDark ? 0.12 : 0.08), padding: spacing.s16 }}>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <Icon name="target" size={20} colorToken="accent.secondary" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: text, fontWeight: '700', marginBottom: spacing.s6 }}>
                About DCA
              </Text>
              <Text style={{ color: muted, fontSize: 13, lineHeight: 19 }}>
                Dollar-cost averaging means investing a fixed amount regularly, regardless of market conditions.
                This reduces timing risk and builds discipline. Remember to review and rebalance quarterly.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
