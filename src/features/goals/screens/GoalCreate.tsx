import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../../../components/ScreenScroll';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import { useGoalsStore, type GoalType } from '../store';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from '../../../components/Icon';
import Button from '../../../components/Button';
import { Card } from '../../../components/Card';
import { useAccountsStore } from '../../../store/accounts';
import { formatCurrency } from '../../../lib/format';

type Template = {
  icon: string;
  title: string;
  category: string;
  suggestedAmount: number;
  suggestedMonths: number;
};

const MILESTONE_TEMPLATES: Template[] = [
  { icon: '🏡', title: 'House Down Payment', category: 'house', suggestedAmount: 50000, suggestedMonths: 36 },
  { icon: '✈️', title: 'Dream Vacation', category: 'trip', suggestedAmount: 5000, suggestedMonths: 12 },
  { icon: '🚗', title: 'New Car', category: 'car', suggestedAmount: 30000, suggestedMonths: 24 },
  { icon: '💍', title: 'Wedding', category: 'wedding', suggestedAmount: 25000, suggestedMonths: 18 },
  { icon: '🎓', title: 'Education Fund', category: 'education', suggestedAmount: 15000, suggestedMonths: 24 },
  { icon: '🏥', title: 'Emergency Fund', category: 'emergency', suggestedAmount: 10000, suggestedMonths: 12 },
  { icon: '💻', title: 'New Computer', category: 'computer', suggestedAmount: 2000, suggestedMonths: 6 },
  { icon: '🎯', title: 'Custom Goal', category: 'other', suggestedAmount: 1000, suggestedMonths: 12 },
];

