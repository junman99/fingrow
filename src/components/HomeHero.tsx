import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

/**
 * Full-bleed hero background that stretches into the top safe area and
 * uses theme accents for a gradient. Place greeting + chart inside.
 */
export default function HomeHero({ children }: React.PropsWithChildren<{}>) {
  const { get } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const topPad = insets.top;
  const a = get('accent.primary') as string;
  const b = get('accent.secondary') as string;
  const bg = get('background.default') as string;

  return (
    <View style={{ marginTop: -topPad, marginHorizontal: -spacing.s16, backgroundColor: bg }}>
      <LinearGradient
        colors={[a, b]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: topPad + spacing.s16,
          paddingHorizontal: spacing.s16,
          paddingBottom: spacing.s16,
          borderBottomLeftRadius: radius.xl,
          borderBottomRightRadius: radius.xl,
        }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
