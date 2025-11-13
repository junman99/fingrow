import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from './Icon';
import { useTabBarScroll } from '../contexts/TabBarScrollContext';

interface FloatingTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(0,0,0,${alpha})`;
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

const FloatingTabBar: React.FC<FloatingTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { get, isDark } = useThemeTokens();
  const { scrollY, lastScrollY, contentHeight, layoutHeight } = useTabBarScroll();

  const bgDefault = get('background.default') as string;
  const accentPrimary = get('accent.primary') as string;
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;

  const tabCount = state.routes.length;
  const tabWidth = 64; // Width of each tab
  const pillHeight = 68;
  const horizontalPadding = 16;
  const tabSpacing = 8;
  const pillPadding = 6; // Same padding on all sides for active pill
  const activePillWidth = tabWidth + (tabSpacing * 2); // Match the spacing like top/bottom
  const activePillHeight = pillHeight - (pillPadding * 2); // Same padding as left/right
  const totalWidth = (tabWidth * tabCount) + (tabSpacing * (tabCount - 1)) + (horizontalPadding * 2);

  // Animated value for the active pill position
  const activeTabX = useSharedValue(0);

  // Auto-hide logic: detect scroll direction
  const isHidden = useSharedValue(false);

  useDerivedValue(() => {
    const currentY = scrollY.value;
    const lastY = lastScrollY.current;
    const delta = currentY - lastY;

    // Update last scroll position
    lastScrollY.current = currentY;

    // Check if we're at or near the bottom (within 100px for more aggressive hiding)
    const maxScroll = contentHeight.value - layoutHeight.value;
    const isAtBottom = maxScroll > 0 && currentY >= maxScroll - 100;

    // Show when near top (within 100px)
    if (currentY < 100) {
      isHidden.value = false;
      return;
    }

    // If at bottom, always keep hidden (even when scrolling up slightly due to bounce)
    if (isAtBottom) {
      isHidden.value = true;
      return;
    }

    // Hide when scrolling down (delta > 0.75 to avoid tiny movements) - 50% more sensitive
    if (delta > 0.75) {
      isHidden.value = true;
      return;
    }

    // Show when scrolling up (delta < -0.75) - 50% more sensitive
    if (delta < -0.75) {
      isHidden.value = false;
      return;
    }
  });

  useEffect(() => {
    const targetX = horizontalPadding + (state.index * (tabWidth + tabSpacing)) - tabSpacing;
    activeTabX.value = withSpring(targetX, {
      damping: 20,
      stiffness: 180,
      mass: 0.8,
    });
  }, [state.index]);

  const activePillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activeTabX.value }],
  }));

  // Animated style for hide/show
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const hideOffset = pillHeight + Math.max(insets.bottom, 20) + 20; // Fully slide down
    return {
      transform: [{
        translateY: withTiming(isHidden.value ? hideOffset : 0, {
          duration: isHidden.value ? 200 : 250, // Faster hide, slightly slower show
        }),
      }],
      opacity: withTiming(isHidden.value ? 0 : 1, {
        duration: isHidden.value ? 150 : 200, // Faster fade out
      }),
    };
  });

  const getIconName = (routeName: string) => {
    switch (routeName) {
      case 'Home': return 'receipt';
      case 'Money': return 'wallet';
      case 'Goals': return 'target';
      case 'Invest': return 'trending-up';
      case 'Settings': return 'settings';
      default: return 'circle';
    }
  };

  const getLabel = (routeName: string) => {
    switch (routeName) {
      case 'Home': return 'Spending';
      case 'Money': return 'Money';
      case 'Goals': return 'Goals';
      case 'Invest': return 'Invest';
      case 'Settings': return 'Settings';
      default: return routeName;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 20),
        },
        containerAnimatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.tabBarContainer,
          {
            width: totalWidth,
            height: pillHeight,
            borderRadius: pillHeight / 2,
            overflow: 'hidden',
            backgroundColor: withAlpha(bgDefault, 0.2),
          },
        ]}
      >
        {/* Blur effect for frosted glass */}
        <BlurView
          intensity={10}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />

        {/* Shadow overlay */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: pillHeight / 2,
              borderWidth: 0.5,
              borderColor: withAlpha(isDark ? '#ffffff' : '#000000', 0.1),
            },
          ]}
        />

        {/* Active pill indicator */}
        <Animated.View
          style={[
            styles.activePill,
            {
              width: activePillWidth,
              height: activePillHeight,
              borderRadius: activePillHeight / 2,
              backgroundColor: withAlpha(accentPrimary, 0.7),
              top: pillPadding,
            },
            activePillStyle,
          ]}
        />

        {/* Tab buttons */}
        <View style={styles.tabsContainer}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel !== undefined ? options.tabBarLabel : getLabel(route.name);
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={({ pressed }) => [
                  styles.tab,
                  {
                    width: tabWidth,
                    opacity: pressed ? 0.4 : 1,
                  },
                ]}
              >
                <View style={styles.tabContent}>
                  <Icon
                    name={getIconName(route.name) as any}
                    size={22}
                    color={isFocused ? '#ffffff' : muted}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color: isFocused ? '#ffffff' : muted,
                        fontWeight: isFocused ? '700' : '600',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  tabBarContainer: {
    flexDirection: 'row',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  activePill: {
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});

export default FloatingTabBar;
