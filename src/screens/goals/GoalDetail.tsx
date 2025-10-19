import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Switch, ScrollView } from 'react-native';
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
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;
  const progressColor = progress >= 100 ? successColor : accentPrimary;

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
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s24 }}>
        {/* Header */}
        <View>
          <Text style={{ color: textMuted, fontSize: 14, fontWeight: '600', marginBottom: spacing.s4 }}>
            {goal.icon ? `${goal.icon} ` : ''}{goal.title}
          </Text>
          <Text style={{ color: textPrimary, fontSize: 40, fontWeight: '800', letterSpacing: -0.5 }}>
            {formatCurrency(saved)}
          </Text>
          <Text style={{ color: textMuted, marginTop: spacing.s4 }}>
            of {formatCurrency(goal.targetAmount || 0)} · {progress}% complete
          </Text>
        </View>

        {/* Progress Card */}
        <Card style={{ backgroundColor: withAlpha(progressColor, isDark ? 0.2 : 0.12), padding: spacing.s16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s12 }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Progress</Text>
            <View
              style={{
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s6,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(textPrimary, isDark ? 0.15 : 0.1),
              }}
            >
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 12 }}>{progress}%</Text>
            </View>
          </View>

          <View style={{ height: 12, borderRadius: 6, backgroundColor: withAlpha(surface2, 0.5), overflow: 'hidden', marginBottom: spacing.s12 }}>
            <View
              style={{
                width: `${progress}%`,
                height: 12,
                borderRadius: 6,
                backgroundColor: progressColor
              }}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: textMuted, fontSize: 12 }}>Saved</Text>
              <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                {formatCurrency(saved)}
              </Text>
            </View>
            <View>
              <Text style={{ color: textMuted, fontSize: 12 }}>Remaining</Text>
              <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                {formatCurrency(remaining)}
              </Text>
            </View>
            <View>
              <Text style={{ color: textMuted, fontSize: 12 }}>Target</Text>
              <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
                {formatCurrency(goal.targetAmount || 0)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Add */}
        <Card style={{ backgroundColor: surface1, padding: spacing.s16, gap: spacing.s12 }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Add to goal</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {quickIncrements.map(val => (
              <Pressable
                key={val}
                onPress={() => handleContribution(val)}
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
              <Text style={{ color: successColor, fontSize: 13, textAlign: 'center' }}>{feedback}</Text>
            )}
          </View>
        </Card>

        {/* Settings */}
        <Card style={{ backgroundColor: surface1, padding: spacing.s16, gap: spacing.s12 }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Settings</Text>

          <View style={{ gap: spacing.s8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: textPrimary, fontWeight: '600' }}>Round-up savings</Text>
              <Switch value={!!goal.roundUps} onValueChange={toggleRoundUps} />
            </View>
            <Text style={{ color: textMuted, fontSize: 12 }}>
              Automatically round up purchases to the nearest dollar
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          <View style={{ gap: spacing.s8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: textPrimary, fontWeight: '600' }}>Auto-save</Text>
              <Pressable onPress={cycleAutopilot} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ color: accentPrimary, fontWeight: '600', fontSize: 13 }}>
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
                backgroundColor: surface2
              }}
            />
            <Text style={{ color: textMuted, fontSize: 12 }}>
              {goal.autoSave ? `Auto-saving ${formatCurrency(goal.autoSave.amount)} ${goal.autoSave.cadence}` : 'Set an amount to auto-save'}
            </Text>
          </View>
        </Card>

        {/* History */}
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Savings history</Text>
          {history.length === 0 ? (
            <Card style={{ backgroundColor: surface1, padding: spacing.s16 }}>
              <Text style={{ color: textMuted, fontSize: 14 }}>
                No contributions yet. Start saving to see your history.
              </Text>
            </Card>
          ) : (
            <Card style={{ backgroundColor: surface1, padding: spacing.s16, gap: spacing.s8 }}>
              {history.slice(0, 6).map((entry, idx) => (
                <View key={entry.id}>
                  {idx > 0 && <View style={{ height: 1, backgroundColor: borderSubtle, marginVertical: spacing.s8 }} />}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ color: textPrimary, fontWeight: '600' }}>
                        {entry.type === 'contribution' ? 'Contribution' : entry.type === 'roundup' ? 'Round-up' : 'Adjustment'}
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 12, marginTop: 2 }}>
                        {new Date(entry.date).toLocaleDateString()}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </Text>
                    </View>
                    <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                      {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount)}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>

        <Button variant="ghost" title="Back to goals" onPress={() => nav.goBack()} />
        <Pressable onPress={deleteGoal} style={{ alignItems: 'center', paddingVertical: spacing.s12 }}>
          <Text style={{ color: get('semantic.danger') as string, fontWeight: '600' }}>Delete goal</Text>
        </Pressable>
      </View>
    </ScreenScroll>
  );
};

export default GoalDetail;
