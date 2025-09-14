import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number; // default ~60% of screen
};

export default function BottomSheet({ visible, onClose, children, height }: Props) {
  const { get } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const overlayColor = (get('overlay.backdrop') as string) || 'rgba(0,0,0,0.35)';
  const bg = get('surface.level2') as string;

  const transY = useRef(new Animated.Value(1)).current; // 1 hidden, 0 shown
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(transY, { toValue: 0, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(transY, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
      ]).start();
    }
  }, [visible]);

  if (!visible) {
    // Keep it mounted for smooth close animation if needed; for simplicity, hide fully.
    // Alternatively, always render and control pointerEvents via 'fade' value.
  }

  const translateY = transY.interpolate({ inputRange: [0,1], outputRange: [0, 24 + (height || 520)] });

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={{ position:'absolute', left:0, right:0, top:0, bottom:0, opacity: fade }}>
      <Pressable
        onPress={onClose}
        style={{ position:'absolute', left:0, right:0, top:0, bottom:0 }}
      >
        <Animated.View style={{ flex:1, backgroundColor: overlayColor }} />
      </Pressable>

      <Animated.View
        style={{
          position:'absolute',
          left:0, right:0, bottom:0,
          transform:[{ translateY }],
        }}
      >
        <View
          style={{
            backgroundColor: bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: Math.max(insets.bottom, 16),
            paddingTop: spacing.s12,
            paddingHorizontal: spacing.s16,
          }}
        >
          <View style={{ width: 48, height: 4, borderRadius: 2, alignSelf:'center', marginBottom: spacing.s12, backgroundColor: get('border.subtle') as string }} />
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}