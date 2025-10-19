import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import { useAchievementsStore, ACHIEVEMENTS, type Achievement } from '../store/achievements';
import { useNavigation } from '@react-navigation/native';

// Animated pressable for badges
const AnimatedPressable: React.FC<{
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
}> = ({ onPress, children, style, disabled }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Badge colors based on category
const getBadgeColor = (category: Achievement['category'], get: any) => {
  switch (category) {
    case 'spending':
      return {
        primary: get('semantic.warning') as string,
        light: withAlpha(get('semantic.warning') as string, 0.12),
      };
    case 'saving':
      return {
        primary: get('semantic.success') as string,
        light: withAlpha(get('semantic.success') as string, 0.12),
      };
    case 'investing':
      return {
        primary: get('accent.primary') as string,
        light: withAlpha(get('accent.primary') as string, 0.12),
      };
    case 'learning':
      return {
        primary: '#8B5CF6', // Purple
        light: 'rgba(139, 92, 246, 0.12)',
      };
    case 'streaks':
      return {
        primary: '#F59E0B', // Amber
        light: 'rgba(245, 158, 11, 0.12)',
      };
  }
};

function withAlpha(hex: string, alpha: number) {
  if (!hex) return hex;
  if (hex.startsWith('rgba')) return hex;
  const raw = hex.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Badge component
const BadgeCard: React.FC<{
  achievement: Achievement & { unlocked: boolean; progress?: number };
}> = ({ achievement }) => {
  const { get } = useThemeTokens();
  const colors = getBadgeColor(achievement.category, get);
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;

  const progressPercent = achievement.target && achievement.progress
    ? Math.min((achievement.progress / achievement.target) * 100, 100)
    : 0;

  return (
    <View
      style={{
        width: '48%',
      }}
    >
      <AnimatedPressable>
        <View
          style={{
            backgroundColor: achievement.unlocked ? colors.light : surface1,
            borderRadius: radius.xl,
            paddingVertical: spacing.s24,
            paddingHorizontal: spacing.s16,
            borderWidth: achievement.unlocked ? 2 : 1,
            borderColor: achievement.unlocked ? colors.primary : borderSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.s12,
            opacity: achievement.unlocked ? 1 : 0.5,
            minHeight: 210,
          }}
        >
        {/* Badge Icon */}
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: achievement.unlocked ? colors.primary : surface1,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: achievement.unlocked ? 0 : 2,
            borderColor: borderSubtle,
          }}
        >
          <Icon
            name={achievement.icon as any}
            size={36}
            color={achievement.unlocked ? '#FFFFFF' : textMuted}
          />
        </View>

        {/* Badge Title */}
        <Text
          style={{
            color: achievement.unlocked ? textPrimary : textMuted,
            fontWeight: '700',
            fontSize: 15,
            textAlign: 'center',
          }}
        >
          {achievement.title}
        </Text>

        {/* Badge Description */}
        <Text
          style={{
            color: textMuted,
            fontSize: 12,
            textAlign: 'center',
            lineHeight: 16,
          }}
        >
          {achievement.description}
        </Text>

        {/* Progress Bar */}
        {achievement.target && !achievement.unlocked && (
          <View style={{ width: '100%', gap: spacing.s4, marginTop: spacing.s4 }}>
            <View
              style={{
                height: 6,
                backgroundColor: withAlpha(borderSubtle, 0.3),
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  backgroundColor: colors.primary,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={{ color: textMuted, fontSize: 10, textAlign: 'center' }}>
              {achievement.progress || 0} / {achievement.target}
            </Text>
          </View>
        )}

        {/* Unlocked Date */}
        {achievement.unlocked && achievement.unlockedAt && (
          <View
            style={{
              paddingHorizontal: spacing.s8,
              paddingVertical: spacing.s4,
              borderRadius: radius.pill,
              backgroundColor: withAlpha(colors.primary, 0.15),
              marginTop: spacing.s4,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '600' }}>
              Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
            </Text>
          </View>
        )}
        </View>
      </AnimatedPressable>
    </View>
  );
};

export const Achievements: React.FC = () => {
  const { get } = useThemeTokens();
  const nav = useNavigation();
  const { unlockedAchievements, progress, hydrate } = useAchievementsStore();

  useEffect(() => {
    hydrate();
  }, []);

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface2 = get('surface.level2') as string;
  const accentPrimary = get('accent.primary') as string;

  // Get achievements with unlock status
  const achievementsWithStatus = ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    unlocked: !!unlockedAchievements[achievement.id],
    unlockedAt: unlockedAchievements[achievement.id],
    progress: progress[achievement.id],
  }));

  // Group by category
  const categories = [
    { key: 'streaks', label: 'Streaks & Consistency', icon: 'zap' as const },
    { key: 'spending', label: 'Spending Mastery', icon: 'trending-down' as const },
    { key: 'saving', label: 'Saving Goals', icon: 'heart' as const },
    { key: 'investing', label: 'Investing Journey', icon: 'bar-chart-2' as const },
    { key: 'learning', label: 'Learning & Growth', icon: 'compass' as const },
  ] as const;

  // Calculate stats
  const totalAchievements = ACHIEVEMENTS.length;
  const unlockedCount = Object.keys(unlockedAchievements).length;
  const completionPercent = Math.round((unlockedCount / totalAchievements) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: get('background.default') as string }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.s16,
          paddingTop: spacing.s16,
          paddingBottom: spacing.s32,
        }}
      >
        {/* Header */}
        <View style={{ marginBottom: spacing.s24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: textPrimary, letterSpacing: -0.5 }}>
              Achievements
            </Text>
            <Pressable onPress={() => nav.goBack()} hitSlop={10}>
              <Icon name="x" size={24} color={textPrimary} />
            </Pressable>
          </View>

          {/* Progress Overview */}
          <View
            style={{
              backgroundColor: surface2,
              borderRadius: radius.lg,
              padding: spacing.s16,
              gap: spacing.s12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s4 }}>
                  YOUR PROGRESS
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s4 }}>
                  <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800' }}>
                    {unlockedCount}
                  </Text>
                  <Text style={{ color: textMuted, fontSize: 16, fontWeight: '600' }}>
                    / {totalAchievements}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: withAlpha(accentPrimary, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: accentPrimary, fontSize: 20, fontWeight: '800' }}>
                  {completionPercent}%
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View
              style={{
                height: 8,
                backgroundColor: withAlpha(textMuted, 0.15),
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${completionPercent}%`,
                  backgroundColor: accentPrimary,
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        </View>

        {/* Categories */}
        {categories.map(category => {
          const categoryAchievements = achievementsWithStatus.filter(a => a.category === category.key);
          if (categoryAchievements.length === 0) return null;

          const categoryUnlocked = categoryAchievements.filter(a => a.unlocked).length;

          return (
            <View key={category.key} style={{ marginBottom: spacing.s24 }}>
              {/* Category Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.s8,
                  marginBottom: spacing.s12,
                }}
              >
                <Icon name={category.icon as any} size={20} color={accentPrimary} />
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, flex: 1 }}>
                  {category.label}
                </Text>
                <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600' }}>
                  {categoryUnlocked}/{categoryAchievements.length}
                </Text>
              </View>

              {/* Badges Grid */}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.s10,
                  justifyContent: 'space-between',
                }}
              >
                {categoryAchievements.map(achievement => (
                  <BadgeCard key={achievement.id} achievement={achievement} />
                ))}
              </View>
            </View>
          );
        })}

        {/* Footer Message */}
        <View
          style={{
            alignItems: 'center',
            paddingVertical: spacing.s24,
          }}
        >
          <Icon name="trophy" size={32} color={textMuted} />
          <Text
            style={{
              color: textMuted,
              fontSize: 13,
              textAlign: 'center',
              marginTop: spacing.s8,
              fontStyle: 'italic',
            }}
          >
            Keep going! Each achievement brings you closer to financial mastery
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default Achievements;
