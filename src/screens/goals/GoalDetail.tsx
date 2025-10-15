import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGoalsStore } from '../../store/goals';
import { formatCurrency } from '../../lib/format';
import Icon from '../../components/Icon';

const quickIncrements = [10, 25, 50, 100];
const cadenceOrder: Array<'weekly' | 'biweekly' | 'monthly'> = ['weekly', 'biweekly', 'monthly'];

const stageText = (pct: number) => {
  if (pct >= 100) return { title: 'Victory lap unlocked!', subtitle: 'You crushed this goal—take a bow and plan the next adventure.' };
  if (pct >= 75) return { title: 'Final stretch!', subtitle: 'One more push and the finish line is yours.' };
  if (pct >= 50) return { title: 'Momentum hero', subtitle: 'Halfway there and accelerating. Keep the streak alive!' };
  if (pct >= 25) return { title: 'Making it happen', subtitle: 'Your goal is officially in motion. Stay consistent!' };
  return { title: 'Fresh start', subtitle: 'Set the pace now and future-you will thank you.' };
};

const journeyBadges = (goal: any, pct: number) => {
  const badges: { icon: string; label: string; description: string }[] = [];
  const saved = goal.currentAmount || 0;
  const target = goal.targetAmount || 0;
  if (pct >= 100) badges.push({ icon: '🏆', label: 'Goal Crusher', description: 'Completed the entire journey. Legend status.' });
  if (goal.history.length >= 5) badges.push({ icon: '📈', label: 'Consistency Champ', description: 'Logged 5+ savings boosts without giving up.' });
  if (goal.roundUps) badges.push({ icon: '🪙', label: 'Round-up Rookie', description: 'Spare change now fuels your dreams.' });
  if (goal.autoSave) badges.push({ icon: '⏱️', label: 'Autopilot Pro', description: `Auto-saving ${formatCurrency(goal.autoSave.amount)} ${goal.autoSave.cadence}.` });
  if (saved >= target * 0.5 && saved < target) badges.push({ icon: '⚡️', label: 'Halfway Hero', description: 'More than 50% done—keep pushing.' });
  if (badges.length === 0) badges.push({ icon: '🚀', label: 'Getting Started', description: 'Every win begins with the first step.' });
  return badges.slice(0, 3);
};

