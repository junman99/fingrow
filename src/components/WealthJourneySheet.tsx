import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { Card } from './Card';
import Icon from './Icon';
import BottomSheet from './BottomSheet';
import { formatCurrency } from '../lib/format';

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

type Milestone = {
  threshold: number;
  label: string;
  icon: 'target' | 'star' | 'award' | 'trophy' | 'zap' | 'trending-up';
  message: string;
  color: string;
};

const MILESTONES: Milestone[] = [
  { threshold: 1000, label: 'First 1K', icon: 'target', message: 'Great start! Every journey begins with a single step.', color: '#3B82F6' },
  { threshold: 5000, label: 'Five Grand', icon: 'star', message: 'Building momentum! Keep it up!', color: '#8B5CF6' },
  { threshold: 10000, label: 'Five Figures', icon: 'award', message: 'You\'re crushing it! 10K achieved!', color: '#F59E0B' },
  { threshold: 25000, label: 'Quarter Million Path', icon: 'zap', message: 'On fire! 25% to 100K!', color: '#EC4899' },
  { threshold: 50000, label: 'Halfway to 100K', icon: 'trending-up', message: 'Halfway there! The momentum is real!', color: '#10B981' },
  { threshold: 100000, label: 'Six Figures', icon: 'trophy', message: 'LEGENDARY! 100K club member!', color: '#EF4444' },
  { threshold: 250000, label: 'Quarter Million', icon: 'trophy', message: 'Elite status! Quarter million achieved!', color: '#DC2626' },
  { threshold: 500000, label: 'Half Million', icon: 'trophy', message: 'Exceptional! You\'re in rare territory!', color: '#991B1B' },
  { threshold: 1000000, label: 'Millionaire', icon: 'trophy', message: 'MILLIONAIRE! You made it to the top!', color: '#FFD700' },
];

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

type Props = {
  visible: boolean;
  onClose: () => void;
  netWorth: number;
  totalCash: number;
  totalInvestments: number;
  totalDebt: number;
  netWorthHistory: Array<{ t: number; v: number }>;
};

