import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon, { IconName } from '../components/Icon';

type AccountKind = 'checking' | 'savings' | 'cash' | 'credit' | 'investment' | 'retirement' | 'loan' | 'mortgage' | 'other';

interface AccountTypeOption {
  key: AccountKind;
  title: string;
  caption: string;
  icon: IconName;
  color: string;
}

const accountTypes: AccountTypeOption[] = [
  {
    key: 'checking',
    title: 'Daily spend',
    caption: 'Salary, current, multi-use funds',
    icon: 'building-2',
    color: '#3B82F6',
  },
  {
    key: 'savings',
    title: 'Savings',
    caption: 'Emergency, reserves, fixed deposits',
    icon: 'piggy-bank',
    color: '#10B981',
  },
  {
    key: 'cash',
    title: 'Cash & wallets',
    caption: 'Physical cash, GrabPay, prepaid',
    icon: 'wallet',
    color: '#8B5CF6',
  },
  {
    key: 'retirement',
    title: 'Retirement',
    caption: 'CPF, 401k, pension plans',
    icon: 'award',
    color: '#F59E0B',
  },
  {
    key: 'investment',
    title: 'Investment cash',
    caption: 'Brokerage or robo cash buckets',
    icon: 'trending-up',
    color: '#06B6D4',
  },
  {
    key: 'credit',
    title: 'Credit & charge',
    caption: 'Cards that need monthly payoff',
    icon: 'credit-card',
    color: '#EF4444',
  },
  {
    key: 'loan',
    title: 'Loan',
    caption: 'Personal loans, student loans',
    icon: 'file-text',
    color: '#DC2626',
  },
  {
    key: 'mortgage',
    title: 'Mortgage',
    caption: 'Home loans, property financing',
    icon: 'home',
    color: '#B91C1C',
  },
  {
    key: 'other',
    title: 'Other',
    caption: 'Any other account type',
    icon: 'folder',
    color: '#6B7280',
  },
];

function withAlpha(color: string, alpha: number) {
  if (!color) return color;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
    const int = parseInt(expanded, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

const SelectAccountType: React.FC = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { get, isDark } = useThemeTokens();

  const currentType = route.params?.currentType || 'checking';

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;

  const handleSelect = (type: AccountKind) => {
    if (route.params?.onSelect) {
      route.params.onSelect(type);
    }
    nav.goBack();
  };

  return (
    <ScreenScroll
      contentStyle={{ padding: spacing.s16, gap: spacing.s16 }}
    >
      {/* Header */}
      <View style={{ gap: spacing.s8 }}>
        <Text style={{ color: text, fontSize: 24, fontWeight: '800' }}>
          Select account type
        </Text>
        <Text style={{ color: muted, fontSize: 14 }}>
          Choose the type that best describes this account
        </Text>
      </View>

      {/* Account Types List */}
      <View style={{ gap: spacing.s8 }}>
        {accountTypes.map((type) => {
          const isSelected = type.key === currentType;
          return (
            <Pressable
              key={type.key}
              onPress={() => handleSelect(type.key)}
              style={({ pressed }) => ({
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: isSelected ? accentPrimary : border,
                padding: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    backgroundColor: withAlpha(type.color, isDark ? 0.3 : 0.15),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={type.icon} size={24} color={type.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>
                    {type.title}
                  </Text>
                  <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                    {type.caption}
                  </Text>
                </View>
              </View>
              {isSelected && (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.pill,
                    backgroundColor: accentPrimary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: spacing.s8,
                  }}
                >
                  <Icon name="check" size={16} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScreenScroll>
  );
};

export default SelectAccountType;
