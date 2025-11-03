import React, { useRef, useEffect } from 'react';
import { View, Pressable, Animated, PanResponder, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import Icon from './Icon';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BUTTON_SIZE = 56;
const EDGE_PADDING = 16;
const STORAGE_KEY = 'fingrow:floatingAIButton:position';

type Position = {
  x: number;
  y: number;
  side: 'left' | 'right';
};

export default function FloatingAIButton() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const currentPosition = useRef({
    x: Dimensions.get('window').width - BUTTON_SIZE - EDGE_PADDING,
    y: Dimensions.get('window').height * 0.7,
  });

  const accent = get('accent.primary') as string;
  const isDragging = useRef(false);

  // Load saved position on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const pos = JSON.parse(saved) as Position;
          currentPosition.current = { x: pos.x, y: pos.y };
          pan.setValue({ x: pos.x, y: pos.y });
        } else {
          pan.setValue({ x: currentPosition.current.x, y: currentPosition.current.y });
        }
      } catch {
        pan.setValue({ x: currentPosition.current.x, y: currentPosition.current.y });
      }
    })();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        Animated.spring(scale, {
          toValue: 0.9,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: (_, gesture) => {
        isDragging.current = true;
        // Simply follow finger from current position
        pan.setValue({
          x: currentPosition.current.x + gesture.dx,
          y: currentPosition.current.y + gesture.dy,
        });
      },
      onPanResponderRelease: (_, gesture) => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: false,
        }).start();

        // If barely moved, treat as tap
        if (!isDragging.current || (Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5)) {
          isDragging.current = false;
          handlePress();
          return;
        }

        const { width, height } = Dimensions.get('window');
        let newY = currentPosition.current.y + gesture.dy;

        // Clamp Y position
        const minY = 60;
        const maxY = height - BUTTON_SIZE - 100;
        newY = Math.max(minY, Math.min(maxY, newY));

        // Snap to nearest side
        const centerX = currentPosition.current.x + gesture.dx + BUTTON_SIZE / 2;
        const snapToRight = centerX > width / 2;
        const newX = snapToRight
          ? width - BUTTON_SIZE - EDGE_PADDING
          : EDGE_PADDING;

        // Update current position
        currentPosition.current = { x: newX, y: newY };

        // Save to storage
        const newPosition: Position = {
          x: newX,
          y: newY,
          side: snapToRight ? 'right' : 'left',
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPosition)).catch(() => {});

        // Animate to snapped position
        Animated.spring(pan, {
          toValue: { x: newX, y: newY },
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }).start();

        isDragging.current = false;
      },
    })
  ).current;

  const handlePress = () => {
    // Pulse animation before opening
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
      }),
    ]).start(() => {
      nav.navigate('AIAssistant');
    });
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        transform: [
          { translateX: pan.x },
          { translateY: pan.y },
          { scale: scale },
        ],
        zIndex: 9999,
      }}
    >
      <View
        style={{
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: BUTTON_SIZE / 2,
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          opacity: 0.7,
        }}
      >
        <Icon name="cpu" size={28} colorToken="text.onPrimary" />
      </View>
    </Animated.View>
  );
}
