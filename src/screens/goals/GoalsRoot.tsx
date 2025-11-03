import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Icon from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGoalsStore, type Goal } from '../../store/goals';
import { useAccountsStore } from '../../store/accounts';
import { useInvestStore } from '../../store/invest';
import { useTxStore } from '../../store/transactions';
import { formatCurrency } from '../../lib/format';
import Svg, { Circle, G } from 'react-native-svg';
import { useStreaksStore, getStreakMessage, getNextMilestone } from '../../store/streaks';
import { WealthJourneySheet } from '../../components/WealthJourneySheet';

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
  const { currentStreak, longestStreak, recordVisit, hydrate: hydrateStreaks } = useStreaksStore();
  const [activeTab, setActiveTab] = useState<TabType>('milestone');
  const [showWealthJourney, setShowWealthJourney] = useState(false);

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
      .filter(a => a.includeInNetWorth !== false)
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

  const renderGoalCard = (goal: Goal) => {
    const progress = goal.targetAmount > 0
      ? Math.min(100, Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100))
      : 0;
    const remaining = Math.max(0, (goal.targetAmount || 0) - (goal.currentAmount || 0));
    const isComplete = progress >= 100 || !!goal.completedAt;
    const progressColor = isComplete ? successColor : accentPrimary;

    let daysRemaining: number | null = null;
    let monthlyNeeded = 0;
    if (goal.targetDate && !isComplete) {
      const targetDate = new Date(goal.targetDate);
      const today = new Date();
      const diffTime = targetDate.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (remaining > 0 && daysRemaining > 0) {
        const monthsRemaining = daysRemaining / 30;
        monthlyNeeded = remaining / monthsRemaining;
      }
    }

    return (
      <AnimatedPressable
        key={goal.id}
        onPress={() => nav.navigate('GoalDetail', { goalId: goal.id, mode: 'journey' })}
        style={{ marginBottom: spacing.s12 }}
      >
        <View
          style={{
            backgroundColor: isComplete ? withAlpha(successColor, isDark ? 0.15 : 0.08) : cardBg,
            borderRadius: radius.xl,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: isComplete ? withAlpha(successColor, 0.3) : border,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: spacing.s12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s8 }}>
                {goal.icon && <Text style={{ fontSize: 28 }}>{goal.icon}</Text>}
                {goal.isPinned && (
                  <View style={{
                    backgroundColor: withAlpha(warningColor, isDark ? 0.25 : 0.15),
                    paddingHorizontal: spacing.s8,
                    paddingVertical: spacing.s4,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: withAlpha(warningColor, 0.3),
                  }}>
                    <Text style={{ color: warningColor, fontSize: 11, fontWeight: '700' }}>PINNED</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginBottom: spacing.s6 }}>
                {goal.title}
              </Text>
              <Text style={{ color: muted, fontSize: 14, fontWeight: '600', marginBottom: spacing.s4 }}>
                {formatCurrency(goal.currentAmount || 0)} of {formatCurrency(goal.targetAmount)}
              </Text>
              {!isComplete && remaining > 0 && (
                <Text style={{ color: muted, fontSize: 13 }}>
                  {formatCurrency(remaining)} remaining
                </Text>
              )}
              {isComplete && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6, marginTop: spacing.s4 }}>
                  <Icon name="check-circle" size={16} color={successColor} />
                  <Text style={{ color: successColor, fontSize: 14, fontWeight: '700' }}>
                    Complete!
                  </Text>
                </View>
              )}
            </View>

            <View style={{ alignItems: 'center' }}>
              <View style={{ position: 'relative' }}>
                <AnimatedRing
                  progress={progress}
                  size={70}
                  strokeWidth={6}
                  color={progressColor}
                />
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Text style={{ color: text, fontSize: 18, fontWeight: '800' }}>
                    {progress}%
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {!isComplete && daysRemaining !== null && (
            <View style={{
              marginTop: spacing.s12,
              paddingTop: spacing.s12,
              borderTopWidth: 1,
              borderTopColor: border,
              flexDirection: 'row',
              justifyContent: 'space-between'
            }}>
              {daysRemaining > 0 ? (
                <>
                  <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>
                    {daysRemaining} days left
                  </Text>
                  {monthlyNeeded > 0 && (
                    <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>
                      {formatCurrency(monthlyNeeded)}/mo needed
                    </Text>
                  )}
                </>
              ) : (
                <Text style={{ color: warningColor, fontSize: 13, fontWeight: '600' }}>
                  {Math.abs(daysRemaining)} days overdue
                </Text>
              )}
            </View>
          )}
        </View>
      </AnimatedPressable>
    );
  };

  return (
    <ScreenScroll inTab contentStyle={{ paddingBottom: Math.max(insets.bottom, spacing.s24) }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>

        {/* Header like Money tab */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>
            Goals
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            {/* Wealth Journey Button */}
            <AnimatedPressable onPress={() => setShowWealthJourney(true)}>
              <View style={{
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s8,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(successColor, isDark ? 0.25 : 0.15),
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s6,
                borderWidth: 1,
                borderColor: withAlpha(successColor, 0.3),
              }}>
                <Icon name="trending-up" size={16} color={successColor} />
                <Text style={{ color: text, fontSize: 13, fontWeight: '700' }}>
                  Journey
                </Text>
              </View>
            </AnimatedPressable>
            {/* Achievements Badge */}
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
                  {achievements.length > 0 ? `${achievements.length} Badge${achievements.length !== 1 ? 's' : ''}` : 'Badges'}
                </Text>
              </View>
            </AnimatedPressable>
          </View>
        </View>

        {/* Streak Counter */}
        {currentStreak > 0 && (
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: border,
              padding: spacing.s16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.s12,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.md,
                backgroundColor: successColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="zap" size={28} colorToken="text.onPrimary" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s4 }}>
                <Text style={{ color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
                  {currentStreak}
                </Text>
                <Text style={{ color: muted, fontSize: 14, fontWeight: '600' }}>
                  day streak
                </Text>
              </View>
              <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s2 }}>
                {getStreakMessage(currentStreak)}
              </Text>
              {getNextMilestone(currentStreak) && (
                <View
                  style={{
                    marginTop: spacing.s8,
                    paddingHorizontal: spacing.s10,
                    paddingVertical: spacing.s4,
                    borderRadius: radius.pill,
                    backgroundColor: surface2,
                    alignSelf: 'flex-start',
                  }}
                >
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>
                    {getNextMilestone(currentStreak)!.days - currentStreak} days to {getNextMilestone(currentStreak)!.label}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Hero - Level & XP */}
        <View style={{
          backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08),
          borderRadius: radius.xl,
          padding: spacing.s16,
          borderWidth: 1,
          borderColor: withAlpha(accentPrimary, 0.2),
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.s12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, fontSize: 13, fontWeight: '600', marginBottom: spacing.s4 }}>
                YOUR LEVEL
              </Text>
              <Text style={{ color: text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>
                {level}
              </Text>
            </View>
          </View>

          <View style={{ gap: spacing.s6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>
                {xp} / {currentLevelXP} XP
              </Text>
              <Text style={{ color: muted, fontSize: 13 }}>
                {Math.round(currentLevelXP - xp)} to Level {level + 1}
              </Text>
            </View>
            <View style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.1),
              overflow: 'hidden'
            }}>
              <View style={{
                width: `${xpProgress}%`,
                height: 8,
                backgroundColor: accentPrimary,
              }} />
            </View>
          </View>
        </View>

        {/* Tab Switcher - Metrics */}
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <AnimatedPressable
            onPress={() => setActiveTab('milestone')}
            style={{ flex: 1 }}
          >
            <View style={{
              backgroundColor: cardBg,
              borderRadius: radius.lg,
              padding: spacing.s16,
              borderWidth: 2,
              borderColor: activeTab === 'milestone' ? accentPrimary : border,
            }}>
              <Icon name="target" size={22} colorToken="accent.primary" />
              <Text style={{ color: text, fontSize: 22, fontWeight: '800', marginTop: spacing.s8 }}>
                {milestoneGoals.length}
              </Text>
              <Text style={{ color: muted, fontSize: 13, fontWeight: '600', marginTop: spacing.s4 }}>
                Milestone{milestoneGoals.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => setActiveTab('networth')}
            style={{ flex: 1 }}
          >
            <View style={{
              backgroundColor: cardBg,
              borderRadius: radius.lg,
              padding: spacing.s16,
              borderWidth: 2,
              borderColor: activeTab === 'networth' ? accentSecondary : border,
            }}>
              <Icon name="trending-up" size={22} colorToken="accent.secondary" />
              <Text style={{ color: text, fontSize: 22, fontWeight: '800', marginTop: spacing.s8 }}>
                {networthGoals.length}
              </Text>
              <Text style={{ color: muted, fontSize: 13, fontWeight: '600', marginTop: spacing.s4 }}>
                Net Worth
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

        {/* Create Button */}
        <AnimatedPressable
          onPress={() => nav.navigate('GoalCreate', { type: activeTab })}
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
  );
};

export default GoalsRoot;
