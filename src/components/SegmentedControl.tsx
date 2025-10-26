import React from 'react';
import { View, Text, Pressable, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

type Option<T> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

function withAlpha(color: string, alpha: number) {
  if (!color) return color;
  if (color.startsWith('rgba')) {
    const parts = color.slice(5, -1).split(',').map(part => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb')) {
    const parts = color.slice(4, -1).split(',').map(part => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const raw = color.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const { get, isDark } = useThemeTokens();
  const [optionLayouts, setOptionLayouts] = React.useState<Record<string, { x: number; width: number }>>({});

  const text = get('text.primary') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const muted = get('text.muted') as string;
  const accentPrimary = get('accent.primary') as string;
  const surfaceLevel1 = get('surface.level1') as string;

  const selectedIndex = options.findIndex(opt => opt.value === value);
  const selectedLayout = optionLayouts[value];

  // Animated indicator position
  const indicatorX = useSharedValue(selectedLayout?.x ?? 0);
  const indicatorWidth = useSharedValue(selectedLayout?.width ?? 0);

  React.useEffect(() => {
    if (selectedLayout) {
      indicatorX.value = withSpring(selectedLayout.x, {
        damping: 30,
        stiffness: 400,
        mass: 0.5,
      });
      indicatorWidth.value = withSpring(selectedLayout.width, {
        damping: 30,
        stiffness: 400,
        mass: 0.5,
      });
    }
  }, [selectedLayout]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  const handleLayout = (optValue: T, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setOptionLayouts(prev => ({
      ...prev,
      [optValue]: { x, width },
    }));
  };

  return (
    <View
      style={{
        backgroundColor: surfaceLevel1,
        borderRadius: radius.pill,
        padding: 4,
        flexDirection: 'row',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {/* Animated sliding indicator */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 4,
            bottom: 4,
            backgroundColor: accentPrimary,
            borderRadius: radius.pill,
            shadowColor: accentPrimary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 3,
          },
          indicatorStyle,
        ]}
      />

      {/* Options */}
      {options.map((option, index) => {
        const isSelected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            onLayout={(e) => handleLayout(option.value, e)}
            style={{
              flex: 1,
              paddingVertical: spacing.s8,
              paddingHorizontal: spacing.s12,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Text
              style={{
                color: isSelected ? textOnPrimary : muted,
                fontSize: 13,
                fontWeight: isSelected ? '800' : '600',
                transition: 'all 0.2s',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