export const WealthJourneySheet: React.FC<Props> = ({
  visible,
  onClose,
  netWorth,
  totalCash,
  totalInvestments,
  totalDebt,
  netWorthHistory,
}) => {
  const { get, isDark } = useThemeTokens();

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const bgDefault = get('background.default') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;

  // Find current and next milestone
  const { current, next, progress, achieved } = useMemo(() => {
    let current: Milestone | null = null;
    let next: Milestone | null = null;
    const achieved: Milestone[] = [];

    for (let i = 0; i < MILESTONES.length; i++) {
      if (netWorth >= MILESTONES[i].threshold) {
        current = MILESTONES[i];
        achieved.push(MILESTONES[i]);
      } else {
        next = MILESTONES[i];
        break;
      }
    }

    const prevThreshold = current?.threshold || 0;
    const nextThreshold = next?.threshold || (current?.threshold || 0) * 2;
    const progress = ((netWorth - prevThreshold) / (nextThreshold - prevThreshold)) * 100;

    return { current, next, progress: Math.min(100, Math.max(0, progress)), achieved };
  }, [netWorth]);

  // Calculate growth rate
  const growthRate = useMemo(() => {
    if (netWorthHistory.length < 30) return 0;
    const monthAgo = netWorthHistory[netWorthHistory.length - 30];
    const now = netWorthHistory[netWorthHistory.length - 1];
    if (!monthAgo || !now || monthAgo.v === 0) return 0;
    return ((now.v - monthAgo.v) / Math.abs(monthAgo.v)) * 100;
  }, [netWorthHistory]);

  // Estimate time to next milestone based on growth rate
  const estimatedMonths = useMemo(() => {
    if (!next || growthRate <= 0) return null;
    const remaining = next.threshold - netWorth;
    const monthlyGrowth = (netWorth * (growthRate / 100));
    if (monthlyGrowth <= 0) return null;
    return Math.ceil(remaining / monthlyGrowth);
  }, [next, netWorth, growthRate]);

  // Net worth composition
  const totalAssets = totalCash + totalInvestments;
  const cashPercent = totalAssets > 0 ? (totalCash / totalAssets) * 100 : 0;
  const investPercent = totalAssets > 0 ? (totalInvestments / totalAssets) * 100 : 0;
  const debtPercent = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

  // Calculate what-if scenarios
  const whatIfScenarios = useMemo(() => {
    if (!next) return [];
    const remaining = next.threshold - netWorth;
    return [
      { label: 'Save $500/month', months: Math.ceil(remaining / 500), amount: 500 },
      { label: 'Save $1,000/month', months: Math.ceil(remaining / 1000), amount: 1000 },
      { label: 'Save $2,000/month', months: Math.ceil(remaining / 2000), amount: 2000 },
    ];
  }, [next, netWorth]);

  // Journey stats
  const journeyStats = useMemo(() => {
    const startValue = netWorthHistory[0]?.v || 0;
    const currentValue = netWorthHistory[netWorthHistory.length - 1]?.v || netWorth;
    const totalGrowth = currentValue - startValue;
    const growthPercent = startValue !== 0 ? (totalGrowth / Math.abs(startValue)) * 100 : 0;

    // Find biggest jump
    let biggestJump = 0;
    let biggestJumpDate = null;
    for (let i = 1; i < netWorthHistory.length; i++) {
      const jump = netWorthHistory[i].v - netWorthHistory[i - 1].v;
      if (jump > biggestJump) {
        biggestJump = jump;
        biggestJumpDate = new Date(netWorthHistory[i].t);
      }
    }

    return {
      totalGrowth,
      growthPercent,
      biggestJump,
      biggestJumpDate,
      daysTracking: netWorthHistory.length,
    };
  }, [netWorthHistory, netWorth]);

  return (
    <BottomSheet visible={visible} onClose={onClose} fullHeight>
      <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.s32, gap: spacing.s24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View>
          <Text style={{ color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
            Wealth Journey
          </Text>
          <Text style={{ color: muted, fontSize: 14, marginTop: spacing.s6 }}>
            Track your progress and celebrate achievements
          </Text>
        </View>

        {/* Current Milestone Hero */}
        {current && (
          <Card
            style={{
              backgroundColor: withAlpha(current.color, isDark ? 0.2 : 0.12),
              padding: spacing.s20,
              borderWidth: 2,
              borderColor: current.color,
            }}
          >
            <View style={{ alignItems: 'center', gap: spacing.s12 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius.full,
                  backgroundColor: current.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={current.icon} size={32} color="#FFFFFF" />
              </View>
              <Text style={{ color: current.color, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>
                {current.label}
              </Text>
              <Text style={{ color: text, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                {current.message}
              </Text>
              <View style={{
                paddingHorizontal: spacing.s16,
                paddingVertical: spacing.s8,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(text, isDark ? 0.15 : 0.1),
                marginTop: spacing.s8,
              }}>
                <Text style={{ color: text, fontSize: 13, fontWeight: '700' }}>
                  Achieved at {formatCurrency(current.threshold)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Milestone Timeline */}
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Milestone Timeline</Text>
          <View style={{ gap: spacing.s8 }}>
            {MILESTONES.map((milestone, idx) => {
              const isAchieved = netWorth >= milestone.threshold;
              const isCurrent = current?.threshold === milestone.threshold;
              const isNext = next?.threshold === milestone.threshold;

              return (
                <View
                  key={milestone.threshold}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.s12,
                    opacity: isAchieved || isCurrent || isNext ? 1 : 0.5,
                  }}
                >
                  {/* Timeline dot */}
                  <View style={{ alignItems: 'center', gap: spacing.s4 }}>
                    <View
                      style={{
                        width: isAchieved ? 32 : 24,
                        height: isAchieved ? 32 : 24,
                        borderRadius: radius.full,
                        backgroundColor: isAchieved ? milestone.color : withAlpha(text, isDark ? 0.2 : 0.15),
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: isNext ? 2 : 0,
                        borderColor: isNext ? accentPrimary : 'transparent',
                      }}
                    >
                      {isAchieved ? (
                        <Icon name="check" size={16} color="#FFFFFF" />
                      ) : (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: radius.full,
                            backgroundColor: withAlpha(text, 0.3),
                          }}
                        />
                      )}
                    </View>
                    {idx < MILESTONES.length - 1 && (
                      <View
                        style={{
                          width: 2,
                          height: 24,
                          backgroundColor: isAchieved ? milestone.color : withAlpha(text, isDark ? 0.15 : 0.1),
                        }}
                      />
                    )}
                  </View>

                  {/* Milestone info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: text, fontSize: 15, fontWeight: '700' }}>
                        {milestone.label}
                      </Text>
                      <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>
                        {formatCurrency(milestone.threshold)}
                      </Text>
                    </View>
                    {isNext && estimatedMonths && (
                      <Text style={{ color: accentPrimary, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                        ~{estimatedMonths} months at current rate
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Net Worth Breakdown */}
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Net Worth Breakdown</Text>
          <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
            {/* Visual breakdown bars */}
            <View style={{ gap: spacing.s12, marginBottom: spacing.s16 }}>
              <View style={{ flexDirection: 'row', height: 12, borderRadius: radius.md, overflow: 'hidden' }}>
                {cashPercent > 0 && (
                  <View style={{ width: `${cashPercent}%`, backgroundColor: '#3B82F6' }} />
                )}
                {investPercent > 0 && (
                  <View style={{ width: `${investPercent}%`, backgroundColor: '#10B981' }} />
                )}
              </View>
            </View>

            {/* Breakdown items */}
            <View style={{ gap: spacing.s12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#3B82F6' }} />
                  <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>Cash</Text>
                </View>
                <Text style={{ color: text, fontSize: 14, fontWeight: '700' }}>
                  {formatCurrency(totalCash)} ({cashPercent.toFixed(0)}%)
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#10B981' }} />
                  <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>Investments</Text>
                </View>
                <Text style={{ color: text, fontSize: 14, fontWeight: '700' }}>
                  {formatCurrency(totalInvestments)} ({investPercent.toFixed(0)}%)
                </Text>
              </View>

              {totalDebt > 0 && (
                <>
                  <View style={{ height: 1, backgroundColor: withAlpha(text, isDark ? 0.15 : 0.1), marginVertical: spacing.s4 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <Icon name="minus-circle" size={12} colorToken="semantic.warning" />
                      <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>Debt</Text>
                    </View>
                    <Text style={{ color: warningColor, fontSize: 14, fontWeight: '700' }}>
                      -{formatCurrency(totalDebt)}
                    </Text>
                  </View>
                </>
              )}

              <View style={{ height: 1, backgroundColor: withAlpha(text, isDark ? 0.15 : 0.1), marginVertical: spacing.s4 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '800' }}>Net Worth</Text>
                <Text style={{ color: text, fontSize: 16, fontWeight: '800' }}>
                  {formatCurrency(netWorth)}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Growth Insights */}
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Growth Insights</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <Card style={{ flex: 1, backgroundColor: cardBg, padding: spacing.s16 }}>
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Monthly Growth</Text>
              <Text style={{
                color: growthRate >= 0 ? successColor : warningColor,
                fontSize: 24,
                fontWeight: '800',
                marginTop: spacing.s4
              }}>
                {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
              </Text>
            </Card>

            <Card style={{ flex: 1, backgroundColor: cardBg, padding: spacing.s16 }}>
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Days Tracking</Text>
              <Text style={{ color: text, fontSize: 24, fontWeight: '800', marginTop: spacing.s4 }}>
                {journeyStats.daysTracking}
              </Text>
            </Card>
          </View>

          <Card style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s8 }}>
              Total Growth
            </Text>
            <Text style={{
              color: journeyStats.totalGrowth >= 0 ? successColor : warningColor,
              fontSize: 28,
              fontWeight: '800'
            }}>
              {journeyStats.totalGrowth >= 0 ? '+' : ''}{formatCurrency(Math.abs(journeyStats.totalGrowth))}
            </Text>
            <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
              {journeyStats.growthPercent >= 0 ? '+' : ''}{journeyStats.growthPercent.toFixed(1)}% since you started tracking
            </Text>
          </Card>

          {journeyStats.biggestJump > 0 && journeyStats.biggestJumpDate && (
            <Card
              style={{
                backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.12),
                padding: spacing.s16,
                borderLeftWidth: 4,
                borderLeftColor: successColor,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s6 }}>
                <Icon name="zap" size={16} color={successColor} />
                <Text style={{ color: text, fontSize: 14, fontWeight: '700' }}>Biggest Jump</Text>
              </View>
              <Text style={{ color: successColor, fontSize: 20, fontWeight: '800' }}>
                +{formatCurrency(journeyStats.biggestJump)}
              </Text>
              <Text style={{ color: muted, fontSize: 12, marginTop: spacing.s4 }}>
                on {journeyStats.biggestJumpDate.toLocaleDateString()}
              </Text>
            </Card>
          )}
        </View>

        {/* What-If Calculator */}
        {next && whatIfScenarios.length > 0 && (
          <View style={{ gap: spacing.s12 }}>
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              Reach {next.label} Faster
            </Text>
            <View style={{ gap: spacing.s8 }}>
              {whatIfScenarios.map((scenario, idx) => (
                <Card key={idx} style={{ backgroundColor: cardBg, padding: spacing.s16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ color: text, fontSize: 15, fontWeight: '700' }}>
                        {scenario.label}
                      </Text>
                      <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                        Reach goal in ~{scenario.months} months
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: spacing.s12,
                        paddingVertical: spacing.s6,
                        borderRadius: radius.pill,
                        backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
                      }}
                    >
                      <Text style={{ color: accentPrimary, fontSize: 13, fontWeight: '700' }}>
                        {scenario.months}mo
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Action Suggestions */}
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Smart Actions</Text>
          <View style={{ gap: spacing.s8 }}>
            {totalDebt > 0 && (
              <Card
                style={{
                  backgroundColor: withAlpha(warningColor, isDark ? 0.15 : 0.1),
                  padding: spacing.s16,
                  borderLeftWidth: 4,
                  borderLeftColor: warningColor,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12 }}>
                  <Icon name="alert-circle" size={20} color={warningColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: text, fontSize: 14, fontWeight: '700', marginBottom: spacing.s4 }}>
                      Pay Down Debt
                    </Text>
                    <Text style={{ color: muted, fontSize: 13, lineHeight: 18 }}>
                      Reducing your {formatCurrency(totalDebt)} debt will directly increase your net worth and accelerate milestone progress.
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {investPercent < 30 && totalCash > 10000 && (
              <Card
                style={{
                  backgroundColor: withAlpha(successColor, isDark ? 0.15 : 0.1),
                  padding: spacing.s16,
                  borderLeftWidth: 4,
                  borderLeftColor: successColor,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12 }}>
                  <Icon name="trending-up" size={20} color={successColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: text, fontSize: 14, fontWeight: '700', marginBottom: spacing.s4 }}>
                      Increase Investments
                    </Text>
                    <Text style={{ color: muted, fontSize: 13, lineHeight: 18 }}>
                      Only {investPercent.toFixed(0)}% of your assets are invested. Consider investing more for long-term growth.
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {growthRate > 0 && (
              <Card
                style={{
                  backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.1),
                  padding: spacing.s16,
                  borderLeftWidth: 4,
                  borderLeftColor: accentPrimary,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12 }}>
                  <Icon name="target" size={20} color={accentPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: text, fontSize: 14, fontWeight: '700', marginBottom: spacing.s4 }}>
                      Keep the Momentum
                    </Text>
                    <Text style={{ color: muted, fontSize: 13, lineHeight: 18 }}>
                      You're growing at {growthRate.toFixed(1)}% per month. Stay consistent with your saving and investing habits!
                    </Text>
                  </View>
                </View>
              </Card>
            )}
          </View>
        </View>
      </ScrollView>
      </>
    </BottomSheet>
  );
};
