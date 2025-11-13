import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions, Platform, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import { Card } from '../components/Card';
import Button from '../components/Button';
import { useIncomeSplittingStore } from '../store/incomeSplitting';
import { useTxStore } from '../store/transactions';
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
  disabled?: boolean;
}> = ({ onPress, children, style, disabled }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
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

const PaycheckBreakdown: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { get, isDark } = useThemeTokens();
  const { config, splitHistory, hydrate, createCPFAccounts, processIncomeSplit } = useIncomeSplittingStore();
  const { transactions } = useTxStore();
  const { accounts } = useAccountsStore();

  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    // Check if setup is complete
    const hasConfig = config.enabled;
    const hasCPFAccounts = config.cpf.enabled ? !!config.cpf.cpfOaAccountId : true;
    const hasTakeHomeAccount = !!config.takeHomeAccountId;
    setSetupComplete(hasConfig && hasCPFAccounts && hasTakeHomeAccount);
  }, [config]);

  // Calculate recent paycheck data
  const recentSplit = useMemo(() => {
    if (splitHistory.length === 0) return null;
    return splitHistory[splitHistory.length - 1];
  }, [splitHistory]);

  // Calculate YTD totals
  const ytdData = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const ytdSplits = splitHistory.filter((s) => new Date(s.date) >= yearStart);

    const totalGross = ytdSplits.reduce((sum, s) => sum + s.grossAmount, 0);
    const totalCPF = ytdSplits.reduce((sum, s) => sum + s.cpf.employee.total + (s.cpf.employer?.total || 0), 0);
    const totalTax = ytdSplits.reduce((sum, s) => sum + s.tax, 0);
    const totalNet = ytdSplits.reduce((sum, s) => sum + s.netAmount, 0);

    return { totalGross, totalCPF, totalTax, totalNet, count: ytdSplits.length };
  }, [splitHistory]);

  // Estimate annual tax
  const estimatedAnnualTax = useMemo(() => {
    if (!config.tax.enabled || config.tax.frequency !== 'annual') return 0;

    // Use manual override or calculate from estimated income
    if (config.tax.annual.manualTaxOverride) {
      return config.tax.annual.manualTaxOverride;
    }

    return config.tax.annual.estimatedTax || 0;
  }, [config.tax]);

  // CPF Accounts
  const cpfAccounts = useMemo(() => {
    if (!config.cpf.enabled) return [];

    return [
      {
        name: 'Ordinary Account',
        id: config.cpf.cpfOaAccountId,
        balance: accounts.find((a) => a.id === config.cpf.cpfOaAccountId)?.balance || 0,
        icon: 'home' as const,
        color: '#5B9A8B',
        description: 'Housing, education, investments',
      },
      {
        name: 'Special Account',
        id: config.cpf.cpfSaAccountId,
        balance: accounts.find((a) => a.id === config.cpf.cpfSaAccountId)?.balance || 0,
        icon: 'trending-up' as const,
        color: '#D4735E',
        description: 'Retirement savings',
      },
      {
        name: 'Medisave',
        id: config.cpf.cpfMaAccountId,
        balance: accounts.find((a) => a.id === config.cpf.cpfMaAccountId)?.balance || 0,
        icon: 'heart' as const,
        color: '#88AB8E',
        description: 'Healthcare expenses',
      },
    ].filter((a) => a.id);
  }, [config.cpf, accounts]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const onPrimary = get('text.onPrimary') as string;
  const cardBg = get('surface.level1') as string;
  const cardBg2 = get('surface.level2') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;
  const bgDefault = get('background.default') as string;

  // Main Tab Title Animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Original title animation (fades out)
  const originalTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity: 1 - progress,
    };
  });

  // Floating title animation (fades in)
  const floatingTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity: progress >= 1 ? 1 : progress,
    };
  });

  // Gradient background animation
  const gradientAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity: progress >= 1 ? 1 : progress,
    };
  });

  // Removed entrance animations for cleaner navigation experience

  // State for manual calculator
  const [calculatorAmount, setCalculatorAmount] = useState('');

  // Animation for breakdown appearance - simple fade in from top
  const breakdownOpacity = useSharedValue(0);
  const breakdownTranslateY = useSharedValue(-20);

  // Animate breakdown when it appears/disappears
  useEffect(() => {
    if (calculatorAmount && parseFloat(calculatorAmount) > 0) {
      breakdownOpacity.value = withTiming(1, { duration: 400 });
      breakdownTranslateY.value = withTiming(0, { duration: 400 });
    } else {
      breakdownOpacity.value = withTiming(0, { duration: 200 });
      breakdownTranslateY.value = withTiming(-20, { duration: 200 });
    }
  }, [calculatorAmount]);

  const breakdownAnimatedStyle = useAnimatedStyle(() => ({
    opacity: breakdownOpacity.value,
    transform: [
      {
        translateY: breakdownTranslateY.value,
      },
    ],
  }));

  // Calculate breakdown from manual input
  const calculatedBreakdown = useMemo(() => {
    const gross = parseFloat(calculatorAmount || '0');
    if (gross <= 0) return null;

    let cpfEmployee = { oa: 0, sa: 0, ma: 0, total: 0 };
    let cpfEmployer = { oa: 0, sa: 0, ma: 0, total: 0 };

    if (config.cpf.enabled) {
      const employeeContribution = Math.min(
        (gross * config.cpf.employeeRate) / 100,
        (config.cpf.monthlyCeiling * config.cpf.employeeRate) / 100
      );

      cpfEmployee = {
        oa: (employeeContribution * config.cpf.oaRate) / 100,
        sa: (employeeContribution * config.cpf.saRate) / 100,
        ma: (employeeContribution * config.cpf.maRate) / 100,
        total: employeeContribution,
      };

      if (config.cpf.trackEmployer) {
        const employerContribution = Math.min(
          (gross * config.cpf.employerRate) / 100,
          (config.cpf.monthlyCeiling * config.cpf.employerRate) / 100
        );

        cpfEmployer = {
          oa: (employerContribution * config.cpf.employerOaRate) / 100,
          sa: (employerContribution * config.cpf.employerSaRate) / 100,
          ma: (employerContribution * config.cpf.employerMaRate) / 100,
          total: employerContribution,
        };
      }
    }

    const tax = config.tax.enabled && config.tax.frequency === 'monthly' ? config.tax.monthly.amount : 0;
    const net = gross - cpfEmployee.total - tax;

    return { gross, cpfEmployee, cpfEmployer, tax, net };
  }, [calculatorAmount, config]);

  if (!setupComplete) {
    return (
      <>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              width: '100%',
            },
            gradientAnimatedStyle,
          ]}
        >
          <LinearGradient
            colors={[
              bgDefault,
              bgDefault,
              withAlpha(bgDefault, 0.95),
              withAlpha(bgDefault, 0.8),
              withAlpha(bgDefault, 0.5),
              withAlpha(bgDefault, 0),
            ]}
            style={{
              paddingTop: insets.top + spacing.s16,
              paddingBottom: spacing.s20,
            }}
          >
            <Animated.Text
              style={[
                {
                  fontSize: 20,
                  fontWeight: '700',
                  color: text,
                  textAlign: 'center',
                },
                floatingTitleAnimatedStyle,
              ]}
            >
              Paycheck Breakdown
            </Animated.Text>
          </LinearGradient>
        </Animated.View>
        <ScreenScroll
          inTab
          fullScreen
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentStyle={{
            paddingHorizontal: spacing.s16,
            paddingTop: insets.top + spacing.s24,
            paddingBottom: spacing.s32,
            gap: spacing.s24,
          }}
        >
          {/* Header */}
          <Animated.View style={[{ gap: spacing.s8 }, { opacity: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s8 }}>
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
                <Animated.Text
                  style={[
                    { color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.s2 },
                    originalTitleAnimatedStyle,
                  ]}
                >
                  Paycheck Breakdown
                </Animated.Text>
              </View>
            </View>
          </Animated.View>

        {/* Welcome Card */}
        <Card style={{ padding: spacing.s20, backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08), borderWidth: 2, borderColor: accentPrimary }}>
          <View style={{ gap: spacing.s16 }}>
            <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.lg,
                  backgroundColor: accentPrimary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="sparkles" size={24} color={onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
                  Let's set up your paycheck
                </Text>
                <Text style={{ color: muted, fontSize: 14, marginTop: spacing.s6, lineHeight: 20 }}>
                  Automatically track CPF, tax, and deductions. See exactly where your money goes each month.
                </Text>
              </View>
            </View>

            <View style={{ gap: spacing.s8 }}>
              <View style={{ flexDirection: 'row', gap: spacing.s8, alignItems: 'center' }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(successColor, 0.15),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={12} color={successColor} />
                </View>
                <Text style={{ color: onSurface, fontSize: 14, flex: 1 }}>
                  Auto-create CPF accounts (OA, SA, Medisave)
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.s8, alignItems: 'center' }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(successColor, 0.15),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={12} color={successColor} />
                </View>
                <Text style={{ color: onSurface, fontSize: 14, flex: 1 }}>
                  Calculate annual tax projections
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.s8, alignItems: 'center' }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(successColor, 0.15),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={12} color={successColor} />
                </View>
                <Text style={{ color: onSurface, fontSize: 14, flex: 1 }}>
                  Track every dollar from gross to net
                </Text>
              </View>
            </View>

            <Button
              title="Start setup"
              onPress={() => nav.navigate('PaycheckSetup')}
              size="lg"
            />
          </View>
        </Card>

        {/* Feature Grid */}
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>What you'll get</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                padding: spacing.s16,
                borderWidth: 1,
                borderColor: border,
                gap: spacing.s12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(accentPrimary, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="pie-chart" size={22} color={accentPrimary} />
              </View>
              <View>
                <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
                  Visual Breakdown
                </Text>
                <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4, lineHeight: 18 }}>
                  See exactly how your salary is split
                </Text>
              </View>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                padding: spacing.s16,
                borderWidth: 1,
                borderColor: border,
                gap: spacing.s12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(successColor, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="trending-up" size={22} color={successColor} />
              </View>
              <View>
                <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
                  CPF Growth
                </Text>
                <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4, lineHeight: 18 }}>
                  Track OA, SA, and Medisave balances
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                padding: spacing.s16,
                borderWidth: 1,
                borderColor: border,
                gap: spacing.s12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(warningColor, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="calendar" size={22} color={warningColor} />
              </View>
              <View>
                <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
                  Tax Planning
                </Text>
                <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4, lineHeight: 18 }}>
                  Estimate and prepare for tax payments
                </Text>
              </View>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                padding: spacing.s16,
                borderWidth: 1,
                borderColor: border,
                gap: spacing.s12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(accentSecondary, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="zap" size={22} color={accentSecondary} />
              </View>
              <View>
                <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
                  Auto Split
                </Text>
                <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4, lineHeight: 18 }}>
                  Transactions created automatically
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScreenScroll>
      </>
    );
  }

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingTop: spacing.s16, paddingBottom: 68 + Math.max(insets.bottom, 20) + 16 + spacing.s32, gap: spacing.s20 }}
    >
      {/* Header */}
      <View style={{ gap: spacing.s8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: muted, fontSize: 14, fontWeight: '600' }}>
              Paycheck Calculator
            </Text>
            <Text style={{ color: text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: spacing.s2 }}>
              See the split
            </Text>
            <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
              Enter your salary to calculate breakdown
            </Text>
          </View>
          <AnimatedPressable onPress={() => nav.navigate('PaycheckSettings')}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.lg,
                backgroundColor: cardBg,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: border,
              }}
            >
              <Icon name="settings" size={22} color={text} />
            </View>
          </AnimatedPressable>
        </View>
      </View>

      {/* Live Breakdown */}
      {calculatedBreakdown && (
        <Animated.View style={[{ gap: spacing.s16 }, breakdownAnimatedStyle]}>
          <LinearGradient
            colors={[
              isDark ? withAlpha(accentPrimary, 0.15) : withAlpha(accentPrimary, 0.08),
              isDark ? withAlpha(accentPrimary, 0.08) : withAlpha(accentPrimary, 0.04),
            ]}
            style={{ padding: spacing.s20, borderRadius: radius.xl, gap: spacing.s16 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
                💸 Money Breakdown
              </Text>
              <View
                style={{
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(successColor, 0.15),
                }}
              >
                <Text style={{ color: successColor, fontSize: 12, fontWeight: '700' }}>
                  {Math.round((calculatedBreakdown.net / calculatedBreakdown.gross) * 100)}% take-home
                </Text>
              </View>
            </View>

              {/* Deductions */}
              <View style={{ gap: spacing.s10 }}>
                {/* CPF */}
                {calculatedBreakdown.cpfEmployee.total > 0 && (
                  <View
                    style={{
                      padding: spacing.s14,
                      backgroundColor: withAlpha(cardBg, isDark ? 0.5 : 0.8),
                      borderRadius: radius.md,
                      gap: spacing.s8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10, flex: 1, marginRight: spacing.s12 }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: radius.sm,
                            backgroundColor: withAlpha(accentPrimary, 0.15),
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon name="piggy-bank" size={18} color={accentPrimary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                            CPF Contribution
                          </Text>
                          <Text style={{ color: muted, fontSize: 11 }} numberOfLines={1}>
                            {config.cpf.employeeRate}% employee{config.cpf.trackEmployer && ` + ${config.cpf.employerRate}% employer`}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: text, fontWeight: '700', fontSize: 16, flexShrink: 0 }} numberOfLines={1}>
                        -{formatCurrency(calculatedBreakdown.cpfEmployee.total)}
                      </Text>
                    </View>

                    {/* CPF Breakdown */}
                    <View style={{ marginLeft: 46, gap: spacing.s4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: muted, fontSize: 12 }}>
                          → OA (Ordinary Account)
                        </Text>
                        <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>
                          {formatCurrency(calculatedBreakdown.cpfEmployee.oa + calculatedBreakdown.cpfEmployer.oa)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: muted, fontSize: 12 }}>
                          → SA (Special Account)
                        </Text>
                        <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>
                          {formatCurrency(calculatedBreakdown.cpfEmployee.sa + calculatedBreakdown.cpfEmployer.sa)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: muted, fontSize: 12 }}>
                          → Medisave
                        </Text>
                        <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>
                          {formatCurrency(calculatedBreakdown.cpfEmployee.ma + calculatedBreakdown.cpfEmployer.ma)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Tax */}
                {calculatedBreakdown.tax > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: spacing.s10,
                      paddingHorizontal: spacing.s14,
                      backgroundColor: withAlpha(cardBg, isDark ? 0.5 : 0.8),
                      borderRadius: radius.md,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.sm,
                          backgroundColor: withAlpha(warningColor, 0.15),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="receipt" size={16} color={warningColor} />
                      </View>
                      <View>
                        <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                          Income Tax
                        </Text>
                        <Text style={{ color: muted, fontSize: 11 }}>
                          {config.tax.frequency === 'monthly' ? 'Monthly withholding' : 'Annual estimate'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                      -{formatCurrency(calculatedBreakdown.tax)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: withAlpha(border, 0.5), marginVertical: spacing.s8 }} />

              {/* Big Take-Home Amount */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View style={{ gap: spacing.s4 }}>
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                    💵 TAKE-HOME PAY
                  </Text>
                  <Text style={{ color: muted, fontSize: 12 }}>
                    After CPF{calculatedBreakdown.tax > 0 ? ' and tax' : ''} deductions
                  </Text>
                </View>
                <Text style={{ color: successColor, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 }}>
                  {formatCurrency(calculatedBreakdown.net)}
                </Text>
              </View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Salary Input Calculator */}
      <View>
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>
            💰 Enter Gross Salary
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: cardBg,
              borderRadius: radius.lg,
              borderWidth: 2,
              borderColor: calculatedBreakdown ? accentPrimary : border,
              paddingHorizontal: spacing.s16,
            }}
          >
            <Text style={{ color: text, fontSize: 24, fontWeight: '700' }}>
              $
            </Text>
            <TextInput
              value={calculatorAmount}
              onChangeText={setCalculatorAmount}
              placeholder="5000"
              keyboardType="decimal-pad"
              placeholderTextColor={muted}
              style={{
                flex: 1,
                height: 60,
                color: text,
                fontSize: 28,
                fontWeight: '800',
                paddingHorizontal: spacing.s12,
                textAlign: 'right',
              }}
            />
          </View>
          <Text style={{ color: muted, fontSize: 12 }}>
            Your monthly gross salary before deductions
          </Text>
          {calculatedBreakdown && (
            <Button
              title="Record this paycheck"
              onPress={async () => {
                const gross = parseFloat(calculatorAmount || '0');
                if (gross > 0) {
                  await processIncomeSplit(gross, new Date(), 'Salary', 'Manual paycheck entry');
                  setCalculatorAmount('');
                }
              }}
              style={{ marginTop: spacing.s12 }}
            />
          )}
        </View>
      </View>

      {/* Recent Paycheck Breakdown */}
      {recentSplit && (
        <View>
          <Card
            style={{
              padding: 0,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: withAlpha(accentPrimary, 0.3),
            }}
          >
            <LinearGradient
              colors={[
                isDark ? withAlpha(accentPrimary, 0.15) : withAlpha(accentPrimary, 0.08),
                isDark ? withAlpha(accentPrimary, 0.08) : withAlpha(accentPrimary, 0.04),
              ]}
              style={{ padding: spacing.s20, gap: spacing.s16 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                    GROSS INCOME
                  </Text>
                  <Text style={{ color: text, fontSize: 28, fontWeight: '800', marginTop: spacing.s4 }}>
                    {formatCurrency(recentSplit.grossAmount)}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s6,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(successColor, 0.15),
                  }}
                >
                  <Text style={{ color: successColor, fontSize: 12, fontWeight: '700' }}>
                    {recentSplit.source}
                  </Text>
                </View>
              </View>

              {/* Deductions */}
              <View style={{ gap: spacing.s10 }}>
                {/* CPF */}
                {recentSplit.cpf.employee.total > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: spacing.s10,
                      paddingHorizontal: spacing.s14,
                      backgroundColor: withAlpha(cardBg, isDark ? 0.5 : 0.8),
                      borderRadius: radius.md,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.sm,
                          backgroundColor: withAlpha(accentPrimary, 0.15),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="piggy-bank" size={16} color={accentPrimary} />
                      </View>
                      <View>
                        <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                          CPF Contribution
                        </Text>
                        <Text style={{ color: muted, fontSize: 11 }}>
                          Employee {config.cpf.trackEmployer && `+ Employer`}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                      -{formatCurrency(recentSplit.cpf.employee.total + (recentSplit.cpf.employer?.total || 0))}
                    </Text>
                  </View>
                )}

                {/* Tax */}
                {recentSplit.tax > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: spacing.s10,
                      paddingHorizontal: spacing.s14,
                      backgroundColor: withAlpha(cardBg, isDark ? 0.5 : 0.8),
                      borderRadius: radius.md,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.sm,
                          backgroundColor: withAlpha(warningColor, 0.15),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="receipt" size={16} color={warningColor} />
                      </View>
                      <View>
                        <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                          Income Tax
                        </Text>
                        <Text style={{ color: muted, fontSize: 11 }}>
                          {config.tax.frequency === 'monthly' ? 'Monthly withholding' : 'Annual estimate'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                      -{formatCurrency(recentSplit.tax)}
                    </Text>
                  </View>
                )}

                {/* Other deductions */}
                {recentSplit.otherDeductions.map((deduction, idx) => (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: spacing.s10,
                      paddingHorizontal: spacing.s14,
                      backgroundColor: withAlpha(cardBg, isDark ? 0.5 : 0.8),
                      borderRadius: radius.md,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.sm,
                          backgroundColor: withAlpha(muted, 0.15),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="minus" size={16} color={muted} />
                      </View>
                      <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>
                        {deduction.name}
                      </Text>
                    </View>
                    <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                      -{formatCurrency(deduction.amount)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: border, marginVertical: spacing.s4 }} />

              {/* Net Amount */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                    TAKE-HOME PAY
                  </Text>
                  <Text style={{ color: successColor, fontSize: 24, fontWeight: '800', marginTop: spacing.s4 }}>
                    {formatCurrency(recentSplit.netAmount)}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s6,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(successColor, 0.15),
                  }}
                >
                  <Text style={{ color: successColor, fontSize: 13, fontWeight: '700' }}>
                    {Math.round((recentSplit.netAmount / recentSplit.grossAmount) * 100)}% of gross
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Card>
        </View>
      )}

      {/* CPF Accounts */}
      {cpfAccounts.length > 0 && (
        <View style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              CPF Balances
            </Text>
            <Text style={{ color: muted, fontSize: 13 }}>
              Total: {formatCurrency(cpfAccounts.reduce((sum, a) => sum + a.balance, 0))}
            </Text>
          </View>

          {cpfAccounts.map((account, idx) => (
            <AnimatedPressable
              key={idx}
              onPress={() => nav.navigate('AccountDetail', { id: account.id })}
            >
              <Card
                style={{
                  padding: spacing.s16,
                  backgroundColor: cardBg,
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.lg,
                      backgroundColor: withAlpha(account.color, isDark ? 0.2 : 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={account.icon} size={24} color={account.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
                      {account.name}
                    </Text>
                    <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s2 }}>
                      {account.description}
                    </Text>
                  </View>
                  <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>
                    {formatCurrency(account.balance)}
                  </Text>
                </View>
              </Card>
            </AnimatedPressable>
          ))}
        </View>
      )}

      {/* Year-to-Date Summary */}
      {ytdData.count > 0 && (
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
            {new Date().getFullYear()} Summary
          </Text>

          <Card
            style={{
              padding: spacing.s16,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: border,
            }}
          >
            <View style={{ gap: spacing.s16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>
                    Total Gross
                  </Text>
                  <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                    {formatCurrency(ytdData.totalGross)}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>
                    Total Net
                  </Text>
                  <Text style={{ color: successColor, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                    {formatCurrency(ytdData.totalNet)}
                  </Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: border }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: muted, fontSize: 12 }}>CPF Saved</Text>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginTop: spacing.s2 }}>
                    {formatCurrency(ytdData.totalCPF)}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: muted, fontSize: 12 }}>Tax Paid</Text>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginTop: spacing.s2 }}>
                    {formatCurrency(ytdData.totalTax)}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: muted, fontSize: 12 }}>Paychecks</Text>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginTop: spacing.s2 }}>
                    {ytdData.count}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Quick Actions */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
          Quick Actions
        </Text>

        <View style={{ gap: spacing.s8 }}>
          <Button
            title="View split history"
            onPress={() => nav.navigate('PaycheckHistory')}
            variant="secondary"
            icon="history"
          />
          <Button
            title="Configure settings"
            onPress={() => nav.navigate('PaycheckSettings')}
            variant="secondary"
            icon="settings"
          />
        </View>
      </View>
    </ScreenScroll>
  );
};

export default PaycheckBreakdown;
