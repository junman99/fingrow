import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, Image, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius, elevation } from '../theme/tokens';
import { ScreenScroll } from '../components/ScreenScroll';
import { MonthCompareChart } from '../components/MonthCompareChart';
import { RecentTransactionsCard } from '../components/RecentTransactionsCard';
import Icon from '../components/Icon';
import { useTxStore } from '../store/transactions';
import { useProfileStore } from '../store/profile';
import { useGroupsStore } from '../store/groups';

const AnimatedText = Animated.createAnimatedComponent(Text);

type AddFabProps = {
  anim: Animated.Value;
  accent: string;
  textColor: string;
  onPress: () => void;
};

const AddFabButton: React.FC<AddFabProps> = ({ anim, accent, textColor, onPress }) => {
  const collapsedWidth = 52;
  const expandedWidth = 188;
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: [collapsedWidth, expandedWidth] });
  const textOpacity = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.35, 1] });
  const textTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [8, 2] });
  const iconSize = 22;
  const iconBaseOffset = (collapsedWidth - iconSize) / 2;
  const iconTargetOffset = spacing.s16 + spacing.s4;
  const iconTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, iconTargetOffset - iconBaseOffset]
  });
  const height = 48;

  return (
    <Animated.View style={{
      width,
      height,
      borderRadius: height / 2,
      backgroundColor: accent,
      overflow: 'hidden',
      alignSelf: 'flex-end',
      ...(elevation.level3 as any)
    }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.s8,
          paddingLeft: spacing.s16,
          paddingRight: spacing.s12,
          opacity: pressed ? 0.9 : 1
        })}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: iconBaseOffset,
            transform: [{ translateX: iconTranslate }]
          }}
        >
          <Icon name="plus-rounded" size={22} colorToken="text.onPrimary" />
        </Animated.View>
        <AnimatedText
          numberOfLines={1}
          style={{
            color: textColor,
            fontWeight: '700',
            textAlign: 'center',
            opacity: textOpacity,
            transform: [{ translateX: textTranslate }]
          }}
        >
          Add transaction
        </AnimatedText>
      </Pressable>
    </Animated.View>
  );
};

export const Home: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { get } = useThemeTokens();

  // stores
  const { hydrate: hydrateTx } = useTxStore();
  const { profile, hydrate: hydrateProfile } = useProfileStore();
  const { hydrate: hydrateGroups } = useGroupsStore();

  useEffect(() => { hydrateProfile(); hydrateTx(); hydrateGroups(); }, []);

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const textOnPrimary = get('text.onPrimary') as string;

  const collapseAnim = useRef(new Animated.Value(1)).current;
  const fabTargetRef = useRef(1);
  const collapseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateFab = useCallback((to: number) => {
    if (fabTargetRef.current === to) return;
    fabTargetRef.current = to;
    collapseAnim.stopAnimation();
    Animated.timing(collapseAnim, {
      toValue: to,
      duration: to === 0 ? 220 : 200,
      easing: to === 0 ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) collapseAnim.setValue(to);
    });
  }, [collapseAnim]);

  const onHomeScroll = useCallback((event: any) => {
    animateFab(0);
    if (collapseTimeout.current) clearTimeout(collapseTimeout.current);
    collapseTimeout.current = setTimeout(() => {
      animateFab(1);
    }, 160);
  }, [animateFab]);

  useEffect(() => {
    return () => {
      if (collapseTimeout.current) clearTimeout(collapseTimeout.current);
    };
  }, []);

  const handleAddPress = useCallback(() => nav.navigate('Add'), [nav]);

  const quickActions = [
    {
      key: 'groups',
      icon: 'users-2' as const,
      label: 'Shared bills',
      onPress: () => nav.navigate('Groups', { screen: 'GroupsRoot' }),
      accent: get('accent.secondary') as string
    },
    {
      key: 'goal',
      icon: 'target' as const,
      label: 'Savings goals',
      onPress: () => nav.navigate('Goals', { screen: 'GoalsRoot' }),
      accent: get('accent.primary') as string
    },
    {
      key: 'budget',
      icon: 'wallet' as const,
      label: 'Budgets',
      onPress: () => nav.navigate('BudgetModal'),
      accent: get('semantic.warning') as string
    },
    {
      key: 'history',
      icon: 'history' as const,
      label: 'History',
      onPress: () => nav.navigate('TransactionsModal'),
      accent: get('semantic.success') as string
    }
  ];

  const avatarInitials = (() => {
    const n = profile?.name?.trim();
    if (!n) return '👤';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '👤';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '👤';
    return (parts[0][0] + parts[1][0]).toUpperCase();
  })();

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll
        inTab
        onScroll={onHomeScroll}
        scrollEventThrottle={16}
        contentStyle={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, paddingBottom: spacing.s32 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: textPrimary }}>Spending</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => nav.navigate('ProfileModal')}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              overflow: 'hidden',
              backgroundColor: surface2,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1
            })}
          >
            {profile?.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={{ width: 44, height: 44 }} />
            ) : (
              <Text style={{ color: textPrimary, fontWeight: '700' }}>{avatarInitials}</Text>
            )}
          </Pressable>
        </View>

        <View style={{ marginTop: spacing.s8 }}>
          <MonthCompareChart />
        </View>

        <View style={{ marginTop: spacing.s16 }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, marginBottom: spacing.s8 }}>Shortcuts</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            {quickActions.map(action => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                onPress={action.onPress}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.82 : 1
                })}
              >
                <View style={{
                  width: '100%',
                  paddingVertical: spacing.s10,
                  borderRadius: radius.lg,
                  backgroundColor: action.accent,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name={action.icon} size={26} colorToken="text.onPrimary" />
                  <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', marginTop: spacing.s4, fontSize: 12 }}>
                    {action.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.s16 }}>
          <RecentTransactionsCard />
        </View>
      </ScreenScroll>

      {/* Floating Add button at bottom-left when scrolled */}
      <View
        style={{
          position: 'absolute',
          right: spacing.s16,
          bottom: Math.max(insets.bottom, spacing.s16)
        }}
      >
        <AddFabButton
          anim={collapseAnim}
          accent={accentSecondary}
          textColor={textOnPrimary}
          onPress={handleAddPress}
        />
      </View>
    </View>
  );
};

export default Home;
