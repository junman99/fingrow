import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Image, Animated, Easing, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
  const collapsedWidth = 56;
  const expandedWidth = 196;
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: [collapsedWidth, expandedWidth] });
  const textOpacity = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0, 1] });
  const textWidth = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 120] });
  const paddingHorizontal = anim.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.s16] });
  const gap = anim.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.s8] });
  const iconSize = 24;
  const height = 56;

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
          flex: 1,
          opacity: pressed ? 0.9 : 1
        })}
      >
        <Animated.View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal,
          gap,
        }}>
          <Icon name="plus-rounded" size={24} colorToken="text.onPrimary" />
          <Animated.View style={{ width: textWidth, overflow: 'hidden' }}>
            <AnimatedText
              numberOfLines={1}
              style={{
                color: textColor,
                fontWeight: '700',
                fontSize: 15,
                opacity: textOpacity,
              }}
            >
              Add transaction
            </AnimatedText>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

// Animated pressable for cards
const AnimatedPressable: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}> = ({ onPress, children, style }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export const Home: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { get } = useThemeTokens();
  const tabBarHeight = useBottomTabBarHeight();
  const fabBottomOffset = useMemo(() => {
    const baseGap = spacing.s16;
    if (tabBarHeight > 0) return baseGap;
    return insets.bottom + baseGap;
  }, [insets.bottom, tabBarHeight]);

  // stores
  const { hydrate: hydrateTx } = useTxStore();
  const { profile, hydrate: hydrateProfile } = useProfileStore();
  const { hydrate: hydrateGroups } = useGroupsStore();

  useEffect(() => {
    hydrateProfile();
    hydrateTx();
    hydrateGroups();
  }, []);

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;
  const textOnPrimary = get('text.onPrimary') as string;

  const collapseAnim = useRef(new Animated.Value(1)).current;
  const fabTargetRef = useRef(1);
  const collapseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionHandleRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const navDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

  const clearPendingNavigation = useCallback(() => {
    if (interactionHandleRef.current) {
      interactionHandleRef.current.cancel();
      interactionHandleRef.current = null;
    }
    if (navDelayRef.current) {
      clearTimeout(navDelayRef.current);
      navDelayRef.current = null;
    }
  }, []);

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
  useEffect(() => {
    return () => {
      clearPendingNavigation();
    };
  }, [clearPendingNavigation]);

  const navigateWhenIdle = useCallback((fn: () => void) => {
    clearPendingNavigation();
    const attempt = () => {
      interactionHandleRef.current = null;
      if (isFocusedRef.current) {
        fn();
        return;
      }
      navDelayRef.current = setTimeout(() => {
        navDelayRef.current = null;
        interactionHandleRef.current = InteractionManager.runAfterInteractions(attempt);
      }, 80);
    };
    interactionHandleRef.current = InteractionManager.runAfterInteractions(attempt);
  }, [clearPendingNavigation]);

  const handleAddPress = useCallback(() => {
    navigateWhenIdle(() => nav.navigate('Add'));
  }, [nav, navigateWhenIdle]);

  const warningAccent = get('semantic.warning') as string;

  const quickActions = useMemo(() => ([
    {
      key: 'groups',
      icon: 'users-2' as const,
      label: 'Shared bills',
      onPress: () => navigateWhenIdle(() => nav.navigate('GroupsRoot')),
      accent: accentSecondary
    },
    {
      key: 'budget',
      icon: 'wallet' as const,
      label: 'Budgets',
      onPress: () => navigateWhenIdle(() => nav.navigate('BudgetsRoot')),
      accent: warningAccent
    },
    {
      key: 'insights',
      icon: 'bar-chart-3' as const,
      label: 'Insights',
      onPress: () => navigateWhenIdle(() => nav.navigate('InsightsRoot')),
      accent: accentPrimary
    },
    {
      key: 'history',
      icon: 'history' as const,
      label: 'History',
      onPress: () => navigateWhenIdle(() => nav.navigate('HistoryRoot')),
      accent: get('semantic.success') as string
    }
  ]), [accentSecondary, accentPrimary, warningAccent, nav, navigateWhenIdle, get]);

  const avatarInitials = (() => {
    const n = profile?.name?.trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
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
        {/* Header with profile */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s16 }}>
          <Text style={{ fontSize: 32, fontWeight: '800', color: textPrimary, letterSpacing: -0.5 }}>
            Spending
          </Text>
          <AnimatedPressable
            onPress={() => nav.navigate('ProfileModal')}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.xl,
                overflow: 'hidden',
                backgroundColor: accentPrimary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: borderSubtle,
              }}
            >
              {profile?.avatarUri ? (
                <Image source={{ uri: profile.avatarUri }} style={{ width: 48, height: 48 }} />
              ) : (
                <Text style={{ color: textOnPrimary, fontWeight: '800', fontSize: 18 }}>
                  {avatarInitials}
                </Text>
              )}
            </View>
          </AnimatedPressable>
        </View>

        {/* Month Compare Chart - No Card */}
        <View style={{ marginBottom: spacing.s16 }}>
          <MonthCompareChart />
        </View>

        {/* Quick Actions */}
        <View style={{ marginBottom: spacing.s16 }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16, marginBottom: spacing.s12, letterSpacing: -0.3 }}>
            Quick actions
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            {quickActions.map(action => (
              <View
                key={action.key}
                style={{ flex: 1 }}
              >
                <AnimatedPressable
                  onPress={action.onPress}
                  style={{ width: '100%' }}
                >
                  <View
                    style={{
                      padding: spacing.s12,
                      borderRadius: radius.lg,
                      backgroundColor: surface1,
                      alignItems: 'center',
                      gap: spacing.s8,
                      minHeight: 90,
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.md,
                        backgroundColor: action.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={action.icon} size={20} colorToken="text.onPrimary" />
                    </View>
                    <Text
                      style={{
                        color: textPrimary,
                        fontWeight: '600',
                        fontSize: 12,
                        textAlign: 'center',
                      }}
                    >
                      {action.label}
                    </Text>
                  </View>
                </AnimatedPressable>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Transactions */}
        <View>
          <RecentTransactionsCard />
        </View>
      </ScreenScroll>

      {/* Floating Add button */}
      <View
        style={{
          position: 'absolute',
          right: spacing.s16,
          bottom: fabBottomOffset,
        }}
      >
        <AddFabButton
          anim={collapseAnim}
          accent={accentPrimary}
          textColor={textOnPrimary}
          onPress={handleAddPress}
        />
      </View>
    </View>
  );
};

export default Home;
