import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGoalsStore } from '../../store/goals';
import { formatCurrency } from '../../lib/format';

type Goal = ReturnType<typeof useGoalsStore>['goals'][number];

const milestoneLabels = [25, 50, 75, 90, 100];
const motivationBank = [
  'Every dollar is a vote for your future self.',
  'Momentum unlocked! Keep stacking those wins.',
  'Your future self just fist-bumped you.',
  'You’re crafting freedom with every save.',
  'Look at you, turning dreams into line items!',
  'The finish line is waving you forward.',
  'Small saves, big flex. Keep going!',
  'Savings streak! Your goal just leveled up.',
  'Rain or shine, your hustle stays consistent.',
  'You’re not just saving—you’re building a story.'
];

function getMotivation(indexSeed: number, pct: number) {
  if (pct >= 100) {
    return 'Goal conquered! Queue the confetti and pick your next adventure.';
  }
  if (pct >= 75) {
    return 'Final lap! One more push and you’ll be legendary.';
  }
  if (pct >= 50) {
    return 'You’re past halfway! Momentum is totally on your side.';
  }
  if (pct >= 25) {
    return 'Quarter down already—your habit is paying off.';
  }
  return motivationBank[indexSeed % motivationBank.length];
}

function getBadgeSet(progress: number, goalCount: number) {
  const badges: { label: string; icon: string }[] = [];
  if (goalCount >= 3) badges.push({ label: 'Multi-Goal Master', icon: '🎯' });
  if (progress >= 80) badges.push({ label: 'Momentum Hero', icon: '⚡️' });
  if (progress >= 100) badges.push({ label: 'Goal Crusher', icon: '🏆' });
  if (badges.length === 0) badges.push({ label: 'Fresh Start', icon: '🚀' });
  return badges.slice(0, 3);
}

const GoalCard: React.FC<{
  goal: Goal;
  onPress: () => void;
  onCelebrate: () => void;
}> = ({ goal, onPress, onCelebrate }) => {
  const { get, isDark } = useThemeTokens();
  const progress = goal.targetAmount > 0 ? Math.min(100, Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100)) : 0;
  const remaining = Math.max(0, (goal.targetAmount || 0) - (goal.currentAmount || 0));
  const nextMilestone = milestoneLabels.find(m => m > progress) ?? 100;
  const milestoneDelta = Math.max(0, Math.round(((nextMilestone / 100) * (goal.targetAmount || 0)) - (goal.currentAmount || 0)));
  const accent = get('accent.primary') as string;
  const surface2 = get('surface.level2') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const progressColor = progress >= 100 ? get('semantic.success') as string : accent;
  const ringBackground = withAlpha(surface2, isDark ? 0.4 : 0.8);
  const sparkEmoji = progress >= 100 ? '🎉' : progress >= 75 ? '🔥' : progress >= 40 ? '💪' : '✨';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: radius.xl,
        padding: spacing.s16,
        backgroundColor: get('surface.level1') as string,
        borderWidth: 1,
        borderColor: withAlpha(get('border.subtle') as string, isDark ? 0.5 : 1),
        opacity: pressed ? 0.9 : 1,
        gap: spacing.s12
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: spacing.s8 }}>
          <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>Saving for</Text>
          <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
            {goal.icon ? `${goal.icon} ` : ''}{goal.title}
          </Text>
          <Text style={{ color: textMuted, marginTop: spacing.s4 }}>
            {formatCurrency(goal.currentAmount || 0)} saved · {progress}% complete
          </Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={onCelebrate}
          style={({ pressed }) => ({
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: ringBackground,
            borderWidth: 2,
            borderColor: progressColor,
            opacity: pressed ? 0.85 : 1
          })}
        >
          <Text style={{ fontSize: 24 }}>{sparkEmoji}</Text>
        </Pressable>
      </View>

      <View style={{ height: 10, borderRadius: 5, backgroundColor: withAlpha(surface2, 0.7), overflow: 'hidden' }}>
        <View
          style={{
            width: `${progress}%`,
            height: 10,
            borderRadius: 5,
            backgroundColor: progressColor
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: textMuted, fontSize: 12 }}>
          {progress >= 100
            ? 'Done and dusted. Time to celebrate!'
            : `Just ${formatCurrency(remaining)} to go · ${nextMilestone}% badge in ${formatCurrency(milestoneDelta)}`
          }
        </Text>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s4,
            opacity: pressed ? 0.7 : 1
          })}
        >
          <Text style={{ color: get('accent.primary') as string, fontWeight: '700', fontSize: 12 }}>View journey</Text>
          <Icon name="chevron-right" size={16} colorToken="accent.primary" />
        </Pressable>
      </View>
    </Pressable>
  );
};

