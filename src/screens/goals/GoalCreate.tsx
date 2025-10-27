import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { ScreenScroll } from '../../components/ScreenScroll';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useGoalsStore, type GoalType } from '../../store/goals';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from '../../components/Icon';
import Button from '../../components/Button';
import { useAccountsStore } from '../../store/accounts';
import { formatCurrency } from '../../lib/format';

type Template = {
  icon: string;
  title: string;
  category: string;
  suggestedAmount: number;
  suggestedMonths: number;
};

const MILESTONE_TEMPLATES: Template[] = [
  { icon: '💍', title: 'Wedding', category: 'wedding', suggestedAmount: 30000, suggestedMonths: 18 },
  { icon: '✈️', title: 'Dream Vacation', category: 'trip', suggestedAmount: 5000, suggestedMonths: 12 },
  { icon: '💻', title: 'New Computer', category: 'computer', suggestedAmount: 2000, suggestedMonths: 6 },
  { icon: '🏡', title: 'House Down Payment', category: 'house', suggestedAmount: 50000, suggestedMonths: 36 },
  { icon: '🚗', title: 'New Car', category: 'car', suggestedAmount: 25000, suggestedMonths: 24 },
  { icon: '🎓', title: 'Education Fund', category: 'education', suggestedAmount: 10000, suggestedMonths: 24 },
  { icon: '🎯', title: 'Custom Goal', category: 'other', suggestedAmount: 1000, suggestedMonths: 12 },
];

const NETWORTH_TEMPLATES: Template[] = [
  { icon: '🎯', title: '$100K Net Worth', category: 'milestone', suggestedAmount: 100000, suggestedMonths: 24 },
  { icon: '💰', title: '$500K Net Worth', category: 'milestone', suggestedAmount: 500000, suggestedMonths: 60 },
  { icon: '💎', title: '$1M Net Worth', category: 'milestone', suggestedAmount: 1000000, suggestedMonths: 120 },
  { icon: '🌟', title: 'Financial Freedom', category: 'milestone', suggestedAmount: 2000000, suggestedMonths: 180 },
  { icon: '🎯', title: 'Custom Target', category: 'other', suggestedAmount: 250000, suggestedMonths: 36 },
];

