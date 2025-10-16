import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

type Props = {
  size?: number;
  showWordmark?: boolean;
};

export const FingrowLogo: React.FC<Props> = ({ size = 96, showWordmark }) => {
  const { get } = useThemeTokens();
  const accentA = get('accent.primary') as string;
  const accentB = get('accent.secondary') as string;
  const surface = get('surface.level1') as string;
  const text = get('text.primary') as string;
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(animated, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [animated]);

  const rotate = animated.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const pulse = animated.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.85, 1.05, 0.85],
  });

  const glowColors = useMemo<[string, string, string]>(
    () => [accentA, accentB, accentA],
    [accentA, accentB]
  );

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <AnimatedGradient
        colors={glowColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate }],
        }}
      >
        <Animated.View
          style={{
            width: size * 0.82,
            height: size * 0.82,
            borderRadius: size / 2,
            backgroundColor: surface,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pulse }],
            shadowColor: accentB,
            shadowOpacity: 0.28,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text style={{ fontSize: size * 0.32, fontWeight: '800', color: text }}>
            FG
          </Text>
        </Animated.View>
      </AnimatedGradient>
      {showWordmark ? (
        <Text
          style={{
            marginTop: spacing.s8,
            fontSize: size * 0.26,
            fontWeight: '800',
            color: text,
            letterSpacing: 1,
          }}
        >
          FinGrow
        </Text>
      ) : null}
    </View>
  );
};

export default FingrowLogo;
