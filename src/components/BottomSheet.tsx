import React, { useEffect } from 'react';
import { Pressable, View, StyleSheet, Platform, Dimensions, Modal, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSpring, runOnJS, interpolate, Extrapolate } from 'react-native-reanimated';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number; // desired content height (approx)
  dimmed?: boolean; // if true, sheet stays visible but backdrop is hidden and gestures disabled
  fullHeight?: boolean;
};

export default function BottomSheet({ visible, onClose, children, height, dimmed, fullHeight }: Props) {
  console.log('📄 [BottomSheet] Rendering with visible:', visible, 'dimmed:', dimmed);

  const { get } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const screenH = Dimensions.get('window').height;
  const maxH = Math.max(0, screenH - insets.top - 8);
  const desired = fullHeight ? maxH : (height || Math.round(screenH * 0.6));
  const SHEET_H = Math.min(desired, maxH);
  const CLOSED_Y = SHEET_H + 24; // offscreen
  const MID_Y = SHEET_H * 0.48;
  const OPEN_Y = 0;

  const y = useSharedValue(CLOSED_Y);
  const kb = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      y.value = CLOSED_Y; // Reset to closed before animating
      y.value = withSpring(OPEN_Y, { damping: 30, stiffness: 350, mass: 0.9 });
    } else {
      y.value = withTiming(CLOSED_Y, { duration: 200 });
    }
  }, [visible]);

  // Keyboard lift: push sheet above keyboard smoothly
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(show as any, (e: any) => {
      const h = e?.endCoordinates?.height || 0;
      kb.value = withTiming(h, { duration: Platform.OS === 'ios' ? (e?.duration || 200) : 160 });
    });
    const subHide = Keyboard.addListener(hide as any, (e: any) => {
      kb.value = withTiming(0, { duration: Platform.OS === 'ios' ? (e?.duration || 200) : 120 });
    });
    return () => { try { (subShow as any)?.remove?.(); (subHide as any)?.remove?.(); } catch {} };
  }, []);

  const closeAnimated = () => {
    y.value = withTiming(CLOSED_Y, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const backdropStyle = useAnimatedStyle(() => {
    const opacity = dimmed ? 0 : interpolate(y.value, [OPEN_Y, CLOSED_Y], [1, 0], Extrapolate.CLAMP);
    return { opacity };
  });

  const sheetStyle = useAnimatedStyle(() => {
    return { transform: [{ translateY: y.value }], bottom: kb.value } as any;
  });

  const pan = Gesture.Pan()
    .onChange((e) => {
      const next = Math.min(Math.max(OPEN_Y, y.value + e.changeY), CLOSED_Y);
      y.value = next;
    })
    .onEnd((e) => {
      const vy = e.velocityY;
      const current = y.value;
      const thresholdClose = SHEET_H * 0.28;
      if (vy > 1200 || current > thresholdClose) {
        y.value = withTiming(CLOSED_Y, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else if (current > MID_Y * 0.7) {
        y.value = withSpring(MID_Y, { damping: 26, stiffness: 260 });
      } else {
        y.value = withSpring(OPEN_Y, { damping: 26, stiffness: 260 });
      }
    });

  const overlayColor = Platform.select({
    ios: 'rgba(0,0,0,0.34)',
    android: 'rgba(0,0,0,0.38)',
    default: 'rgba(0,0,0,0.36)',
  })!;

  // Opaque sheet background (component token). This avoids showing UI behind it.
  const sheetBg = get('component.sheet.bg') as string;
  const handleBg = get('border.subtle') as string;

  return (
    <Modal transparent statusBarTranslucent visible={visible} animationType="none" onRequestClose={dimmed ? undefined : closeAnimated}>
      <View style={StyleSheet.absoluteFill} pointerEvents={visible && !dimmed ? 'auto' : 'none'}>
        {/* Backdrop covering the entire screen INCLUDING the tab bar */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }, backdropStyle]}>
          <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={dimmed ? undefined : closeAnimated} />
        </Animated.View>

        {/* Sheet over everything */}
        <GestureDetector gesture={dimmed ? Gesture.Pan() : pan}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0, right: 0, bottom: 0,
                paddingBottom: Math.max(insets.bottom, 16),
                paddingTop: spacing.s12,
                paddingHorizontal: spacing.s16,
                backgroundColor: sheetBg,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,

                height: SHEET_H,},
              sheetStyle,
            ]}
            pointerEvents={dimmed ? 'none' : 'auto'}
          >
            <View style={{ alignSelf:'center', width: 48, height: 4, borderRadius: 2, marginBottom: spacing.s12, backgroundColor: handleBg }} />
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}
