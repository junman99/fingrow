import React, { useEffect } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import Button from '../../components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius, elevation } from '../../theme/tokens';
import { useGoalsStore } from '../../store/goals';
import { useNavigation } from '@react-navigation/native';

const GoalCard: React.FC<{ goal: any; onPress: () => void }> = ({ goal, onPress }) => {
  const { get } = useThemeTokens();
  const pct = Math.min(100, Math.round(((goal.currentAmount || 0) / Math.max(1, goal.targetAmount || 1)) * 100));
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, ...elevation.level1 as any }}>
      <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{goal.icon ? goal.icon + ' ' : ''}{goal.title}</Text>
      <Text style={{ color: get('text.muted') as string, marginTop: spacing.s4 }}>${(goal.currentAmount||0).toFixed(0)} / ${(goal.targetAmount||0).toFixed(0)} · {pct}%</Text>
      <View style={{ height: 8, backgroundColor: get('surface.level2') as string, borderRadius: 4, marginTop: spacing.s12, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 8, backgroundColor: get('accent.primary') as string }} />
      </View>
    </Pressable>
  );
};

const GoalsRoot: React.FC = () => {
  const insets = useSafeAreaInsets();

  const nav = useNavigation<any>();
  const { get } = useThemeTokens();
  const { goals, hydrate } = useGoalsStore();

  useEffect(() => { hydrate(); }, []);

  return (
    <Screen>
      <AppHeader title="Goals" right={<Button title="+ New" onPress={() => nav.navigate('GoalCreate')} />} />
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 20 }}>Your goals</Text>
        <Pressable onPress={() => nav.navigate('GoalCreate')} style={{ alignSelf: 'flex-start', backgroundColor: get('accent.primary') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.md }}>
          <Text style={{ color: get('text.onPrimary') as string, fontWeight: '600' }}>+ Create goal</Text>
        </Pressable>

        {(goals || []).length === 0 ? (
          <View style={{ padding: spacing.s16, backgroundColor: get('surface.level2') as string, borderRadius: radius.lg }}>
            <Text style={{ color: get('text.muted') as string }}>No goals yet — create your first one!</Text>
          </View>
        ) : (
          <FlatList contentContainerStyle={{ padding: spacing.s16, paddingBottom: Math.max(insets.bottom, 16) }} bounces overScrollMode="always" data={goals}
            keyExtractor={(g:any) => g.id}
            ItemSeparatorComponent={() => <View style={{ height: spacing.s12 }} />}
            renderItem={({ item }) => (
              <GoalCard goal={item} onPress={() => nav.navigate('GoalDetail', { goalId: item.id })} />
            )}
          />
        )}
      </View>
    </Screen>
  );
};

export default GoalsRoot;