const POPULAR_EMOJIS = ['🏡', '✈️', '🚗', '💍', '🎓', '🏥', '💻', '📱', '⌚', '🎮', '🎸', '🏋️', '🎨', '📷', '🚲', '⛵', '🏖️', '🎯', '💰', '💎'];

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTemplate(template);
    setTitle(template.title);
    setIcon(template.icon);
    setAmount(template.suggestedAmount.toString());
    setMonths(template.suggestedMonths.toString());
    setCategory(template.category);
  };

  const onCreate = async () => {
    if (!title.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Missing Title', 'Please enter a title for your goal');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Invalid Amount', 'Please enter a valid target amount');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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
  const accentSecondary = get('accent.secondary') as string;
  const successColor = get('semantic.success') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const border = get('border.default') as string;
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
      {/* Enhanced Header */}
      <View style={{ gap: spacing.s12 }}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            nav.goBack();
          }}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            opacity: pressed ? 0.7 : 1,
          })}
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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginTop: spacing.s4 }}>
          <View style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: withAlpha(accentPrimary, 0.3),
          }}>
            <Icon name="target" size={28} color={accentPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
              New {goalType === 'milestone' ? 'Milestone' : 'Net Worth'} Goal
            </Text>
          </View>
        </View>

        <Text style={{ color: textMuted, fontSize: 15, lineHeight: 22 }}>
          {goalType === 'milestone'
            ? 'Save for something special - a trip, wedding, or big purchase'
            : 'Set a net worth target and track your wealth over time'
          }
        </Text>
      </View>

      {/* Enhanced Current Net Worth */}
      {goalType === 'networth' && (
        <Card style={{
          padding: spacing.s16,
          backgroundColor: withAlpha(successColor, isDark ? 0.12 : 0.08),
          borderWidth: 1,
          borderColor: withAlpha(successColor, 0.25),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s8 }}>
            <Icon name="trending-up" size={18} color={successColor} />
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Current Net Worth
            </Text>
          </View>
          <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>
            {formatCurrency(currentNetWorth)}
          </Text>
          <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s4 }}>
            Your goal will start from this amount
          </Text>
        </Card>
      )}

      {/* Enhanced Templates */}
      <View style={{ gap: spacing.s12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
          <Icon name="zap" size={18} color={accentPrimary} />
          <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800' }}>
            Quick Templates
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.s10, paddingRight: spacing.s16 }}
        >
          {templates.map((template) => {
            const isSelected = selectedTemplate?.category === template.category;
            return (
              <Pressable
                key={template.category}
                onPress={() => onSelectTemplate(template)}
                style={({ pressed }) => ({
                  width: 130,
                  opacity: pressed ? 0.8 : 1
                })}
              >
                <LinearGradient
                  colors={isSelected
                    ? [accentPrimary, withAlpha(accentPrimary, 0.8)]
                    : [surface1, surface1]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    padding: spacing.s14,
                    borderRadius: radius.lg,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? accentPrimary : borderSubtle,
                    gap: spacing.s10,
                    alignItems: 'center',
                    shadowColor: isSelected ? accentPrimary : '#000',
                    shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
                    shadowOpacity: isSelected ? 0.3 : 0.1,
                    shadowRadius: isSelected ? 8 : 4,
                    elevation: isSelected ? 8 : 2,
                  }}
                >
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    backgroundColor: withAlpha(isSelected ? textOnPrimary : accentPrimary, isSelected ? 0.2 : 0.15),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 28 }}>{template.icon}</Text>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: isSelected ? textOnPrimary : textPrimary,
                      fontWeight: '800',
                      fontSize: 13,
                      textAlign: 'center',
                      lineHeight: 16,
                    }}
                  >
                    {template.title}
                  </Text>
                  <Text
                    style={{
                      color: withAlpha(isSelected ? textOnPrimary : textMuted, isSelected ? 0.9 : 1),
                      fontWeight: '600',
                      fontSize: 11,
                      textAlign: 'center',
                    }}
                  >
                    {formatCurrency(template.suggestedAmount)}
                  </Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Enhanced Form Fields */}
      <Card style={{ backgroundColor: surface1, padding: spacing.s16, gap: spacing.s16, borderWidth: 1, borderColor: border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
          <Icon name="edit-3" size={18} color={accentPrimary} />
          <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800' }}>Goal Details</Text>
        </View>

        <Field label="Goal Name" description="What are you saving for?">
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s10,
            backgroundColor: surface2,
            borderWidth: 1,
            borderColor: borderSubtle,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.s12,
          }}>
            <Icon name="type" size={18} color={textMuted} />
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Dream Vacation to Japan"
              placeholderTextColor={textMuted}
              style={{
                flex: 1,
                color: textPrimary,
                paddingVertical: spacing.s14,
                fontSize: 16,
                fontWeight: '600',
              }}
            />
          </View>
        </Field>

        <Field label="Icon" description="Choose an emoji for your goal">
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s10,
            backgroundColor: surface2,
            borderWidth: 1,
            borderColor: borderSubtle,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.s12,
          }}>
            <Icon name="smile" size={18} color={textMuted} />
            <TextInput
              value={icon}
              onChangeText={setIcon}
              placeholder="e.g., ✈️"
              placeholderTextColor={textMuted}
              style={{
                flex: 1,
                color: textPrimary,
                paddingVertical: spacing.s14,
                fontSize: 16,
                fontWeight: '600',
              }}
              maxLength={4}
            />
          </View>
          {/* Emoji suggestions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.s6 }}
          >
            {POPULAR_EMOJIS.map((emoji, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIcon(emoji);
                }}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: icon === emoji ? withAlpha(accentPrimary, isDark ? 0.25 : 0.15) : withAlpha(surface2, 0.5),
                  borderWidth: 1,
                  borderColor: icon === emoji ? accentPrimary : borderSubtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Field>

        <Field label="Target Amount" description="How much do you need to save?">
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s10,
            backgroundColor: surface2,
            borderWidth: 1,
            borderColor: borderSubtle,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.s12,
          }}>
            <Icon name="dollar-sign" size={18} color={textMuted} />
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="10000"
              placeholderTextColor={textMuted}
              style={{
                flex: 1,
                color: textPrimary,
                paddingVertical: spacing.s14,
                fontSize: 16,
                fontWeight: '600',
              }}
            />
          </View>
          {/* Quick amount presets */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s6 }}>
            {QUICK_AMOUNTS.map((quickAmount) => (
              <Pressable
                key={quickAmount}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAmount(quickAmount.toString());
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s8,
                  borderRadius: radius.pill,
                  backgroundColor: amount === quickAmount.toString()
                    ? withAlpha(accentSecondary, isDark ? 0.25 : 0.15)
                    : withAlpha(surface2, 0.5),
                  borderWidth: 1,
                  borderColor: amount === quickAmount.toString() ? accentSecondary : borderSubtle,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{
                  color: amount === quickAmount.toString() ? accentSecondary : textPrimary,
                  fontWeight: '700',
                  fontSize: 13,
                }}>
                  {formatCurrency(quickAmount)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Timeline" description="How many months to reach your goal?">
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s10,
            backgroundColor: surface2,
            borderWidth: 1,
            borderColor: borderSubtle,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.s12,
          }}>
            <Icon name="calendar" size={18} color={textMuted} />
            <TextInput
              value={months}
              onChangeText={setMonths}
              keyboardType="numeric"
              placeholder="12"
              placeholderTextColor={textMuted}
              style={{
                flex: 1,
                color: textPrimary,
                paddingVertical: spacing.s14,
                fontSize: 16,
                fontWeight: '600',
              }}
            />
            <Text style={{ color: textMuted, fontWeight: '600', fontSize: 14 }}>months</Text>
          </View>
        </Field>
      </Card>

      {/* Enhanced Smart Insights */}
      {amount && months && Number(amount) > 0 && Number(months) > 0 && (
        <Card style={{
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: withAlpha(accentPrimary, 0.3),
        }}>
          <LinearGradient
            colors={[
              withAlpha(accentPrimary, isDark ? 0.15 : 0.1),
              withAlpha(accentSecondary, isDark ? 0.15 : 0.1),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: radius.lg,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
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
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18 }}>
              Smart Insights
            </Text>
          </View>

          <View style={{
            backgroundColor: withAlpha(surface2, isDark ? 0.5 : 0.8),
            borderRadius: radius.md,
            padding: spacing.s12,
            gap: spacing.s8,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <Icon name="calendar" size={16} color={accentPrimary} />
              <Text style={{ color: textMuted, fontSize: 14, flex: 1 }}>
                Target date
              </Text>
              <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 14 }}>
                {new Date(targetDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: borderSubtle }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <Icon name="trending-up" size={16} color={successColor} />
              <Text style={{ color: textMuted, fontSize: 14, flex: 1 }}>
                Monthly savings needed
              </Text>
              <Text style={{ color: successColor, fontWeight: '800', fontSize: 16 }}>
                {formatCurrency(monthlySavings)}
              </Text>
            </View>

            {goalType === 'networth' && currentNetWorth > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: borderSubtle }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                  <Icon name="arrow-up-circle" size={16} color={accentSecondary} />
                  <Text style={{ color: textMuted, fontSize: 14, flex: 1 }}>
                    Growth needed
                  </Text>
                  <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 14 }}>
                    {formatCurrency(Number(amount) - currentNetWorth)} ({Math.round(((Number(amount) - currentNetWorth) / currentNetWorth) * 100)}%)
                  </Text>
                </View>
              </>
            )}
          </View>
        </Card>
      )}

      {/* Enhanced Create Button */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onCreate();
        }}
        style={({ pressed }) => ({
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <LinearGradient
          colors={[accentPrimary, withAlpha(accentPrimary, 0.8)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: radius.lg,
            paddingVertical: spacing.s16,
            paddingHorizontal: spacing.s20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.s10,
            shadowColor: accentPrimary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Icon name="check-circle" size={22} color="white" />
          <Text style={{
            color: 'white',
            fontSize: 18,
            fontWeight: '800',
            letterSpacing: 0.5,
          }}>
            Create Goal
          </Text>
        </LinearGradient>
      </Pressable>
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
