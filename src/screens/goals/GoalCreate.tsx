import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGoalsStore } from '../../store/goals';
import { useNavigation } from '@react-navigation/native';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { get } = useThemeTokens();
  return (
    <View style={{ gap: spacing.s8 }}>
      <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
};

const GoalCreate: React.FC = () => {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { createGoal } = useGoalsStore();
  const [title, setTitle] = useState('New Goal');
  const [amount, setAmount] = useState('1000');
  const [date, setDate] = useState('');

  const onCreate = async () => {
    const id = await createGoal({ title, targetAmount: Number(amount) || 0, targetDate: date });
    nav.replace('GoalDetail', { goalId: id });
  };

  const inputStyle = { backgroundColor: get('surface.level1') as string, color: get('text.primary') as string, borderWidth: 1, borderColor: get('border.subtle') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s12, borderRadius: radius.md };

  return (
    <ScreenScroll contentStyle={{ padding: spacing.s16, gap: spacing.s16 }}>
      <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 20 }}>Create goal</Text>
      <Field label="Title">
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g., Japan Trip" placeholderTextColor={get('text.muted') as string} style={inputStyle as any} />
      </Field>
      <Field label="Target amount">
        <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="1000" placeholderTextColor={get('text.muted') as string} style={inputStyle as any} />
      </Field>
      <Field label="Target date (YYYY-MM-DD)">
        <TextInput value={date} onChangeText={setDate} placeholder="2025-12-31" placeholderTextColor={get('text.muted') as string} style={inputStyle as any} />
      </Field>

      <Pressable accessibilityRole="button" onPress={onCreate} style={{ backgroundColor: get('accent.primary') as string, paddingVertical: spacing.s12, borderRadius: radius.lg, alignItems: 'center' }}>
        <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700' }}>Create</Text>
      </Pressable>
    </ScreenScroll>
  );
};

export default GoalCreate;