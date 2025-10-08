import React, { useEffect, useRef } from 'react';
import { Modal, View, Pressable, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius, elevation } from '../theme/tokens';

export type MenuItem = { key: string; label: string; onPress: () => void; destructive?: boolean };

type Props = {
  visible: boolean;
  onClose: () => void;
  anchor: { x: number; y: number; w: number; h: number } | null;
  items: MenuItem[];
  maxWidth?: number;
};

export default function PopoverMenu({ visible, onClose, anchor, items, maxWidth = 240 }: Props) {
  const { get } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const scrW = Dimensions.get('window').width;

  const margin = 8;
  const left = anchor ? Math.min(scrW - margin - maxWidth, Math.max(margin, anchor.x + anchor.w - maxWidth)) : margin;
  const top = anchor ? Math.max(insets.top + margin, anchor.y + anchor.h + 6) : insets.top + 60;

  const bg = get('component.popover.bg') as string;  // translucent
  const border = get('border.subtle') as string;
  const text = get('text.primary') as string;
  const danger = get('semantic.danger') as string;

  // Pure RN Animated for stability
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      scale.setValue(0.88); opacity.setValue(0);
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.98, duration: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
        </Pressable>
        <Animated.View style={[styles.panel, { left, top, backgroundColor: bg, borderColor: border, transform: [{ scale }], opacity }]}>
          {items.map((it) => (
            <Pressable
              key={it.key}
              onPress={() => { onClose(); setTimeout(it.onPress, 0); }}
              style={({ pressed }) => [{ paddingVertical: spacing.s12, paddingHorizontal: spacing.s16, opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={{ color: it.destructive ? danger : text, fontSize: 16, fontWeight: '600' }}>{it.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position:'absolute',
    width: 240,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow:'hidden',
    ...elevation.level2,
  }
});
