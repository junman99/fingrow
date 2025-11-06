import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Alert, Switch, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import { Card } from '../../components/Card';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGoalsStore } from '../../store/goals';
import { formatCurrency } from '../../lib/format';
import Icon from '../../components/Icon';
import Confetti from '../../components/Confetti';

const quickIncrements = [10, 25, 50, 100];
const cadenceOrder: Array<'weekly' | 'biweekly' | 'monthly'> = ['weekly', 'biweekly', 'monthly'];

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
  const [showConfetti, setShowConfetti] = useState(false);
  const [previousProgress, setPreviousProgress] = useState(0);

  // Check if goal just became complete
  useEffect(() => {
    if (!goal) return;
    const newProgress = goal.targetAmount > 0 ? Math.min(100, Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100)) : 0;

    // If we just hit 100%, show confetti!
    if (newProgress === 100 && previousProgress < 100 && previousProgress > 0) {
      setShowConfetti(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    setPreviousProgress(newProgress);
  }, [goal?.currentAmount, goal?.targetAmount]);

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
  const history = goal.history || [];
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const border = get('border.default') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;
  const dangerColor = get('semantic.danger') as string;

  // Calculate status
  let statusColor = successColor;
  let statusText = 'On Track';
  let statusIcon: any = 'check-circle';
  let progressColor = accentPrimary;
  let daysRemaining = 0;
  let monthsRemaining = 0;
  let monthlyNeeded = 0;
  const isComplete = progress >= 100;

  if (goal.targetDate && !isComplete) {
    const targetDate = new Date(goal.targetDate);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    monthsRemaining = daysRemaining / 30;

    if (remaining > 0 && daysRemaining > 0) {
      monthlyNeeded = remaining / monthsRemaining;
    }

    // Calculate time-based progress
    const startDate = new Date(goal.createdAt);
    const totalDuration = targetDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    const timeProgress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

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
    statusText = 'Completed';
    statusIcon = 'check-circle';
    progressColor = successColor;
  }

  const handleContribution = async (value: number, note?: string) => {
    if (value <= 0) {
      Alert.alert('Enter a positive amount');
      return;
    }
    const target = goal.targetAmount || 0;
    const current = goal.currentAmount || 0;
    const oldProgress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const projectedProgress = target > 0 ? Math.min(100, Math.round(((current + value) / target) * 100)) : 0;

    // Haptic feedback for milestones
    if (projectedProgress >= 100 && oldProgress < 100) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (
      (projectedProgress >= 75 && oldProgress < 75) ||
      (projectedProgress >= 50 && oldProgress < 50) ||
      (projectedProgress >= 25 && oldProgress < 25)
    ) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    await contribute(goal.id, value, note);
    setFeedback(`Saved ${formatCurrency(value)}! ${projectedProgress >= 100 ? 'Goal complete - time to celebrate!' : "Keep stacking, you're on a roll."}`);
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
    <>
      {showConfetti && <Confetti count={60} duration={3000} />}
      <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s20 }}>
          {/* Enhanced Header */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  nav.goBack();
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View style={{
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s8,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(surface2, isDark ? 0.8 : 1),
                  borderWidth: 1,
                  borderColor: borderSubtle,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.s6,
                }}>
                  <Icon name="arrow-left" size={16} color={textPrimary} />
                  <Text style={{ color: textPrimary, fontSize: 13, fontWeight: '600' }}>Back</Text>
                </View>
              </Pressable>

              <View style={{
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s8,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(statusColor, isDark ? 0.25 : 0.15),
                borderWidth: 1,
                borderColor: withAlpha(statusColor, 0.3),
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s6,
              }}>
                <Icon name={statusIcon} size={14} color={statusColor} />
                <Text style={{ color: statusColor, fontSize: 12, fontWeight: '700' }}>
                  {statusText}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginBottom: spacing.s8 }}>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: radius.lg,
                backgroundColor: withAlpha(progressColor, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: withAlpha(progressColor, 0.3),
              }}>
                <Text style={{ fontSize: 28 }}>{goal.icon || '🎯'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>
                  {goal.title}
                </Text>
                {goal.targetDate && (
                  <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s2 }}>
                    {isComplete
                      ? `Completed ${new Date(goal.completedAt || goal.updatedAt).toLocaleDateString()}`
                      : daysRemaining > 0
                      ? `${daysRemaining} days remaining`
                      : daysRemaining < 0
                      ? `${Math.abs(daysRemaining)} days overdue`
                      : 'Due today'
                    }
                  </Text>
                )}
              </View>
            </View>

            <Text style={{ color: textPrimary, fontSize: 44, fontWeight: '800', letterSpacing: -1, marginBottom: spacing.s4 }}>
              {formatCurrency(saved)}
            </Text>
            <Text style={{ color: textMuted, fontSize: 15 }}>
              of {formatCurrency(goal.targetAmount || 0)} · {progress}% complete
            </Text>
          </View>

        {/* Enhanced Progress Card */}
        <Card style={{ backgroundColor: withAlpha(progressColor, isDark ? 0.15 : 0.1), padding: spacing.s16, borderWidth: 1, borderColor: withAlpha(progressColor, 0.25) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s12 }}>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Progress Breakdown</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
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
              <View
                style={{
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(progressColor, isDark ? 0.3 : 0.2),
                  borderWidth: 1,
                  borderColor: withAlpha(progressColor, 0.4),
                }}
              >
                <Text style={{ color: progressColor, fontWeight: '800', fontSize: 13 }}>{progress}%</Text>
              </View>
            </View>
          </View>

          <View style={{ height: 14, borderRadius: radius.md, backgroundColor: withAlpha(surface2, isDark ? 0.3 : 0.5), overflow: 'hidden', marginBottom: spacing.s16 }}>
            <LinearGradient
              colors={[progressColor, withAlpha(progressColor, 0.7)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: `${progress}%`,
                height: 14,
              }}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
            <View>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Saved</Text>
              <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800', marginTop: spacing.s2 }}>
                {formatCurrency(saved)}
              </Text>
            </View>
            <View>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Remaining</Text>
              <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800', marginTop: spacing.s2 }}>
                {formatCurrency(remaining)}
              </Text>
            </View>
            <View>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Target</Text>
              <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800', marginTop: spacing.s2 }}>
                {formatCurrency(goal.targetAmount || 0)}
              </Text>
            </View>
          </View>

          {goal.targetDate && !isComplete && daysRemaining > 0 && monthlyNeeded > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: withAlpha(borderSubtle, 0.5), marginVertical: spacing.s12 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Monthly needed</Text>
                  <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '800', marginTop: spacing.s2 }}>
                    {formatCurrency(monthlyNeeded)}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Target date</Text>
                  <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '700', marginTop: spacing.s2 }}>
                    {new Date(goal.targetDate).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </>
          )}
        </Card>

        {/* Funding Breakdown */}
        {history.length > 0 && (() => {
          const contributions = history.filter(h => h.type === 'contribution');
          const roundups = history.filter(h => h.type === 'roundup');
          const adjustments = history.filter(h => h.type === 'adjust');

          const totalContributions = contributions.reduce((sum, h) => sum + h.amount, 0);
          const totalRoundups = roundups.reduce((sum, h) => sum + h.amount, 0);
          const totalAdjustments = adjustments.reduce((sum, h) => sum + h.amount, 0);

          const hasData = totalContributions > 0 || totalRoundups > 0 || totalAdjustments !== 0;

          if (!hasData) return null;

          return (
            <Card style={{ backgroundColor: surface1, padding: spacing.s16, borderWidth: 1, borderColor: border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s12 }}>
                <Icon name="pie-chart" size={18} color={accentPrimary} />
                <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Funding Breakdown</Text>
              </View>

              <View style={{ gap: spacing.s10 }}>
                {totalContributions > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accentPrimary }} />
                      <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '600' }}>
                        Manual deposits
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 12 }}>
                        ({contributions.length})
                      </Text>
                    </View>
                    <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '800' }}>
                      {formatCurrency(totalContributions)}
                    </Text>
                  </View>
                )}
                {totalRoundups > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accentSecondary }} />
                      <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '600' }}>
                        Round-ups
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 12 }}>
                        ({roundups.length})
                      </Text>
                    </View>
                    <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '800' }}>
                      {formatCurrency(totalRoundups)}
                    </Text>
                  </View>
                )}
                {totalAdjustments !== 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: totalAdjustments >= 0 ? successColor : warningColor }} />
                      <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '600' }}>
                        Adjustments
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 12 }}>
                        ({adjustments.length})
                      </Text>
                    </View>
                    <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '800' }}>
                      {totalAdjustments >= 0 ? '+' : ''}{formatCurrency(totalAdjustments)}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          );
        })()}

        {/* Quick Add */}
        <Card style={{ backgroundColor: surface1, padding: spacing.s16, gap: spacing.s12, borderWidth: 1, borderColor: border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Icon name="plus-circle" size={18} color={accentPrimary} />
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Add to Goal</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {quickIncrements.map(val => (
              <Pressable
                key={val}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleContribution(val);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s16,
                  paddingVertical: spacing.s10,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(accentPrimary, pressed ? 0.35 : 0.2),
                  borderWidth: 1,
                  borderColor: withAlpha(accentPrimary, 0.5)
                })}
              >
                <Text style={{ color: accentPrimary, fontWeight: '700' }}>+{formatCurrency(val)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ gap: spacing.s8 }}>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="decimal-pad"
              placeholder="Custom amount"
              placeholderTextColor={textMuted}
              style={{
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: borderSubtle,
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s16,
                color: textPrimary,
                backgroundColor: surface2,
                fontSize: 16,
              }}
            />
            <Button title="Add to goal" onPress={handleAddPress} />
            {feedback && (
              <Text style={{ color: successColor, fontSize: 13, textAlign: 'center', fontWeight: '600' }}>{feedback}</Text>
            )}
          </View>
        </Card>

        {/* Enhanced Settings */}
        <Card style={{ backgroundColor: surface1, padding: spacing.s16, gap: spacing.s12, borderWidth: 1, borderColor: border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Icon name="settings" size={18} color={accentPrimary} />
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Automation Settings</Text>
          </View>

          <View style={{ gap: spacing.s8 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: spacing.s8,
              paddingHorizontal: spacing.s12,
              backgroundColor: withAlpha(surface2, 0.5),
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: borderSubtle,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>Round-up savings</Text>
                <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s2 }}>
                  Round purchases to nearest dollar
                </Text>
              </View>
              <Switch
                value={!!goal.roundUps}
                onValueChange={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleRoundUps();
                }}
              />
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          <View style={{ gap: spacing.s8 }}>
            <View style={{
              paddingVertical: spacing.s8,
              paddingHorizontal: spacing.s12,
              backgroundColor: withAlpha(surface2, 0.5),
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: borderSubtle,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>Auto-save</Text>
                  <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s2 }}>
                    {goal.autoSave ? `Saving ${formatCurrency(goal.autoSave.amount)} ${goal.autoSave.cadence}` : 'Set recurring savings'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    cycleAutopilot();
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s6,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(accentPrimary, pressed ? 0.3 : 0.2),
                    borderWidth: 1,
                    borderColor: withAlpha(accentPrimary, 0.4),
                  })}
                >
                  <Text style={{ color: accentPrimary, fontWeight: '700', fontSize: 12 }}>
                    {goal.autoSave?.cadence ?? 'weekly'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={autoAmountInput}
                onChangeText={setAutoAmountInput}
                onBlur={handleAutoAmountBlur}
                keyboardType="decimal-pad"
                placeholder="20"
                placeholderTextColor={textMuted}
                style={{
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: borderSubtle,
                  paddingVertical: spacing.s10,
                  paddingHorizontal: spacing.s12,
                  color: textPrimary,
                  backgroundColor: surface2,
                  fontSize: 15,
                  fontWeight: '600',
                }}
              />
            </View>
          </View>
        </Card>

        {/* Enhanced History */}
        <View style={{ gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Icon name="clock" size={18} color={textPrimary} />
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Recent Activity</Text>
            {history.length > 0 && (
              <View style={{
                paddingHorizontal: spacing.s8,
                paddingVertical: spacing.s4,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
              }}>
                <Text style={{ color: accentPrimary, fontSize: 11, fontWeight: '800' }}>
                  {history.length}
                </Text>
              </View>
            )}
          </View>
          {history.length === 0 ? (
            <Card style={{ backgroundColor: surface1, padding: spacing.s20, alignItems: 'center', borderWidth: 1, borderColor: border }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: radius.lg,
                backgroundColor: withAlpha(textMuted, 0.1),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.s12,
              }}>
                <Icon name="inbox" size={24} color={textMuted} />
              </View>
              <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '700', marginBottom: spacing.s4 }}>
                No activity yet
              </Text>
              <Text style={{ color: textMuted, fontSize: 13, textAlign: 'center' }}>
                Start making contributions to track your progress
              </Text>
            </Card>
          ) : (
            <Card style={{ backgroundColor: surface1, padding: spacing.s16, gap: spacing.s8, borderWidth: 1, borderColor: border }}>
              {history.slice(0, 8).map((entry, idx) => {
                const typeColor = entry.type === 'contribution' ? accentPrimary : entry.type === 'roundup' ? accentSecondary : entry.amount >= 0 ? successColor : warningColor;
                const typeIcon = entry.type === 'contribution' ? 'plus-circle' : entry.type === 'roundup' ? 'repeat' : 'edit-3';

                return (
                  <View key={entry.id}>
                    {idx > 0 && <View style={{ height: 1, backgroundColor: borderSubtle, marginVertical: spacing.s8 }} />}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10, flex: 1 }}>
                        <View style={{
                          width: 36,
                          height: 36,
                          borderRadius: radius.md,
                          backgroundColor: withAlpha(typeColor, isDark ? 0.25 : 0.15),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Icon name={typeIcon} size={16} color={typeColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>
                            {entry.type === 'contribution' ? 'Manual Deposit' : entry.type === 'roundup' ? 'Round-up' : 'Adjustment'}
                          </Text>
                          <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s2 }}>
                            {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {entry.note ? ` · ${entry.note}` : ''}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: entry.amount >= 0 ? successColor : warningColor, fontWeight: '800', fontSize: 17 }}>
                        {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount)}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {history.length > 8 && (
                <>
                  <View style={{ height: 1, backgroundColor: borderSubtle, marginVertical: spacing.s8 }} />
                  <Text style={{ color: textMuted, fontSize: 12, textAlign: 'center' }}>
                    Showing 8 of {history.length} transactions
                  </Text>
                </>
              )}
            </Card>
          )}
        </View>

        {/* Contribution Stats */}
        {history.length > 0 && (
          <Card style={{ backgroundColor: withAlpha(accentPrimary, isDark ? 0.1 : 0.08), padding: spacing.s16, borderWidth: 1, borderColor: withAlpha(accentPrimary, 0.2) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s12 }}>
              <Icon name="trending-up" size={18} color={accentPrimary} />
              <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Stats</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Total Deposits</Text>
                <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                  {history.filter(h => h.type === 'contribution').length}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: borderSubtle }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Avg. Deposit</Text>
                <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                  {formatCurrency(
                    history.filter(h => h.type === 'contribution').length > 0
                      ? history.filter(h => h.type === 'contribution').reduce((sum, h) => sum + h.amount, 0) / history.filter(h => h.type === 'contribution').length
                      : 0
                  )}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: borderSubtle }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>Round-ups</Text>
                <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800', marginTop: spacing.s4 }}>
                  {history.filter(h => h.type === 'roundup').length}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Danger Zone */}
        <Card style={{ backgroundColor: withAlpha(dangerColor, isDark ? 0.1 : 0.05), padding: spacing.s16, borderWidth: 1, borderColor: withAlpha(dangerColor, 0.3) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s12 }}>
            <Icon name="alert-triangle" size={18} color={dangerColor} />
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 17 }}>Danger Zone</Text>
          </View>
          <Text style={{ color: textMuted, fontSize: 13, marginBottom: spacing.s12 }}>
            Deleting this goal will permanently remove all progress and history. This action cannot be undone.
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              deleteGoal();
            }}
            style={({ pressed }) => ({
              paddingVertical: spacing.s12,
              paddingHorizontal: spacing.s16,
              borderRadius: radius.md,
              backgroundColor: withAlpha(dangerColor, pressed ? 0.25 : 0.15),
              borderWidth: 1,
              borderColor: withAlpha(dangerColor, 0.4),
              alignItems: 'center',
            })}
          >
            <Text style={{ color: dangerColor, fontWeight: '700', fontSize: 15 }}>Delete Goal</Text>
          </Pressable>
        </Card>
      </View>
    </ScreenScroll>
    </>
  );
};

export default GoalDetail;
