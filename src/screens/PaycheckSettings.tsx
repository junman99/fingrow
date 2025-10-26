import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Switch, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { Card } from '../components/Card';
import BottomSheet from '../components/BottomSheet';
import { useIncomeSplittingStore } from '../store/incomeSplitting';
import { useAccountsStore } from '../store/accounts';
import { CPF_RATES_2025, AgeBracket, SG_TAX_BRACKETS_2025 } from '../types/incomeSplitting';
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

const PaycheckSettings: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const {
    config,
    updateConfig,
    updateCPF,
    updateTax,
    getCPFRatesForAge,
    calculateAnnualTax,
    reset,
  } = useIncomeSplittingStore();
  const { accounts } = useAccountsStore();

  const [showTaxCalculator, setShowTaxCalculator] = useState(false);
  const [calculatorIncome, setCalculatorIncome] = useState('');

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const cardBg = get('surface.level1') as string;
  const cardBg2 = get('surface.level2') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const warningColor = get('semantic.warning') as string;
  const successColor = get('semantic.success') as string;
  const bgDefault = get('background.default') as string;

  const calculatedTax = useMemo(() => {
    const income = parseFloat(calculatorIncome || '0');
    if (income <= 0) return 0;
    return calculateAnnualTax(income);
  }, [calculatorIncome, calculateAnnualTax]);

  const taxBreakdown = useMemo(() => {
    const income = parseFloat(calculatorIncome || '0');
    if (income <= 0) return [];

    const breakdown: Array<{ bracket: string; amount: number; rate: number }> = [];
    let remaining = income;

    for (let i = 0; i < SG_TAX_BRACKETS_2025.length && remaining > 0; i++) {
      const bracket = SG_TAX_BRACKETS_2025[i];
      const taxableInBracket = Math.min(
        remaining,
        bracket.to === Infinity ? remaining : bracket.to - bracket.from + 1
      );

      if (taxableInBracket > 0 && bracket.rate > 0) {
        breakdown.push({
          bracket: bracket.to === Infinity
            ? `Above ${formatCurrency(bracket.from)}`
            : `${formatCurrency(bracket.from)} - ${formatCurrency(bracket.to)}`,
          amount: (taxableInBracket * bracket.rate) / 100,
          rate: bracket.rate,
        });
      }

      remaining -= taxableInBracket;
    }

    return breakdown;
  }, [calculatorIncome]);

  const handleDisable = () => {
    Alert.alert(
      'Disable paycheck breakdown?',
      'Your configuration and history will be preserved but auto-split will stop.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await updateConfig({ enabled: false });
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            nav.goBack();
          },
        },
      ]
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Reset all data?',
      'This will delete all paycheck configurations and history. CPF accounts will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await reset();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            nav.goBack();
          },
        },
      ]
    );
  };

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingBottom: spacing.s32 }}
    >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginBottom: spacing.s20 }}>
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
              Settings
            </Text>
            <Text style={{ color: muted, fontSize: 14, marginTop: spacing.s4 }}>
              Configure your paycheck breakdown
            </Text>
          </View>
        </View>

        {/* Recurring Paycheck Settings */}
        <View style={{ gap: spacing.s12, marginBottom: spacing.s20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Icon name="calendar" size={20} color={accentPrimary} />
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              Recurring Paycheck
            </Text>
          </View>

          <Card style={{ backgroundColor: cardBg, padding: spacing.s16, gap: spacing.s16 }}>
            {/* Enable Recurring */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontWeight: '600' }}>Enable recurring paycheck</Text>
                <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
                  Automatically record your paycheck on a schedule
                </Text>
              </View>
              <Switch
                value={config.recurring?.enabled || false}
                onValueChange={async (value) => {
                  await updateConfig({
                    recurring: {
                      enabled: value,
                      frequency: config.recurring?.frequency || 'monthly',
                      dayOfMonth: config.recurring?.dayOfMonth || 1,
                      amount: config.recurring?.amount || 0,
                      autoRecord: config.recurring?.autoRecord || false,
                    },
                  });
                  if (value) {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                }}
              />
            </View>

            {config.recurring?.enabled && (
              <>
                {/* Frequency */}
                <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: spacing.s16 }}>
                  <Text style={{ color: text, fontWeight: '600', marginBottom: spacing.s12 }}>Frequency</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                    {(['monthly', 'biweekly', 'weekly'] as const).map((freq) => (
                      <Pressable
                        key={freq}
                        onPress={async () => {
                          await updateConfig({
                            recurring: {
                              ...config.recurring!,
                              frequency: freq,
                            },
                          });
                          await Haptics.selectionAsync();
                        }}
                        style={{
                          flex: 1,
                          padding: spacing.s12,
                          borderRadius: radius.md,
                          borderWidth: 2,
                          borderColor: config.recurring?.frequency === freq ? accentPrimary : border,
                          backgroundColor: config.recurring?.frequency === freq
                            ? withAlpha(accentPrimary, 0.1)
                            : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            color: config.recurring?.frequency === freq ? accentPrimary : text,
                            fontWeight: '600',
                            textAlign: 'center',
                            textTransform: 'capitalize',
                          }}
                        >
                          {freq}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Day Selection for Monthly */}
                {config.recurring.frequency === 'monthly' && (
                  <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: spacing.s16 }}>
                    <Text style={{ color: text, fontWeight: '600', marginBottom: spacing.s8 }}>Day of month</Text>
                    <TextInput
                      value={String(config.recurring?.dayOfMonth || 1)}
                      onChangeText={(value) => {
                        const day = Math.max(1, Math.min(31, parseInt(value) || 1));
                        updateConfig({
                          recurring: {
                            ...config.recurring!,
                            dayOfMonth: day,
                          },
                        });
                      }}
                      keyboardType="number-pad"
                      placeholder="1-31"
                      placeholderTextColor={muted}
                      style={{
                        backgroundColor: cardBg2,
                        borderRadius: radius.md,
                        padding: spacing.s12,
                        color: text,
                        fontSize: 16,
                        fontWeight: '600',
                        borderWidth: 1,
                        borderColor: border,
                      }}
                    />
                    <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s6 }}>
                      Your paycheck will be recorded on day {config.recurring?.dayOfMonth || 1} of each month
                    </Text>
                  </View>
                )}

                {/* Paycheck Amount */}
                <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: spacing.s16 }}>
                  <Text style={{ color: text, fontWeight: '600', marginBottom: spacing.s8 }}>Gross salary amount</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: cardBg2,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: border,
                      paddingHorizontal: spacing.s12,
                    }}
                  >
                    <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>$</Text>
                    <TextInput
                      value={String(config.recurring?.amount || '')}
                      onChangeText={(value) => {
                        const amount = parseFloat(value) || 0;
                        updateConfig({
                          recurring: {
                            ...config.recurring!,
                            amount,
                          },
                        });
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={muted}
                      style={{
                        flex: 1,
                        padding: spacing.s12,
                        color: text,
                        fontSize: 18,
                        fontWeight: '700',
                        textAlign: 'right',
                      }}
                    />
                  </View>
                </View>

                {/* Auto Record */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: border, paddingTop: spacing.s16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: text, fontWeight: '600' }}>Auto-record</Text>
                    <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
                      Automatically create the paycheck split on the scheduled date
                    </Text>
                  </View>
                  <Switch
                    value={config.recurring?.autoRecord || false}
                    onValueChange={async (value) => {
                      await updateConfig({
                        recurring: {
                          ...config.recurring!,
                          autoRecord: value,
                        },
                      });
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                  />
                </View>
              </>
            )}
          </Card>
        </View>

        {/* CPF Settings */}
        <View style={{ gap: spacing.s12, marginBottom: spacing.s20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Icon name="piggy-bank" size={20} color={accentPrimary} />
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              CPF Settings
            </Text>
          </View>

          <Card style={{ padding: spacing.s16, gap: spacing.s12 }}>
            {/* Enable CPF */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: spacing.s8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontWeight: '600' }}>
                  CPF Tracking
                </Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                  Track contributions to OA, SA, and Medisave
                </Text>
              </View>
              <Switch
                value={config.cpf.enabled}
                onValueChange={(v) => updateCPF({ enabled: v })}
                trackColor={{ true: accentPrimary }}
              />
            </View>

            {config.cpf.enabled && (
              <>
                <View style={{ height: 1, backgroundColor: border }} />

                {/* Age bracket */}
                <View style={{ gap: spacing.s8 }}>
                  <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                    Age Bracket
                  </Text>
                  <View style={{ gap: spacing.s6 }}>
                    {CPF_RATES_2025.slice(0, 3).map((rate) => (
                      <Pressable
                        key={rate.ageBracket}
                        onPress={() => getCPFRatesForAge(rate.ageBracket)}
                        style={({ pressed }) => ({
                          padding: spacing.s10,
                          borderRadius: radius.md,
                          backgroundColor: config.cpf.ageBracket === rate.ageBracket
                            ? withAlpha(accentPrimary, 0.12)
                            : cardBg2,
                          borderWidth: config.cpf.ageBracket === rate.ageBracket ? 2 : 1,
                          borderColor: config.cpf.ageBracket === rate.ageBracket ? accentPrimary : border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                            <Text style={{ color: text, fontWeight: '600', fontSize: 13 }}>
                              {rate.ageBracket === '55-below' ? '55 & below' : `Age ${rate.ageBracket}`}
                            </Text>
                            <Text style={{ color: muted, fontSize: 11, marginTop: spacing.s2 }}>
                              {rate.employeeRate}% employee + {rate.employerRate}% employer
                            </Text>
                          </View>
                          {config.cpf.ageBracket === rate.ageBracket && (
                            <Icon name="check" size={16} color={accentPrimary} />
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: border }} />

                {/* Track employer */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: spacing.s8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: text, fontWeight: '600' }}>
                      Track Employer CPF
                    </Text>
                    <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                      Include employer contributions in accounts
                    </Text>
                  </View>
                  <Switch
                    value={config.cpf.trackEmployer}
                    onValueChange={(v) => updateCPF({ trackEmployer: v })}
                    trackColor={{ true: accentPrimary }}
                  />
                </View>

                <View style={{ height: 1, backgroundColor: border }} />

                {/* Current rates display */}
                <View
                  style={{
                    padding: spacing.s12,
                    borderRadius: radius.md,
                    backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08),
                  }}
                >
                  <Text style={{ color: text, fontWeight: '600', fontSize: 13, marginBottom: spacing.s8 }}>
                    Current Rates
                  </Text>
                  <View style={{ gap: spacing.s4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: muted, fontSize: 12 }}>Total contribution</Text>
                      <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>
                        {config.cpf.employeeRate + config.cpf.employerRate}%
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: muted, fontSize: 12 }}>Monthly ceiling</Text>
                      <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>
                        {formatCurrency(config.cpf.monthlyCeiling)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: muted, fontSize: 12 }}>Annual ceiling</Text>
                      <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>
                        {formatCurrency(config.cpf.annualCeiling)}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </Card>
        </View>

        {/* Tax Settings */}
        <View style={{ gap: spacing.s12, marginBottom: spacing.s20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Icon name="receipt" size={20} color={warningColor} />
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              Tax Settings
            </Text>
          </View>

          <Card style={{ padding: spacing.s16, gap: spacing.s12 }}>
            {/* Enable tax */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: spacing.s8,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontWeight: '600' }}>
                  Tax Tracking
                </Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                  Estimate and plan for tax payments
                </Text>
              </View>
              <Switch
                value={config.tax.enabled}
                onValueChange={(v) => updateTax({ enabled: v })}
                trackColor={{ true: accentPrimary }}
              />
            </View>

            {config.tax.enabled && (
              <>
                <View style={{ height: 1, backgroundColor: border }} />

                {/* Frequency */}
                <View style={{ gap: spacing.s8 }}>
                  <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                    Payment Frequency
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                    {[
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'annual', label: 'Annual (Most Common)' },
                    ].map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => updateTax({ frequency: option.value as any })}
                        style={({ pressed }) => ({
                          flex: 1,
                          padding: spacing.s10,
                          borderRadius: radius.md,
                          backgroundColor: config.tax.frequency === option.value
                            ? withAlpha(accentPrimary, 0.12)
                            : cardBg2,
                          borderWidth: config.tax.frequency === option.value ? 2 : 1,
                          borderColor: config.tax.frequency === option.value ? accentPrimary : border,
                          opacity: pressed ? 0.7 : 1,
                          alignItems: 'center',
                        })}
                      >
                        <Text style={{ color: text, fontWeight: '600', fontSize: 13 }}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: border }} />

                {/* Tax calculator button */}
                <Pressable
                  onPress={() => setShowTaxCalculator(true)}
                  style={({ pressed }) => ({
                    padding: spacing.s12,
                    borderRadius: radius.md,
                    backgroundColor: withAlpha(warningColor, isDark ? 0.15 : 0.08),
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: radius.sm,
                        backgroundColor: warningColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="calculator" size={18} color="white" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: text, fontWeight: '600' }}>
                        Tax Calculator
                      </Text>
                      <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                        Estimate your annual tax using IRAS 2025 brackets
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={muted} />
                  </View>
                </Pressable>
              </>
            )}
          </Card>
        </View>

        {/* Take-home account */}
        <View style={{ gap: spacing.s12, marginBottom: spacing.s20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Icon name="wallet" size={20} color={successColor} />
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              Take-Home Account
            </Text>
          </View>

          <Card style={{ padding: spacing.s16 }}>
            <Text style={{ color: text, fontWeight: '600', marginBottom: spacing.s8 }}>
              Net salary deposited to
            </Text>
            <Text style={{ color: muted, fontSize: 13 }}>
              {accounts.find((a) => a.id === config.takeHomeAccountId)?.name || 'Not set'}
            </Text>
          </Card>
        </View>

        {/* Danger zone */}
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
            Danger Zone
          </Text>

          <View style={{ gap: spacing.s8 }}>
            <Button
              title="Disable paycheck breakdown"
              onPress={handleDisable}
              variant="secondary"
            />
            <Button
              title="Reset all data"
              onPress={handleReset}
              variant="secondary"
            />
          </View>
        </View>

      {/* Tax Calculator Sheet */}
      <BottomSheet
        visible={showTaxCalculator}
        onClose={() => setShowTaxCalculator(false)}
        fullHeight
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.s16, gap: spacing.s16 }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={{ color: text, fontSize: 24, fontWeight: '700' }}>
              Tax Calculator
            </Text>
            <Text style={{ color: muted, marginTop: spacing.s4 }}>
              IRAS Year of Assessment 2025
            </Text>
          </View>

          {/* Income input */}
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
              Annual Income
            </Text>
            <TextInput
              value={calculatorIncome}
              onChangeText={setCalculatorIncome}
              placeholder="60000"
              keyboardType="decimal-pad"
              placeholderTextColor={muted}
              style={{
                padding: spacing.s16,
                borderRadius: radius.lg,
                backgroundColor: cardBg,
                color: text,
                fontSize: 20,
                fontWeight: '700',
                borderWidth: 1,
                borderColor: border,
              }}
            />
          </View>

          {/* Result */}
          {parseFloat(calculatorIncome || '0') > 0 && (
            <>
              <Card
                style={{
                  padding: spacing.s20,
                  backgroundColor: withAlpha(warningColor, isDark ? 0.15 : 0.08),
                  borderWidth: 2,
                  borderColor: warningColor,
                }}
              >
                <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>
                  ESTIMATED TAX
                </Text>
                <Text style={{ color: text, fontSize: 36, fontWeight: '800', marginTop: spacing.s4 }}>
                  {formatCurrency(calculatedTax)}
                </Text>
                <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s8 }}>
                  {formatCurrency(calculatedTax / 12)}/month if paid monthly
                </Text>
              </Card>

              {/* Breakdown */}
              <View style={{ gap: spacing.s8 }}>
                <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                  Tax Breakdown by Bracket
                </Text>
                {taxBreakdown.map((item, idx) => (
                  <View
                    key={idx}
                    style={{
                      padding: spacing.s12,
                      borderRadius: radius.md,
                      backgroundColor: cardBg,
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: text, fontWeight: '600', fontSize: 13 }}>
                          {item.bracket}
                        </Text>
                        <Text style={{ color: muted, fontSize: 11, marginTop: spacing.s2 }}>
                          {item.rate}% tax rate
                        </Text>
                      </View>
                      <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>
                        {formatCurrency(item.amount)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View
                style={{
                  padding: spacing.s12,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(muted, 0.1),
                }}
              >
                <Text style={{ color: muted, fontSize: 12, lineHeight: 18 }}>
                  💡 This is an estimate based on IRAS 2025 tax brackets. Actual tax may vary based on reliefs, deductions, and other factors.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </BottomSheet>
    </ScreenScroll>
  );
};

export default PaycheckSettings;
