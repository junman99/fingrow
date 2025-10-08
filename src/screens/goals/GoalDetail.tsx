import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGoalsStore } from '../../store/goals';
import { useNavigation, useRoute } from '@react-navigation/native';

const GoalDetail: React.FC = () => {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const goalId = route.params?.goalId as string;
  const { goals, contribute, removeGoal } = useGoalsStore();
  const goal = (goals || []).find(g => g.id === goalId);

  if (!goal) {
    return (
      <ScreenScroll contentStyle={{ padding: spacing.s16 }}>
        <Text style={{ color: get('text.muted') as string }}>Goal not found.</Text>
      </ScreenScroll>
    );
  }

  const pct = Math.min(100, Math.round(((goal.currentAmount || 0) / Math.max(1, goal.targetAmount || 1)) * 100));

  return (
    <ScreenScroll contentStyle={{ padding: spacing.s16, gap: spacing.s16 }}>
      <View style={{ gap: spacing.s4 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 20 }}>{goal.icon ? goal.icon + ' ' : ''}{goal.title}</Text>
        <Text style={{ color: get('text.muted') as string }}>${(goal.currentAmount||0).toFixed(0)} / ${(goal.targetAmount||0).toFixed(0)} · {pct}%</Text>
      </View>

      <View style={{ height: 10, backgroundColor: get('surface.level2') as string, borderRadius: 5, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 10, backgroundColor: get('accent.primary') as string }} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
        <Pressable accessibilityRole="button" onPress={() => contribute(goal.id, 10)} style={{ backgroundColor: get('surface.level1') as string, paddingVertical: spacing.s12, paddingHorizontal: spacing.s16, borderRadius: radius.lg }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>+ $10</Text>
        </Pressable>
        <Pressable onPress={() => contribute(goal.id, 50)} style={{ backgroundColor: get('surface.level1') as string, paddingVertical: spacing.s12, paddingHorizontal: spacing.s16, borderRadius: radius.lg }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>+ $50</Text>
        </Pressable>
        <Pressable onPress={() => contribute(goal.id, 100)} style={{ backgroundColor: get('surface.level1') as string, paddingVertical: spacing.s12, paddingHorizontal: spacing.s16, borderRadius: radius.lg }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>+ $100</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => nav.goBack()} style={{ backgroundColor: get('accent.primary') as string, paddingVertical: spacing.s12, borderRadius: radius.lg, alignItems: 'center' }}>
        <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700' }}>Done</Text>
      </Pressable>

      <Pressable onPress={() => { removeGoal(goal.id); nav.goBack(); }} style={{ paddingVertical: spacing.s12, alignItems: 'center' }}>
        <Text style={{ color: get('semantic.danger') as string, fontWeight: '600' }}>Delete goal</Text>
      </Pressable>
    </ScreenScroll>
  );
};

export default GoalDetail;