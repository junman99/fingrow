import React, { useEffect, useRef } from 'react';
import { Modal, View, Pressable, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius, elevation } from '../theme/tokens';
import Icon, { type IconName } from './Icon';

export type MenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: IconName;
  iconToken?: string;
  description?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  anchor: { x: number; y: number; w: number; h: number } | null;
  items: MenuItem[];
  maxWidth?: number;
};

export default function PopoverMenu({ visible, onClose, anchor, items, maxWidth = 240 }: Props) {
  console.log('🎨 [PopoverMenu] Rendering:', { visible, anchor, itemsCount: items.length });
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
  const muted = get('text.muted') as string;

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
      <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} pointerEvents='box-none'>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
        </Pressable>
        <Animated.View style={[styles.panel, { left, top, backgroundColor: bg, borderColor: border, transform: [{ scale }], opacity, zIndex: 10000 }]}>
          {items.map((it) => (
            <Pressable
              key={it.key}
              onPress={() => { onClose(); setTimeout(it.onPress, 0); }}
              style={({ pressed }) => [
                styles.itemRow,
                {
                  backgroundColor: pressed
                    ? withAlpha(get(it.iconToken || (it.destructive ? 'semantic.danger' : 'accent.primary')) as string, 0.08)
                    : 'transparent'
                }
              ]}
            >
              {it.icon ? (
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: withAlpha(get(it.iconToken || (it.destructive ? 'semantic.danger' : 'accent.primary')) as string, 0.12) }
                  ]}
                >
                  <Icon
                    name={it.icon}
                    size={18}
                    colorToken={it.iconToken || (it.destructive ? 'semantic.danger' : 'accent.primary')}
                  />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={{ color: it.destructive ? danger : text, fontSize: 15, fontWeight: '700' }}>{it.label}</Text>
                {it.description ? (
                  <Text style={{ color: it.destructive ? withAlpha(danger, 0.8) : muted, fontSize: 12, marginTop: 2 }}>
                    {it.description}
                  </Text>
                ) : null}
              </View>
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
    paddingVertical: spacing.s4,
    ...elevation.level2,
  },
  itemRow: {
    flexDirection:'row',
    alignItems:'center',
    gap: spacing.s12,
    paddingHorizontal: spacing.s16,
    paddingVertical: spacing.s10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems:'center',
    justifyContent:'center',
  },
});

function withAlpha(color: string, alpha: number): string {
  if (!color) return color;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw.padEnd(6, '0');
    const num = parseInt(hex.slice(0, 6), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const match = color.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([0-9.]+))?\)/i);
  if (match) {
    const [, r, g, b] = match;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
