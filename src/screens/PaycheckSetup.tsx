import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Switch, TextInput, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Screen } from '../components/Screen';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import Button from '../components/Button';
import { useIncomeSplittingStore } from '../store/incomeSplitting';
import { useAccountsStore } from '../store/accounts';
import { CPF_RATES_2025, AgeBracket } from '../types/incomeSplitting';

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

type StepProps = {
  stepNumber: number;
  title: string;
  description: string;
  children: React.ReactNode;
  isComplete: boolean;
};

const StepSection: React.FC<StepProps> = ({ stepNumber, title, description, children, isComplete }) => {
  const { get, isDark } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: radius.xl,
        padding: spacing.s20,
        borderWidth: 1,
        borderColor: isComplete ? successColor : border,
        gap: spacing.s16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: isComplete
              ? successColor
              : withAlpha(accentPrimary, isDark ? 0.2 : 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isComplete ? (
            <Icon name="check" size={20} color="white" />
          ) : (
            <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>
              {stepNumber}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
            {title}
          </Text>
          <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s2 }}>
            {description}
          </Text>
        </View>
      </View>

      {children}
    </View>
  );
};

const PaycheckSetup: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const { config, updateConfig, updateCPF, updateTax, createCPFAccounts, getCPFRatesForAge } =
    useIncomeSplittingStore();
  const { accounts } = useAccountsStore();

  // Step 1: CPF
  const [enableCPF, setEnableCPF] = useState(false);
  const [ageBracket, setAgeBracket] = useState<AgeBracket>('55-below');
  const [trackEmployer, setTrackEmployer] = useState(false);

  // Step 2: Tax
  const [enableTax, setEnableTax] = useState(false);
  const [taxFrequency, setTaxFrequency] = useState<'monthly' | 'annual'>('annual');
  const [monthlyTaxAmount, setMonthlyTaxAmount] = useState('');
  const [estimatedAnnualIncome, setEstimatedAnnualIncome] = useState('');

  // Step 3: Take-home account
  const [takeHomeAccount, setTakeHomeAccount] = useState('');

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const cardBg2 = get('surface.level2') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;
  const bgDefault = get('background.default') as string;

  const isStep1Complete = !enableCPF || (enableCPF && !!ageBracket);
  const isStep2Complete = !enableTax || (enableTax && (
    (taxFrequency === 'monthly' && parseFloat(monthlyTaxAmount) > 0) ||
    (taxFrequency === 'annual' && parseFloat(estimatedAnnualIncome) > 0)
  ));
  const isStep3Complete = !!takeHomeAccount;
  const canComplete = isStep1Complete && isStep2Complete && isStep3Complete;

  const handleComplete = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Create CPF accounts if enabled
      if (enableCPF) {
        await createCPFAccounts();
        await updateCPF({
          enabled: true,
          ageBracket,
          trackEmployer,
        });
        getCPFRatesForAge(ageBracket);
      }

      // Configure tax
      if (enableTax) {
        await updateTax({
          enabled: true,
          frequency: taxFrequency,
          monthly: {
            amount: taxFrequency === 'monthly' ? parseFloat(monthlyTaxAmount || '0') : 0,
            deductionDay: 1,
            fromAccount: takeHomeAccount,
          },
          annual: {
            estimatedAnnualIncome: taxFrequency === 'annual' ? parseFloat(estimatedAnnualIncome || '0') : 0,
            estimatedTax: 0, // Will be calculated by the store
            dueDate: '',
            fromAccount: takeHomeAccount,
            reminderDaysBefore: 30,
          },
        });
      }

      // Set take-home account
      const account = accounts.find((a) => a.name === takeHomeAccount);
      if (account) {
        await updateConfig({
          enabled: true,
          takeHomeAccountId: account.id,
          triggerCategories: ['Salary'],
        });
      }

      Alert.alert(
        'Setup complete!',
        'Your paycheck breakdown is ready. When you add salary income, it will be automatically split.',
        [
          {
            text: 'Got it',
            onPress: () => nav.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Setup error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  return (
    <Screen style={{ backgroundColor: bgDefault }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
      >
        {/* Header */}
        <View style={{ gap: spacing.s8 }}>
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
                Setup Paycheck
              </Text>
              <Text style={{ color: muted, fontSize: 14, marginTop: spacing.s4 }}>
                3 quick steps to get started
              </Text>
            </View>
          </View>
        </View>

        {/* Step 1: CPF */}
        <StepSection
          stepNumber={1}
          title="CPF Tracking"
          description="Track your CPF contributions"
          isComplete={isStep1Complete}
        >
          <View style={{ gap: spacing.s12 }}>
            {/* Enable toggle */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: spacing.s12,
                backgroundColor: cardBg2,
                borderRadius: radius.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontWeight: '600' }}>
                  Enable CPF tracking
                </Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                  Auto-create OA, SA, and Medisave accounts
                </Text>
              </View>
              <Switch
                value={enableCPF}
                onValueChange={setEnableCPF}
                trackColor={{ true: accentPrimary }}
              />
            </View>

            {enableCPF && (
              <>
                {/* Age bracket */}
                <View style={{ gap: spacing.s8 }}>
                  <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                    Your age bracket
                  </Text>
                  {['55-below', '56-60', '61-65', '66-70', '70-above'].map((bracket) => {
                    const rates = CPF_RATES_2025.find((r) => r.ageBracket === bracket);
                    const selected = ageBracket === bracket;
                    return (
                      <Pressable
                        key={bracket}
                        onPress={() => setAgeBracket(bracket as AgeBracket)}
                        style={({ pressed }) => ({
                          padding: spacing.s12,
                          borderRadius: radius.md,
                          backgroundColor: selected
                            ? withAlpha(accentPrimary, 0.12)
                            : cardBg2,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? accentPrimary : border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                            <Text style={{ color: text, fontWeight: '600' }}>
                              {bracket === '55-below' ? '55 & below' : bracket === '70-above' ? '70 & above' : `Age ${bracket}`}
                            </Text>
                            {rates && (
                              <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                                {rates.employeeRate + rates.employerRate}% total ({rates.employeeRate}% employee + {rates.employerRate}% employer)
                              </Text>
                            )}
                          </View>
                          {selected && (
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: radius.pill,
                                backgroundColor: accentPrimary,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icon name="check" size={14} color="white" />
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Track employer */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: spacing.s12,
                    backgroundColor: cardBg2,
                    borderRadius: radius.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: text, fontWeight: '600' }}>
                      Track employer contributions
                    </Text>
                    <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                      Include employer CPF in your accounts
                    </Text>
                  </View>
                  <Switch
                    value={trackEmployer}
                    onValueChange={setTrackEmployer}
                    trackColor={{ true: accentPrimary }}
                  />
                </View>
              </>
            )}
          </View>
        </StepSection>

        {/* Step 2: Tax */}
        <StepSection
          stepNumber={2}
          title="Income Tax"
          description="Plan for tax payments"
          isComplete={isStep2Complete}
        >
          <View style={{ gap: spacing.s12 }}>
            {/* Enable toggle */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: spacing.s12,
                backgroundColor: cardBg2,
                borderRadius: radius.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontWeight: '600' }}>
                  Enable tax tracking
                </Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                  Estimate and plan for tax payments
                </Text>
              </View>
              <Switch
                value={enableTax}
                onValueChange={setEnableTax}
                trackColor={{ true: accentPrimary }}
              />
            </View>

            {enableTax && (
              <>
                {/* Frequency */}
                <View style={{ gap: spacing.s8 }}>
                  <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                    Payment frequency
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                    {[
                      { value: 'monthly', label: 'Monthly', description: 'Deduct each month' },
                      { value: 'annual', label: 'Annual', description: 'Pay once a year (most common in SG)' },
                    ].map((option) => {
                      const selected = taxFrequency === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => setTaxFrequency(option.value as any)}
                          style={({ pressed }) => ({
                            flex: 1,
                            padding: spacing.s12,
                            borderRadius: radius.md,
                            backgroundColor: selected
                              ? withAlpha(accentPrimary, 0.12)
                              : cardBg2,
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected ? accentPrimary : border,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                            {option.label}
                          </Text>
                          <Text style={{ color: muted, fontSize: 11, marginTop: spacing.s4 }}>
                            {option.description}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Monthly amount */}
                {taxFrequency === 'monthly' && (
                  <View style={{ gap: spacing.s6 }}>
                    <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                      Monthly tax amount
                    </Text>
                    <TextInput
                      value={monthlyTaxAmount}
                      onChangeText={setMonthlyTaxAmount}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      placeholderTextColor={muted}
                      style={{
                        padding: spacing.s12,
                        borderRadius: radius.md,
                        backgroundColor: cardBg2,
                        color: text,
                        fontSize: 16,
                        fontWeight: '600',
                        borderWidth: 1,
                        borderColor: border,
                      }}
                    />
                  </View>
                )}

                {/* Annual income estimate */}
                {taxFrequency === 'annual' && (
                  <View style={{ gap: spacing.s6 }}>
                    <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                      Estimated annual income
                    </Text>
                    <TextInput
                      value={estimatedAnnualIncome}
                      onChangeText={setEstimatedAnnualIncome}
                      placeholder="60000"
                      keyboardType="decimal-pad"
                      placeholderTextColor={muted}
                      style={{
                        padding: spacing.s12,
                        borderRadius: radius.md,
                        backgroundColor: cardBg2,
                        color: text,
                        fontSize: 16,
                        fontWeight: '600',
                        borderWidth: 1,
                        borderColor: border,
                      }}
                    />
                    <Text style={{ color: muted, fontSize: 12 }}>
                      We'll calculate your estimated tax based on IRAS 2025 brackets
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </StepSection>

        {/* Step 3: Take-home account */}
        <StepSection
          stepNumber={3}
          title="Take-Home Account"
          description="Where your net salary goes"
          isComplete={isStep3Complete}
        >
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
              Select account
            </Text>
            {accounts.filter((a) => a.kind === 'checking' || a.kind === 'savings').map((account) => {
              const selected = takeHomeAccount === account.name;
              return (
                <Pressable
                  key={account.id}
                  onPress={() => setTakeHomeAccount(account.name)}
                  style={({ pressed }) => ({
                    padding: spacing.s12,
                    borderRadius: radius.md,
                    backgroundColor: selected
                      ? withAlpha(accentPrimary, 0.12)
                      : cardBg2,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? accentPrimary : border,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ color: text, fontWeight: '600' }}>
                        {account.name}
                      </Text>
                      <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                        {account.institution || account.kind}
                      </Text>
                    </View>
                    {selected && (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: radius.pill,
                          backgroundColor: accentPrimary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="check" size={14} color="white" />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}

            {accounts.filter((a) => a.kind === 'checking' || a.kind === 'savings').length === 0 && (
              <View
                style={{
                  padding: spacing.s16,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(muted, 0.1),
                  gap: spacing.s8,
                }}
              >
                <Text style={{ color: muted, textAlign: 'center' }}>
                  No checking or savings accounts found
                </Text>
                <Button
                  title="Add account"
                  onPress={() => nav.navigate('AddAccount')}
                  variant="secondary"
                  size="sm"
                />
              </View>
            )}
          </View>
        </StepSection>

        {/* Complete button */}
        <Button
          title="Complete setup"
          onPress={handleComplete}
          disabled={!canComplete}
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
};

export default PaycheckSetup;