const GoalDetail: React.FC = () => {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const { goals, contribute, removeGoal, setRoundUps, setAutoSave } = useGoalsStore();

  const goalId = route.params?.goalId as string;
  const initialMode = (route.params?.mode as 'journey' | 'add') || 'journey';
  const goal = (goals || []).find(g => g.id === goalId);

  const [activeTab, setActiveTab] = useState<'journey' | 'add'>(initialMode);
  const [amountInput, setAmountInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [autoAmountInput, setAutoAmountInput] = useState(String(goal?.autoSave?.amount ?? 20));

  if (!goal) {
    return (
      <ScreenScroll contentStyle={{ padding: spacing.s16 }}>
        <Text style={{ color: get('text.muted') as string }}>Goal not found.</Text>
      </ScreenScroll>
    );
  }

  const progress = goal.targetAmount > 0 ? Math.min(100, Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100)) : 0;
  const remaining = Math.max(0, (goal.targetAmount || 0) - (goal.currentAmount || 0));
  const saved = goal.currentAmount || 0;
  const stage = stageText(progress);
  const badges = journeyBadges(goal, progress);
  const history = goal.history || [];
  const nextMilestonePct = [100, 90, 75, 50, 25].reverse().find(p => p > progress) ?? 100;
  const nextMilestoneAmount = Math.max(0, Math.round(((nextMilestonePct / 100) * (goal.targetAmount || 0)) - saved));
  const heroGradient: [string, string] = isDark ? ['#0d111f', '#19142c'] : [get('accent.primary') as string, get('accent.secondary') as string];

  const handleContribution = async (value: number, note?: string) => {
    if (value <= 0) {
      Alert.alert('Enter a positive amount');
      return;
    }
    const target = goal.targetAmount || 0;
    const current = goal.currentAmount || 0;
    const projectedProgress = target > 0 ? Math.min(100, Math.round(((current + value) / target) * 100)) : 0;
    await contribute(goal.id, value, note);
    setFeedback(`Saved ${formatCurrency(value)}! ${projectedProgress >= 100 ? 'Goal complete—time to celebrate!' : 'Keep stacking, you’re on a roll.'}`);
    setAmountInput('');
  };

  const handleAddPress = () => {
    const value = Number(amountInput);
    if (!value || value <= 0) {
      Alert.alert('Enter a valid amount');
      return;
    }
    handleContribution(value);
  };

  const toggleRoundUps = async () => {
    await setRoundUps(goal.id, !goal.roundUps);
  };

  const cycleAutopilot = async () => {
    const current = goal.autoSave?.cadence ?? 'weekly';
    const index = cadenceOrder.indexOf(current);
    const next = cadenceOrder[(index + 1) % cadenceOrder.length];
    const amount = Math.max(1, Number(autoAmountInput) || 0);
    await setAutoSave(goal.id, next, amount);
    setFeedback(`Autosave scheduled ${next} for ${formatCurrency(amount)}.`);
  };

  const handleAutoAmountBlur = async () => {
    const amount = Math.max(1, Number(autoAmountInput) || 0);
    setAutoAmountInput(String(amount));
    const cadence = goal.autoSave?.cadence ?? 'weekly';
    await setAutoSave(goal.id, cadence, amount);
  };

  const deleteGoal = async () => {
    Alert.alert('Delete goal', 'Are you sure you want to remove this goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeGoal(goal.id);
          nav.goBack();
        }
      }
    ]);
  };

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s12
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: spacing.s8, gap: spacing.s4 }}>
              <Text style={{ color: withAlpha('#ffffff', 0.7), fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' }}>
                {goal.icon ? `${goal.icon} ` : ''}Savings journey
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800' }}>{goal.title}</Text>
              <Text style={{ color: withAlpha('#ffffff', 0.75) }}>
                {formatCurrency(saved)} / {formatCurrency(goal.targetAmount || 0)} saved · {progress}% complete
              </Text>
            </View>
            <View style={{
              borderRadius: radius.lg,
              paddingHorizontal: spacing.s12,
              paddingVertical: spacing.s8,
              backgroundColor: withAlpha('#ffffff', isDark ? 0.16 : 0.2)
            }}>
              <Text style={{ color: '#ffffff', fontWeight: '700' }}>{stage.title}</Text>
            </View>
          </View>

          <View style={{ height: 10, borderRadius: 5, backgroundColor: withAlpha('#ffffff', 0.2), overflow: 'hidden' }}>
            <View
              style={{
                width: `${progress}%`,
                height: 10,
                borderRadius: 5,
                backgroundColor: '#ffffff'
              }}
            />
          </View>
          <Text style={{ color: withAlpha('#ffffff', 0.85), fontSize: 14 }}>
            {stage.subtitle}
          </Text>
        </LinearGradient>

        <View style={{
          flexDirection: 'row',
          backgroundColor: withAlpha(get('surface.level2') as string, 0.6),
          borderRadius: radius.pill,
          padding: spacing.s4,
          gap: spacing.s4
        }}>
          {[
            { value: 'journey', label: 'Journey' },
            { value: 'add', label: 'Add savings' }
          ].map(opt => {
            const active = activeTab === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setActiveTab(opt.value as typeof activeTab)}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: radius.pill,
                  backgroundColor: active ? get('accent.primary') as string : 'transparent',
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1
                })}
              >
                <Text style={{ color: active ? get('text.onPrimary') as string : get('text.primary') as string, fontWeight: '600' }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'add' ? (
          <View style={{
            backgroundColor: get('surface.level1') as string,
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s12,
            borderWidth: 1,
            borderColor: withAlpha(get('border.subtle') as string, isDark ? 0.6 : 1)
          }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16 }}>Boost your savings</Text>
            <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>
              Every boost edges you closer. Just {formatCurrency(remaining)} left to conquer this goal.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
              {quickIncrements.map(val => (
                <Pressable
                  key={val}
                  onPress={() => handleContribution(val)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s10,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(get('accent.primary') as string, pressed ? 0.35 : 0.2),
                    borderWidth: 1,
                    borderColor: withAlpha(get('accent.primary') as string, 0.5)
                  })}
                >
                  <Text style={{ color: get('accent.primary') as string, fontWeight: '700' }}>+{formatCurrency(val)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>Custom amount</Text>
              <TextInput
                value={amountInput}
                onChangeText={setAmountInput}
                keyboardType="decimal-pad"
                placeholder="Enter amount"
                placeholderTextColor={get('text.muted') as string}
                style={{
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: withAlpha(get('border.subtle') as string, 0.8),
                  paddingVertical: spacing.s10,
                  paddingHorizontal: spacing.s12,
                  color: get('text.primary') as string,
                  backgroundColor: get('surface.level2') as string
                }}
              />
              <Button title="Add to goal" onPress={handleAddPress} />
              {feedback ? (
                <Text style={{ color: get('semantic.success') as string, fontSize: 12 }}>{feedback}</Text>
              ) : null}
            </View>

            <View style={{
              borderRadius: radius.lg,
              padding: spacing.s12,
              backgroundColor: withAlpha(get('accent.primary') as string, isDark ? 0.12 : 0.08),
              gap: spacing.s8
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>Round-up savings</Text>
                <Switch value={!!goal.roundUps} onValueChange={toggleRoundUps} />
              </View>
              <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>
                Round-ups scoop change from daily purchases right into this goal.
              </Text>
            </View>

            <View style={{
              borderRadius: radius.lg,
              padding: spacing.s12,
              backgroundColor: get('surface.level2') as string,
              gap: spacing.s8
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>Autosave plan</Text>
                <Pressable onPress={cycleAutopilot} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ color: get('accent.primary') as string, fontWeight: '600', fontSize: 12 }}>
                    Cycle cadence
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={autoAmountInput}
                onChangeText={setAutoAmountInput}
                onBlur={handleAutoAmountBlur}
                keyboardType="decimal-pad"
                placeholder="20"
                placeholderTextColor={get('text.muted') as string}
                style={{
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: withAlpha(get('border.subtle') as string, 0.7),
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s10,
                  color: get('text.primary') as string,
                  backgroundColor: get('surface.level1') as string
                }}
              />
              <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>
                Current cadence: {goal.autoSave?.cadence ?? 'weekly'} · {goal.autoSave ? formatCurrency(goal.autoSave.amount) : 'Not set yet'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{
            backgroundColor: get('surface.level1') as string,
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s12,
            borderWidth: 1,
            borderColor: withAlpha(get('border.subtle') as string, isDark ? 0.6 : 1)
          }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16 }}>Milestones & achievements</Text>
            <View style={{ gap: spacing.s8 }}>
              {badges.map(badge => (
                <View key={badge.label} style={{ flexDirection: 'row', gap: spacing.s8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20 }}>{badge.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>{badge.label}</Text>
                    <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>{badge.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={{
              borderRadius: radius.lg,
              padding: spacing.s12,
              backgroundColor: get('surface.level2') as string,
              gap: spacing.s8
            }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>Next milestone</Text>
              <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>
                Reach {nextMilestonePct}% by adding {formatCurrency(nextMilestoneAmount)} more.
              </Text>
            </View>

            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Savings timeline</Text>
              {history.length === 0 ? (
                <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>No boost entries yet. Your story starts with the first contribution.</Text>
              ) : (
                history.slice(0, 6).map(entry => (
                  <View key={entry.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.s8 }}>
                    <View>
                      <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>
                        {entry.type === 'contribution' ? 'Contribution' : entry.type === 'roundup' ? 'Round-up' : 'Adjust'}
                      </Text>
                      <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>
                        {new Date(entry.date).toLocaleDateString()} {entry.note ? `· ${entry.note}` : ''}
                      </Text>
                    </View>
                    <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>
                      {entry.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(entry.amount))}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        <Button variant="ghost" title="Back to goals" onPress={() => nav.goBack()} />
        <Pressable onPress={deleteGoal} style={{ alignItems: 'center', paddingVertical: spacing.s12 }}>
          <Text style={{ color: get('semantic.danger') as string, fontWeight: '600' }}>Delete goal</Text>
        </Pressable>
      </View>
    </ScreenScroll>
  );
};

export default GoalDetail;

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
