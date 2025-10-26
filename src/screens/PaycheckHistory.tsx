import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '../components/Screen';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import { Card } from '../components/Card';
import { useIncomeSplittingStore } from '../store/incomeSplitting';
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

const PaycheckHistory: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const { splitHistory } = useIncomeSplittingStore();

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const cardBg = get('surface.level1') as string;
  const cardBg2 = get('surface.level2') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;
  const bgDefault = get('background.default') as string;

  // Group by month
  const groupedHistory = useMemo(() => {
    const groups: Record<string, typeof splitHistory> = {};

    splitHistory.forEach((split) => {
      const date = new Date(split.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(split);
    });

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, splits]) => ({
        key,
        label: new Date(splits[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        splits: splits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        totalGross: splits.reduce((sum, s) => sum + s.grossAmount, 0),
        totalNet: splits.reduce((sum, s) => sum + s.netAmount, 0),
        totalCPF: splits.reduce((sum, s) => sum + s.cpf.employee.total + (s.cpf.employer?.total || 0), 0),
        totalTax: splits.reduce((sum, s) => sum + s.tax, 0),
      }));
  }, [splitHistory]);

  if (splitHistory.length === 0) {
    return (
      <Screen style={{ backgroundColor: bgDefault }}>
        <View style={{ flex: 1, padding: spacing.s16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginBottom: spacing.s24 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: radius.lg,
                backgroundColor: cardBg,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon name="chevron-left" size={20} color={text} />
            </Pressable>
            <Text style={{ color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }}>
              History
            </Text>
          </View>

          {/* Empty state */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.s16 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: radius.xl,
                backgroundColor: withAlpha(muted, 0.1),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="history" size={40} color={muted} />
            </View>
            <Text style={{ color: text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
              No paycheck history
            </Text>
            <Text style={{ color: muted, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>
              When you add salary income, your paycheck splits will appear here
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundColor: bgDefault }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              backgroundColor: cardBg,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="chevron-left" size={20} color={text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }}>
              History
            </Text>
            <Text style={{ color: muted, fontSize: 14, marginTop: spacing.s4 }}>
              {splitHistory.length} paycheck{splitHistory.length === 1 ? '' : 's'} split
            </Text>
          </View>
        </View>

        {/* Grouped history */}
        {groupedHistory.map((group, groupIdx) => (
          <View key={group.key} style={{ gap: spacing.s12 }}>
            {/* Month header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
                {group.label}
              </Text>
              <Text style={{ color: muted, fontSize: 13 }}>
                {group.splits.length} paycheck{group.splits.length === 1 ? '' : 's'}
              </Text>
            </View>

            {/* Month summary */}
            <Card
              style={{
                padding: spacing.s16,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.12 : 0.06),
                borderWidth: 1,
                borderColor: withAlpha(accentPrimary, 0.3),
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>
                    GROSS
                  </Text>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginTop: spacing.s4 }}>
                    {formatCurrency(group.totalGross)}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>
                    CPF
                  </Text>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginTop: spacing.s4 }}>
                    {formatCurrency(group.totalCPF)}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>
                    TAX
                  </Text>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginTop: spacing.s4 }}>
                    {formatCurrency(group.totalTax)}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>
                    NET
                  </Text>
                  <Text style={{ color: successColor, fontSize: 16, fontWeight: '700', marginTop: spacing.s4 }}>
                    {formatCurrency(group.totalNet)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Individual paychecks */}
            {group.splits.map((split, idx) => (
              <Animated.View
                key={split.id}
                entering={FadeInDown.delay(idx * 50)}
              >
                <Card
                  style={{
                    padding: spacing.s16,
                    backgroundColor: cardBg,
                    borderWidth: 1,
                    borderColor: border,
                    gap: spacing.s12,
                  }}
                >
                  {/* Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>
                        {new Date(split.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                        {split.source}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>
                        GROSS
                      </Text>
                      <Text style={{ color: text, fontSize: 18, fontWeight: '800', marginTop: spacing.s2 }}>
                        {formatCurrency(split.grossAmount)}
                      </Text>
                    </View>
                  </View>

                  {/* Breakdown */}
                  <View style={{ gap: spacing.s6 }}>
                    {split.cpf.employee.total > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: radius.sm,
                              backgroundColor: withAlpha(accentPrimary, 0.15),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon name="piggy-bank" size={12} color={accentPrimary} />
                          </View>
                          <Text style={{ color: onSurface, fontSize: 13 }}>
                            CPF
                          </Text>
                        </View>
                        <Text style={{ color: text, fontSize: 13, fontWeight: '600' }}>
                          -{formatCurrency(split.cpf.employee.total + (split.cpf.employer?.total || 0))}
                        </Text>
                      </View>
                    )}

                    {split.tax > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: radius.sm,
                              backgroundColor: withAlpha(warningColor, 0.15),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon name="receipt" size={12} color={warningColor} />
                          </View>
                          <Text style={{ color: onSurface, fontSize: 13 }}>
                            Tax
                          </Text>
                        </View>
                        <Text style={{ color: text, fontSize: 13, fontWeight: '600' }}>
                          -{formatCurrency(split.tax)}
                        </Text>
                      </View>
                    )}

                    {split.otherDeductions.map((deduction, dIdx) => (
                      <View
                        key={dIdx}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: radius.sm,
                              backgroundColor: withAlpha(muted, 0.15),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon name="minus" size={12} color={muted} />
                          </View>
                          <Text style={{ color: onSurface, fontSize: 13 }}>
                            {deduction.name}
                          </Text>
                        </View>
                        <Text style={{ color: text, fontSize: 13, fontWeight: '600' }}>
                          -{formatCurrency(deduction.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Net amount */}
                  <View style={{ height: 1, backgroundColor: border }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>
                      TAKE-HOME
                    </Text>
                    <Text style={{ color: successColor, fontSize: 18, fontWeight: '800' }}>
                      {formatCurrency(split.netAmount)}
                    </Text>
                  </View>
                </Card>
              </Animated.View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
};

export default PaycheckHistory;