const Field: React.FC<{ label: string; children: React.ReactNode; description?: string }> = ({ label, children, description }) => {
  const { get } = useThemeTokens();
  return (
    <View style={{ gap: spacing.s8 }}>
      <View>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 15 }}>{label}</Text>
        {description && (
          <Text style={{ color: get('text.muted') as string, fontSize: 13, marginTop: spacing.s4 }}>
            {description}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
};

const GoalCreate: React.FC = () => {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { createGoal } = useGoalsStore();
  const { accounts } = useAccountsStore();

  const goalType: GoalType = route.params?.type || 'milestone';
  const templates = goalType === 'milestone' ? MILESTONE_TEMPLATES : NETWORTH_TEMPLATES;

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [amount, setAmount] = useState('');
  const [months, setMonths] = useState('12');
  const [category, setCategory] = useState('other');

  // Calculate net worth
  const currentNetWorth = useMemo(() => {
    return accounts
      .filter(a => a.includeInNetWorth !== false)
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  // Calculate target date from months
  const targetDate = useMemo(() => {
    const monthsNum = Number(months) || 12;
    const date = new Date();
    date.setMonth(date.getMonth() + monthsNum);
    return date.toISOString().split('T')[0];
  }, [months]);

  // Calculate monthly savings needed
  const monthlySavings = useMemo(() => {
    const targetAmount = Number(amount) || 0;
    const monthsNum = Number(months) || 1;
    return targetAmount / monthsNum;
  }, [amount, months]);

  const onSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setTitle(template.title);
    setIcon(template.icon);
    setAmount(template.suggestedAmount.toString());
    setMonths(template.suggestedMonths.toString());
    setCategory(template.category);
  };

  const onCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your goal');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid target amount');
      return;
    }

    const id = await createGoal({
      type: goalType,
      title: title.trim(),
      targetAmount: Number(amount),
      targetDate,
      icon: icon || undefined,
      category
    });

    nav.goBack();
    // Navigate to the detail screen
    setTimeout(() => {
      nav.navigate('GoalDetail', { goalId: id, mode: 'journey' });
    }, 100);
  };

  const accentPrimary = get('accent.primary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;

  const inputStyle = {
    backgroundColor: surface1,
    color: textPrimary,
    borderWidth: 1,
    borderColor: borderSubtle,
    paddingHorizontal: spacing.s12,
    paddingVertical: spacing.s14,
    borderRadius: radius.md,
    fontSize: 16,
    fontWeight: '600' as const
  };

  return (
    <ScreenScroll contentStyle={{ padding: spacing.s16, gap: spacing.s20, paddingBottom: spacing.s32 }}>
      {/* Header */}
      <View style={{ gap: spacing.s8 }}>
        <Pressable
          onPress={() => nav.goBack()}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}
        >
          <Icon name="chevron-left" size={20} colorToken="text.muted" />
          <Text style={{ color: textMuted, fontSize: 15 }}>Back</Text>
        </Pressable>

        <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>
          Create {goalType === 'milestone' ? 'Milestone' : 'Net Worth'} Goal
        </Text>
        <Text style={{ color: textMuted, fontSize: 15 }}>
          {goalType === 'milestone'
            ? 'Save for something special - a trip, wedding, or big purchase'
            : 'Set a net worth target and track your wealth over time'
          }
        </Text>
      </View>

      {/* Current Net Worth (for networth goals) */}
      {goalType === 'networth' && (
        <View style={{
          borderRadius: radius.lg,
          padding: spacing.s16,
          backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08),
          borderWidth: 1,
          borderColor: borderSubtle,
          gap: spacing.s6
        }}>
          <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            Current Net Worth
          </Text>
          <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
            {formatCurrency(currentNetWorth)}
          </Text>
        </View>
      )}

      {/* Templates */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>
          Quick Templates
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.s12, paddingRight: spacing.s16 }}
        >
          {templates.map((template) => (
            <Pressable
              key={template.category}
              onPress={() => onSelectTemplate(template)}
              style={({ pressed }) => ({
                width: 120,
                padding: spacing.s12,
                borderRadius: radius.lg,
                backgroundColor: selectedTemplate?.category === template.category ? accentPrimary : surface1,
                borderWidth: 1,
                borderColor: selectedTemplate?.category === template.category ? accentPrimary : borderSubtle,
                gap: spacing.s8,
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1
              })}
            >
              <Text style={{ fontSize: 32 }}>{template.icon}</Text>
              <Text
                numberOfLines={2}
                style={{
                  color: selectedTemplate?.category === template.category ? textOnPrimary : textPrimary,
                  fontWeight: '700',
                  fontSize: 13,
                  textAlign: 'center'
                }}
              >
                {template.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Form Fields */}
      <View style={{ gap: spacing.s16 }}>
        <Field label="Goal Name" description="What are you saving for?">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Dream Vacation to Japan"
            placeholderTextColor={textMuted}
            style={inputStyle as any}
          />
        </Field>

        <Field label="Icon (optional)" description="Add an emoji to make it personal">
          <TextInput
            value={icon}
            onChangeText={setIcon}
            placeholder="e.g., ✈️"
            placeholderTextColor={textMuted}
            style={inputStyle as any}
            maxLength={4}
          />
        </Field>

        <Field label="Target Amount" description="How much do you need to save?">
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="10000"
            placeholderTextColor={textMuted}
            style={inputStyle as any}
          />
        </Field>

        <Field label="Timeline (months)" description="How many months to reach your goal?">
          <TextInput
            value={months}
            onChangeText={setMonths}
            keyboardType="numeric"
            placeholder="12"
            placeholderTextColor={textMuted}
            style={inputStyle as any}
          />
        </Field>

        {/* Calculated Info */}
        {amount && months && Number(amount) > 0 && Number(months) > 0 && (
          <View style={{
            borderRadius: radius.lg,
            padding: spacing.s16,
            backgroundColor: surface2,
            gap: spacing.s8
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
              <Icon name="zap" size={16} colorToken="accent.primary" />
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>
                Smart Insights
              </Text>
            </View>
            <Text style={{ color: textMuted, fontSize: 14 }}>
              • Target date: {new Date(targetDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
            <Text style={{ color: textMuted, fontSize: 14 }}>
              • Monthly savings needed: <Text style={{ color: textPrimary, fontWeight: '700' }}>{formatCurrency(monthlySavings)}</Text>
            </Text>
            {goalType === 'networth' && currentNetWorth > 0 && (
              <Text style={{ color: textMuted, fontSize: 14 }}>
                • Growth needed: <Text style={{ color: textPrimary, fontWeight: '700' }}>
                  {formatCurrency(Number(amount) - currentNetWorth)}
                </Text> ({Math.round(((Number(amount) - currentNetWorth) / currentNetWorth) * 100)}%)
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Create Button */}
      <Button
        variant="primary"
        title="Create Goal"
        onPress={onCreate}
        icon="check"
      />
    </ScreenScroll>
  );
};

export default GoalCreate;

function withAlpha(hex: string, alpha: number) {
  if (!hex || typeof hex !== 'string') return hex;
  if (hex.startsWith('#')) {
    const clean = hex.slice(1, 7);
    const padded = clean.length === 6 ? clean : clean.padEnd(6, '0');
    const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
    return `#${padded}${a}`;
  }
  return hex;
}
