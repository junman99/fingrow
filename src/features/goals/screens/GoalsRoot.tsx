import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, useAnimatedScrollHandler, interpolate, Extrapolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../../components/ScreenScroll';
import Icon from '../../../components/Icon';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import { useGoalsStore, type Goal } from '../store';
import { useAccountsStore } from '../../../store/accounts';
import { useInvestStore } from '../../features/invest';
import { useTxStore } from '../../../store/transactions';
import { formatCurrency } from '../../../lib/format';
import Svg, { Circle, G } from 'react-native-svg';
import { useStreaksStore, getStreakMessage, getNextMilestone } from '../../../store/streaks';
import { WealthJourneySheet } from '../../../components/WealthJourneySheet';

type TabType = 'milestone' | 'networth';

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

// Animated progress ring
const AnimatedRing: React.FC<{ progress: number; size: number; strokeWidth: number; color: string }> = ({
  progress,
  size,
  strokeWidth,
  color
}) => {
  const { get } = useThemeTokens();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const bgColor = withAlpha(get('surface.level2') as string, 0.5);

  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
};

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

const GoalsRoot: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { get, isDark } = useThemeTokens();
  const { goals, achievements, level, xp, hydrate } = useGoalsStore();
  const { accounts } = useAccountsStore();
  const { holdings, quotes } = useInvestStore();
  const { transactions } = useTxStore();
  const { currentStreak, longestStreak, visitDates, recordVisit, hydrate: hydrateStreaks } = useStreaksStore();
  const [activeTab, setActiveTab] = useState<TabType>('milestone');
  const [showWealthJourney, setShowWealthJourney] = useState(false);

  // Main Tab Title Animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  useEffect(() => {
    hydrate();
    hydrateStreaks();
    recordVisit();
  }, [hydrate, hydrateStreaks, recordVisit]);

  const xpForLevel = (lvl: number) => lvl * 100;
  const currentLevelXP = xpForLevel(level);
  const xpProgress = (xp / currentLevelXP) * 100;

  const currentNetWorth = useMemo(() => {
    return accounts
      .filter(a => a.includeInNetWorth !== false)
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  // Calculate wealth journey data
  const totalCash = useMemo(() => {
    return accounts
      .filter(a => a.includeInNetWorth !== false && a.type !== 'debt' && a.type !== 'investment')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const totalInvestments = useMemo(() => {
    let total = 0;
    Object.values(holdings || {}).forEach((h: any) => {
      const qty = (h?.lots || []).reduce((s: number, l: any) => s + (l.side === 'buy' ? l.qty : -l.qty), 0);
      if (qty > 0) {
        const q = quotes[h.symbol];
        const last = Number(q?.last || 0);
        total += qty * last;
      }
    });
    return total;
  }, [holdings, quotes]);

  const totalDebt = useMemo(() => {
    return accounts
      .filter(a => a.type === 'debt')
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);
  }, [accounts]);

  const netWorth = totalCash + totalInvestments - totalDebt;

  // Calculate net worth history
  const netWorthHistoryData = useMemo(() => {
    const now = new Date();
    const history: Array<{ t: number; cash: number; investments: number; debt: number }> = [];

    // Simple placeholder - would need actual historical data
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      history.push({
        t: date.getTime(),
        cash: totalCash,
        investments: totalInvestments,
        debt: totalDebt,
      });
    }

    return history;
  }, [totalCash, totalInvestments, totalDebt]);

  const milestoneGoals = useMemo(() =>
    (goals || []).filter(g => (!g.type || g.type === 'milestone') && !g.completedAt),
    [goals]
  );

  const networthGoals = useMemo(() =>
    (goals || []).filter(g => g.type === 'networth' && !g.completedAt),
    [goals]
  );

  const activeGoals = activeTab === 'milestone' ? milestoneGoals : networthGoals;

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;
  const bgDefault = get('background.default') as string;

  // Main Tab Title Animation - Animated Styles
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

  const floatingTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    const fontSize = interpolate(progress, [0, 1], [28, 20]);
    const fontWeight = interpolate(progress, [0, 1], [800, 700]);

    return {
      fontSize,
      fontWeight: fontWeight.toString() as any,
      opacity: progress >= 1 ? 1 : progress,
    };
  });

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

  const renderGoalCard = (goal: Goal) => {
    const progress = goal.targetAmount > 0
      ? Math.min(100, Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100))
      : 0;
    const remaining = Math.max(0, (goal.targetAmount || 0) - (goal.currentAmount || 0));
    const isComplete = progress >= 100 || !!goal.completedAt;

    // Determine status and color
    let statusColor = successColor;
    let statusText = 'On Track';
    let statusIcon = 'check-circle' as const;
    let progressColor = accentPrimary;

    let daysRemaining: number | null = null;
    let monthlyNeeded = 0;
    let monthsRemaining = 0;

    if (goal.targetDate && !isComplete) {
      const targetDate = new Date(goal.targetDate);
      const today = new Date();
      const diffTime = targetDate.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      monthsRemaining = daysRemaining / 30;

      if (remaining > 0 && daysRemaining > 0) {
        monthlyNeeded = remaining / monthsRemaining;
      }

      // Determine status based on progress vs time
      const timeProgress = monthsRemaining > 0 ? ((goal.targetDate ? (new Date(goal.targetDate).getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30) : 0) - monthsRemaining) / (goal.targetDate ? (new Date(goal.targetDate).getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30) : 1) * 100 : 0;

      if (daysRemaining < 0) {
        statusColor = warningColor;
        statusText = 'Overdue';
        statusIcon = 'alert-circle';
        progressColor = warningColor;
      } else if (progress < timeProgress - 10) {
        statusColor = warningColor;
        statusText = 'Behind Schedule';
        statusIcon = 'alert-triangle';
        progressColor = warningColor;
      } else if (progress < timeProgress + 10) {
        statusColor = accentSecondary;
        statusText = 'Needs Attention';
        statusIcon = 'info';
        progressColor = accentSecondary;
      }
    }

    if (isComplete) {
      statusColor = successColor;
      statusText = 'Complete';
      statusIcon = 'check-circle';
      progressColor = successColor;
    }

    return (
      <View key={goal.id} style={{ marginBottom: spacing.s16 }}>
        <View
          style={{
            backgroundColor: isComplete ? withAlpha(successColor, isDark ? 0.12 : 0.06) : cardBg,
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: isComplete ? withAlpha(successColor, 0.3) : border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {/* Header with icon, title, and status */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.s12 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
              {goal.icon && <Text style={{ fontSize: 32 }}>{goal.icon}</Text>}
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontSize: 19, fontWeight: '800', marginBottom: spacing.s4 }}>
                  {goal.title}
                </Text>
                {goal.isPinned && (
                  <View style={{
                    backgroundColor: withAlpha(warningColor, isDark ? 0.25 : 0.15),
                    paddingHorizontal: spacing.s8,
                    paddingVertical: spacing.s4,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: withAlpha(warningColor, 0.3),
                    alignSelf: 'flex-start',
                  }}>
                    <Text style={{ color: warningColor, fontSize: 10, fontWeight: '700' }}>📌 PINNED</Text>
                  </View>
                )}
              </View>
            </View>
            {/* Status indicator */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.s4,
              paddingHorizontal: spacing.s8,
              paddingVertical: spacing.s6,
              borderRadius: radius.pill,
              backgroundColor: withAlpha(statusColor, isDark ? 0.25 : 0.12),
              borderWidth: 1,
              borderColor: withAlpha(statusColor, 0.3),
            }}>
              <Icon name={statusIcon} size={14} color={statusColor} />
              <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700' }}>
                {statusText}
              </Text>
            </View>
          </View>

          {/* Amount and Progress */}
          <View style={{ marginBottom: spacing.s12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s8 }}>
              <Text style={{ color: text, fontSize: 24, fontWeight: '800' }}>
                {formatCurrency(goal.currentAmount || 0)}
              </Text>
              {/* Milestone badges */}
              {!isComplete && progress >= 25 && (
                <View style={{
                  paddingHorizontal: spacing.s8,
                  paddingVertical: spacing.s4,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(
                    progress >= 75 ? successColor : progress >= 50 ? accentSecondary : accentPrimary,
                    isDark ? 0.25 : 0.15
                  ),
                  borderWidth: 1,
                  borderColor: withAlpha(
                    progress >= 75 ? successColor : progress >= 50 ? accentSecondary : accentPrimary,
                    0.4
                  ),
                }}>
                  <Text style={{
                    color: progress >= 75 ? successColor : progress >= 50 ? accentSecondary : accentPrimary,
                    fontSize: 10,
                    fontWeight: '800'
                  }}>
                    {progress >= 75 ? '🌟 75%+' : progress >= 50 ? '⭐ 50%+' : '✨ 25%+'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color: muted, fontSize: 14, fontWeight: '600', marginTop: spacing.s4 }}>
              of {formatCurrency(goal.targetAmount)} • {formatCurrency(remaining)} left
            </Text>
          </View>

          {/* Enhanced Progress Bar with Gradient */}
          <View style={{ marginBottom: spacing.s12 }}>
            <View style={{
              height: 10,
              borderRadius: radius.md,
              backgroundColor: withAlpha(progressColor, isDark ? 0.15 : 0.1),
              overflow: 'hidden',
            }}>
              <LinearGradient
                colors={[progressColor, withAlpha(progressColor, 0.7)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: `${progress}%`,
                  height: 10,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s6 }}>
              <Text style={{ color: progressColor, fontSize: 13, fontWeight: '700' }}>
                {progress}%
              </Text>
              {!isComplete && daysRemaining !== null && daysRemaining > 0 && (
                <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>
                  {daysRemaining} days left
                </Text>
              )}
            </View>
          </View>

          {/* Info Row */}
          {!isComplete && monthlyNeeded > 0 && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.s6,
              paddingVertical: spacing.s10,
              paddingHorizontal: spacing.s12,
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.12 : 0.08),
              borderRadius: radius.md,
              marginBottom: spacing.s12,
            }}>
              <Icon name="trending-up" size={16} color={accentSecondary} />
              <Text style={{ color: text, fontSize: 13, fontWeight: '600', flex: 1 }}>
                Save {formatCurrency(monthlyNeeded)}/month to reach goal on time
              </Text>
            </View>
          )}

          {/* Funding Breakdown */}
          {goal.history && goal.history.length > 0 && (
            <View style={{
              paddingVertical: spacing.s10,
              paddingHorizontal: spacing.s12,
              backgroundColor: withAlpha(surface2, 0.5),
              borderRadius: radius.md,
              marginBottom: spacing.s12,
              borderWidth: 1,
              borderColor: border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s8 }}>
                <Text style={{ color: muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                  Progress Breakdown
                </Text>
                <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>
                  {goal.history.length} contribution{goal.history.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {(() => {
                const contributions = goal.history.filter(h => h.type === 'contribution');
                const roundups = goal.history.filter(h => h.type === 'roundup');
                const adjustments = goal.history.filter(h => h.type === 'adjust');

                const totalContributions = contributions.reduce((sum, h) => sum + h.amount, 0);
                const totalRoundups = roundups.reduce((sum, h) => sum + h.amount, 0);
                const totalAdjustments = adjustments.reduce((sum, h) => sum + h.amount, 0);

                return (
                  <View style={{ gap: spacing.s6 }}>
                    {totalContributions > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentPrimary }} />
                          <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>
                            Manual deposits
                          </Text>
                        </View>
                        <Text style={{ color: text, fontSize: 12, fontWeight: '700' }}>
                          {formatCurrency(totalContributions)}
                        </Text>
                      </View>
                    )}

                    {totalRoundups > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: successColor }} />
                          <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>
                            Round-ups
                          </Text>
                        </View>
                        <Text style={{ color: text, fontSize: 12, fontWeight: '700' }}>
                          {formatCurrency(totalRoundups)}
                        </Text>
                      </View>
                    )}

                    {totalAdjustments !== 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentSecondary }} />
                          <Text style={{ color: text, fontSize: 12, fontWeight: '600' }}>
                            Adjustments
                          </Text>
                        </View>
                        <Text style={{ color: text, fontSize: 12, fontWeight: '700' }}>
                          {formatCurrency(totalAdjustments)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Quick Actions */}
          {!isComplete && (
            <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
              <AnimatedPressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  nav.navigate('GoalDetail', { goalId: goal.id, mode: 'contribute' });
                }}
                style={{ flex: 1 }}
              >
                <View style={{
                  backgroundColor: accentPrimary,
                  paddingVertical: spacing.s10,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.s6,
                }}>
                  <Icon name="plus" size={16} color="white" />
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>
                    Add Money
                  </Text>
                </View>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  nav.navigate('GoalDetail', { goalId: goal.id, mode: 'journey' });
                }}
                style={{ flex: 1 }}
              >
                <View style={{
                  backgroundColor: surface2,
                  paddingVertical: spacing.s10,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.s6,
                  borderWidth: 1,
                  borderColor: border,
                }}>
                  <Icon name="bar-chart-2" size={16} color={text} />
                  <Text style={{ color: text, fontSize: 14, fontWeight: '700' }}>
                    Details
                  </Text>
                </View>
              </AnimatedPressable>
            </View>
          )}

          {/* Complete state with celebration */}
          {isComplete && (
            <AnimatedPressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                nav.navigate('GoalDetail', { goalId: goal.id, mode: 'journey' });
              }}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.s8,
                paddingVertical: spacing.s12,
                backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.12),
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: withAlpha(successColor, 0.3),
              }}>
                <Text style={{ fontSize: 20 }}>🎉</Text>
                <Text style={{ color: successColor, fontSize: 15, fontWeight: '700' }}>
                  Goal Completed!
                </Text>
                <Text style={{ fontSize: 20 }}>🎉</Text>
              </View>
            </AnimatedPressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Main Tab Title Animation - Floating Gradient Header (Fixed at top, outside scroll) */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            pointerEvents: 'none',
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
            withAlpha(bgDefault, 0)
          ]}
          style={{
            paddingTop: insets.top + spacing.s16,
            paddingBottom: spacing.s32 + spacing.s20,
            paddingHorizontal: spacing.s16,
          }}
        >
          <Animated.Text
            style={[
              {
                color: text,
                fontSize: 20,
                fontWeight: '700',
                letterSpacing: -0.5,
                textAlign: 'center',
              },
              floatingTitleAnimatedStyle,
            ]}
          >
            Goals
          </Animated.Text>
        </LinearGradient>
      </Animated.View>

      <ScreenScroll
        inTab
        fullScreen
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentStyle={{
          paddingHorizontal: 0,
          paddingTop: insets.top + spacing.s24,
          paddingBottom: Math.max(insets.bottom, spacing.s24),
        }}
      >
      <View style={{ paddingHorizontal: spacing.s16, gap: spacing.s16 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s4 }}>
          <Animated.Text style={[{ color: text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }, originalTitleAnimatedStyle]}>
            Goals
          </Animated.Text>
          <AnimatedPressable onPress={() => nav.navigate('AchievementsModal')}>
            <View style={{
              paddingHorizontal: spacing.s12,
              paddingVertical: spacing.s8,
              borderRadius: radius.pill,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.s6,
              borderWidth: 1,
              borderColor: withAlpha(accentPrimary, 0.3),
            }}>
              <Icon name="trophy" size={16} color={accentPrimary} />
              <Text style={{ color: text, fontSize: 13, fontWeight: '700' }}>
                {achievements.length > 0 ? achievements.length : '0'}
              </Text>
            </View>
          </AnimatedPressable>
        </View>

        {/* Streak Display */}
        {currentStreak > 0 && (
          <View style={{ gap: spacing.s10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
              <Text style={{ fontSize: 22 }}>🔥</Text>
              <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>
                {currentStreak} day streak
              </Text>
              {getNextMilestone(currentStreak) && (
                <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>
                  · {getNextMilestone(currentStreak)!.days - currentStreak} to {getNextMilestone(currentStreak)!.label}
                </Text>
              )}
            </View>

            {/* Mini Calendar - Last 7 days */}
            <View style={{ flexDirection: 'row', gap: spacing.s6 }}>
              {Array.from({ length: 7 }).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                const dateString = date.toISOString().split('T')[0];
                const isActive = visitDates.includes(dateString);
                const isToday = i === 6;

                return (
                  <View
                    key={i}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: radius.sm,
                      backgroundColor: isActive
                        ? successColor
                        : withAlpha(muted, 0.15),
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: isToday ? 2 : 0,
                      borderColor: isToday ? successColor : 'transparent',
                    }}
                  >
                    {isActive && (
                      <Icon name="check" size={12} color="white" />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Smart Insights Card */}
        {(milestoneGoals.length > 0 || networthGoals.length > 0) && (
          <View style={{
            backgroundColor: withAlpha(accentPrimary, isDark ? 0.12 : 0.08),
            borderRadius: radius.lg,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: withAlpha(accentPrimary, 0.3),
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10, marginBottom: spacing.s12 }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: accentPrimary,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="lightbulb" size={18} color="white" />
              </View>
              <Text style={{ color: text, fontSize: 16, fontWeight: '800' }}>
                Smart Insight
              </Text>
            </View>

            {(() => {
              // Calculate insights
              const allGoals = [...milestoneGoals, ...networthGoals];
              const totalTarget = allGoals.reduce((sum, g) => sum + g.targetAmount, 0);
              const totalSaved = allGoals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
              const totalRemaining = totalTarget - totalSaved;
              const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

              // Find most urgent goal
              const urgentGoals = allGoals
                .filter(g => g.targetDate && !g.completedAt)
                .sort((a, b) => {
                  const aDate = new Date(a.targetDate!).getTime();
                  const bDate = new Date(b.targetDate!).getTime();
                  return aDate - bDate;
                });
              const mostUrgent = urgentGoals[0];

              // Find goal closest to completion
              const nearCompletion = allGoals
                .filter(g => !g.completedAt && g.targetAmount > 0)
                .map(g => ({
                  goal: g,
                  progress: ((g.currentAmount || 0) / g.targetAmount) * 100
                }))
                .sort((a, b) => b.progress - a.progress)[0];

              // Generate insight message
              let insightMessage = '';
              let insightIcon = 'info';

              if (nearCompletion && nearCompletion.progress >= 80) {
                const remaining = nearCompletion.goal.targetAmount - (nearCompletion.goal.currentAmount || 0);
                insightMessage = `You're ${Math.round(nearCompletion.progress)}% of the way to "${nearCompletion.goal.title}"! Just ${formatCurrency(remaining)} more to go. 🎯`;
                insightIcon = 'target';
              } else if (mostUrgent) {
                const daysLeft = Math.ceil((new Date(mostUrgent.targetDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const remaining = mostUrgent.targetAmount - (mostUrgent.currentAmount || 0);
                const dailyNeeded = remaining / daysLeft;

                if (daysLeft > 0 && daysLeft < 60) {
                  insightMessage = `"${mostUrgent.title}" is due in ${daysLeft} days. Save ${formatCurrency(dailyNeeded)}/day to reach it on time.`;
                  insightIcon = 'clock';
                } else {
                  insightMessage = `You're making great progress! Keep contributing regularly to stay on track with your ${allGoals.length} active goal${allGoals.length !== 1 ? 's' : ''}.`;
                  insightIcon = 'trending-up';
                }
              } else if (allGoals.length > 0) {
                insightMessage = `You have ${formatCurrency(totalRemaining)} left to save across all goals. You're ${Math.round(overallProgress)}% of the way there!`;
                insightIcon = 'pie-chart';
              } else {
                insightMessage = "Start by creating your first goal. Small steps lead to big achievements!";
                insightIcon = 'target';
              }

              return (
                <Text style={{ color: text, fontSize: 14, lineHeight: 20 }}>
                  {insightMessage}
                </Text>
              );
            })()}
          </View>
        )}

        {/* Simplified Tab Switcher */}
        <View style={{ flexDirection: 'row', gap: spacing.s10, backgroundColor: surface2, padding: spacing.s6, borderRadius: radius.lg, alignSelf: 'stretch' }}>
          <AnimatedPressable
            onPress={() => setActiveTab('milestone')}
            style={{ flex: 1 }}
          >
            <View style={{
              backgroundColor: activeTab === 'milestone' ? accentPrimary : 'transparent',
              paddingVertical: spacing.s10,
              paddingHorizontal: spacing.s8,
              borderRadius: radius.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.s6,
            }}>
              <Icon name="target" size={16} color={activeTab === 'milestone' ? 'white' : muted} />
              <Text style={{ color: activeTab === 'milestone' ? 'white' : text, fontSize: 13, fontWeight: '700' }}>
                Milestones ({milestoneGoals.length})
              </Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => setActiveTab('networth')}
            style={{ flex: 1 }}
          >
            <View style={{
              backgroundColor: activeTab === 'networth' ? accentSecondary : 'transparent',
              paddingVertical: spacing.s10,
              paddingHorizontal: spacing.s8,
              borderRadius: radius.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.s6,
            }}>
              <Icon name="trending-up" size={16} color={activeTab === 'networth' ? 'white' : muted} />
              <Text style={{ color: activeTab === 'networth' ? 'white' : text, fontSize: 13, fontWeight: '700' }}>
                Net Worth ({networthGoals.length})
              </Text>
            </View>
          </AnimatedPressable>
        </View>

        {/* Net Worth Display */}
        {activeTab === 'networth' && (
          <View style={{
            backgroundColor: withAlpha(accentSecondary, isDark ? 0.15 : 0.08),
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: withAlpha(accentSecondary, 0.2),
          }}>
            <Text style={{ color: muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: spacing.s6 }}>
              CURRENT NET WORTH
            </Text>
            <Text style={{ color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
              {formatCurrency(currentNetWorth)}
            </Text>
            <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s6 }}>
              From {accounts.filter(a => a.includeInNetWorth !== false).length} account{accounts.filter(a => a.includeInNetWorth !== false).length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Popular Templates */}
        {activeTab === 'milestone' && activeGoals.length === 0 && (
          <View style={{ marginBottom: spacing.s8 }}>
            <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginBottom: spacing.s12 }}>
              Popular Goals
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s10 }}>
              {[
                { icon: '🏠', title: 'House Down Payment', amount: 50000, color: accentPrimary },
                { icon: '✈️', title: 'Dream Vacation', amount: 5000, color: accentSecondary },
                { icon: '🚗', title: 'New Car', amount: 30000, color: successColor },
                { icon: '💍', title: 'Wedding', amount: 25000, color: warningColor },
                { icon: '🎓', title: 'Education Fund', amount: 15000, color: accentPrimary },
                { icon: '🏥', title: 'Emergency Fund', amount: 10000, color: successColor },
              ].map((template, idx) => (
                <AnimatedPressable
                  key={idx}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    nav.navigate('GoalCreate', {
                      type: 'milestone',
                      template: {
                        title: template.title,
                        targetAmount: template.amount,
                        icon: template.icon,
                      }
                    });
                  }}
                >
                  <View style={{
                    width: 140,
                    backgroundColor: withAlpha(template.color, isDark ? 0.15 : 0.08),
                    borderRadius: radius.lg,
                    padding: spacing.s14,
                    borderWidth: 1,
                    borderColor: withAlpha(template.color, 0.3),
                  }}>
                    <Text style={{ fontSize: 32, marginBottom: spacing.s8 }}>{template.icon}</Text>
                    <Text style={{ color: text, fontSize: 13, fontWeight: '700', marginBottom: spacing.s4 }} numberOfLines={2}>
                      {template.title}
                    </Text>
                    <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>
                      {formatCurrency(template.amount)}
                    </Text>
                  </View>
                </AnimatedPressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Create Button */}
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            nav.navigate('GoalCreate', { type: activeTab });
          }}
        >
          <View style={{
            backgroundColor: accentPrimary,
            borderRadius: radius.lg,
            padding: spacing.s14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.s8
          }}>
            <Icon name="plus" size={20} color="white" />
            <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>
              New {activeTab === 'milestone' ? 'Milestone' : 'Net Worth'} Goal
            </Text>
          </View>
        </AnimatedPressable>

        {/* Section Header */}
        <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: spacing.s8 }}>
          {activeTab === 'milestone' ? 'Your Milestones' : 'Net Worth Targets'}
        </Text>

        {/* Goals List */}
        {activeGoals.length === 0 ? (
          <View style={{
            padding: spacing.s24,
            backgroundColor: cardBg,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: border,
            alignItems: 'center',
            gap: spacing.s12
          }}>
            <Text style={{ fontSize: 48 }}>{activeTab === 'milestone' ? '🎯' : '📈'}</Text>
            <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
              No {activeTab} goals yet
            </Text>
            <Text style={{ color: muted, textAlign: 'center', paddingHorizontal: spacing.s12 }}>
              {activeTab === 'milestone'
                ? 'Create your first milestone and start saving!'
                : 'Set a net worth target and track your progress!'
              }
            </Text>
          </View>
        ) : (
          activeGoals.map(renderGoalCard)
        )}

        {/* Level & XP Progress - Enhanced */}
        {(milestoneGoals.length > 0 || networthGoals.length > 0) && (
          <AnimatedPressable onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            nav.navigate('AchievementsModal');
          }}>
            <View style={{
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.12 : 0.08),
              borderRadius: radius.lg,
              padding: spacing.s16,
              borderWidth: 1,
              borderColor: withAlpha(accentPrimary, 0.2),
              marginTop: spacing.s8,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    backgroundColor: accentPrimary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 24 }}>
                      {level >= 10 ? '🏆' : level >= 5 ? '⭐' : '🎯'}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: text, fontSize: 18, fontWeight: '800' }}>
                      Level {level}
                    </Text>
                    <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>
                      {xp} / {currentLevelXP} XP
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: accentPrimary, fontSize: 12, fontWeight: '700' }}>
                    {Math.round(currentLevelXP - xp)} XP
                  </Text>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>
                    to level {level + 1}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.1),
                overflow: 'hidden',
                marginBottom: spacing.s10,
              }}>
                <LinearGradient
                  colors={[accentPrimary, withAlpha(accentPrimary, 0.7)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    width: `${xpProgress}%`,
                    height: 8,
                  }}
                />
              </View>

              {/* Rewards hint */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                <Icon name="gift" size={14} color={muted} />
                <Text style={{ color: muted, fontSize: 11, fontWeight: '600', flex: 1 }}>
                  Earn XP by creating goals, contributing, and staying consistent
                </Text>
                <Icon name="chevron-right" size={14} color={muted} />
              </View>
            </View>
          </AnimatedPressable>
        )}
      </View>

      {/* Wealth Journey Sheet */}
      <WealthJourneySheet
        visible={showWealthJourney}
        onClose={() => setShowWealthJourney(false)}
        netWorth={netWorth}
        totalCash={totalCash}
        totalInvestments={totalInvestments}
        totalDebt={totalDebt}
        netWorthHistory={netWorthHistoryData.map(d => ({ t: d.t, v: d.cash + d.investments - d.debt }))}
      />
      </ScreenScroll>
    </>
  );
};

export default GoalsRoot;