const GoalsRoot: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { get, isDark } = useThemeTokens();
  const { goals, hydrate } = useGoalsStore();

  useEffect(() => { hydrate(); }, [hydrate]);

  const totals = useMemo(() => {
    if (!goals || goals.length === 0) return { saved: 0, target: 0, pct: 0 };
    const saved = goals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);
    const target = goals.reduce((acc, g) => acc + (g.targetAmount || 0), 0);
    const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    return { saved, target, pct };
  }, [goals]);

  const topGoal = useMemo(() => {
    if (!goals || goals.length === 0) return undefined;
    return [...goals].sort((a, b) => {
      const aPct = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
      const bPct = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
      return bPct - aPct;
    })[0];
  }, [goals]);

  const heroMessage = getMotivation((goals?.length || 1) * 7, totals.pct);
  const badges = getBadgeSet(totals.pct, goals?.length || 0);
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const heroGradient: [string, string] = isDark ? ['#0d111f', '#19142c'] : [accentPrimary, accentSecondary];
  const heroText = isDark ? '#f2f5ff' : get('text.onPrimary') as string;
  const heroTextMuted = withAlpha(heroText, 0.72);
  const badgeAccent = isDark ? '#9cecff' : accentPrimary;

  return (
    <ScreenScroll contentStyle={{ paddingBottom: Math.max(insets.bottom, spacing.s24) }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
        <LinearGradient
          colors={isDark ? ['#0d111f', '#18152d'] : [accentPrimary, accentSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s12
          }}
        >
          <Text style={{ color: heroTextMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' }}>
            Savings quest
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ color: heroText, fontSize: 28, fontWeight: '800' }}>
                {formatCurrency(totals.saved)}
              </Text>
              <Text style={{ color: heroTextMuted, marginTop: spacing.s4 }}>
                Saved across {goals?.length || 0} goal{goals && goals.length === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={{
              borderRadius: radius.lg,
              paddingHorizontal: spacing.s12,
              paddingVertical: spacing.s8,
              backgroundColor: withAlpha(heroText, isDark ? 0.18 : 0.24)
            }}>
              <Text style={{ color: heroText, fontWeight: '700' }}>{totals.pct}% complete</Text>
            </View>
          </View>
          <Text style={{ color: heroTextMuted, fontSize: 14 }}>
            {heroMessage}
          </Text>
          <Button
            variant="secondary"
            title="+ Launch new goal"
            onPress={() => nav.navigate('GoalCreate')}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: withAlpha(heroText, isDark ? 0.22 : 0.18),
              borderColor: withAlpha(heroText, 0.28)
            }}
          />
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s8 }}>
          {badges.map(badge => (
            <View
              key={badge.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s6,
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s8,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(badgeAccent, isDark ? 0.25 : 0.14),
                borderWidth: 1,
                borderColor: withAlpha(badgeAccent, 0.45)
              }}
            >
              <Text style={{ fontSize: 14 }}>{badge.icon}</Text>
              <Text style={{ color: badgeAccent, fontWeight: '700', fontSize: 12 }}>{badge.label}</Text>
            </View>
          ))}
        </ScrollView>

        {topGoal && (
          <View style={{
            borderRadius: radius.xl,
            padding: spacing.s16,
            backgroundColor: get('surface.level1') as string,
            borderWidth: 1,
            borderColor: withAlpha(get('border.subtle') as string, isDark ? 0.6 : 1),
            gap: spacing.s8
          }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>
              Highlight: {topGoal.icon ? `${topGoal.icon} ` : ''}{topGoal.title}
            </Text>
            <Text style={{ color: get('text.muted') as string }}>
              You’re {Math.min(100, Math.round(((topGoal.currentAmount || 0) / Math.max(1, topGoal.targetAmount || 1)) * 100))}% of the way there. Keep the streak alive!
            </Text>
            <Button
              size="sm"
              variant="secondary"
              title="Add savings"
              onPress={() => nav.navigate('GoalDetail', { goalId: topGoal.id, mode: 'add' })}
              style={{ alignSelf: 'flex-start' }}
            />
            <Pressable
              onPress={() => nav.navigate('GoalDetail', { goalId: topGoal.id, mode: 'journey' })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: spacing.s4,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1
              })}
            >
              <Text style={{ color: get('accent.primary') as string, fontWeight: '700', fontSize: 12 }}>View journey</Text>
              <Icon name="chevron-right" size={16} colorToken="accent.primary" />
            </Pressable>
          </View>
        )}

        {(goals || []).length === 0 ? (
          <View style={{
            padding: spacing.s20,
            backgroundColor: get('surface.level1') as string,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: withAlpha(get('border.subtle') as string, isDark ? 0.6 : 1),
            gap: spacing.s12,
            alignItems: 'flex-start'
          }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }}>No goals yet</Text>
            <Text style={{ color: get('text.muted') as string }}>
              Plant a goal, set your target, and we’ll track your climb with confetti, badges, and nudges.
            </Text>
            <Button title="Start my first goal" onPress={() => nav.navigate('GoalCreate')} />
          </View>
        ) : (
          <View style={{ gap: spacing.s12 }}>
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onPress={() => nav.navigate('GoalDetail', { goalId: goal.id, mode: 'journey' })}
                onCelebrate={() => nav.navigate('GoalDetail', { goalId: goal.id, mode: 'add' })}
              />
            ))}
          </View>
        )}
      </View>
    </ScreenScroll>
  );
};

export default GoalsRoot;

function withAlpha(hex: string, alpha: number) {
  if (!hex || typeof hex !== 'string') return hex;
  if (hex.startsWith('#')) {
    const clean = hex.slice(1, 7);
    const padded = clean.length === 6 ? clean : clean.padEnd(6, '0');
    const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
    return `#${padded}${a}`;
  }
  if (hex.startsWith('rgba')) {
    return hex.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
      const parts = inner.split(',').map(p => p.trim());
      if (parts.length < 3) return hex;
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }
  return hex;
}
