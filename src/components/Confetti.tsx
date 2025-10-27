import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ConfettiPiece = {
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  color: string;
  size: number;
};

type Props = {
  count?: number;
  duration?: number;
  colors?: string[];
  onComplete?: () => void;
};

const Confetti: React.FC<Props> = ({
  count = 50,
  duration = 3000,
  colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'],
  onComplete,
}) => {
  const pieces = useRef<ConfettiPiece[]>([]);

  useEffect(() => {
    // Initialize confetti pieces
    pieces.current = Array.from({ length: count }, () => {
      const startX = Math.random() * SCREEN_WIDTH;
      const startY = -20;
      const endY = SCREEN_HEIGHT + 20;
      const drift = (Math.random() - 0.5) * 200; // Horizontal drift

      return {
        x: new Animated.Value(startX),
        y: new Animated.Value(startY),
        rotation: new Animated.Value(0),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4, // 4-12px
      };
    });

    // Animate each piece
    const animations = pieces.current.map((piece, index) => {
      const delay = Math.random() * 300; // Stagger start times
      const fallDuration = duration + Math.random() * 1000 - 500; // Vary fall speed

      return Animated.parallel([
        // Fall down
        Animated.timing(piece.y, {
          toValue: SCREEN_HEIGHT + 20,
          duration: fallDuration,
          delay,
          useNativeDriver: true,
        }),
        // Horizontal drift
        Animated.sequence([
          Animated.timing(piece.x, {
            toValue: piece.x._value + (Math.random() - 0.5) * 100,
            duration: fallDuration / 2,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(piece.x, {
            toValue: piece.x._value + (Math.random() - 0.5) * 100,
            duration: fallDuration / 2,
            useNativeDriver: true,
          }),
        ]),
        // Rotation
        Animated.timing(piece.rotation, {
          toValue: Math.random() > 0.5 ? 360 : -360,
          duration: fallDuration,
          delay,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.parallel(animations).start(() => {
      if (onComplete) onComplete();
    });
  }, [count, duration, colors, onComplete]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      {pieces.current.map((piece, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: piece.size / 4,
            transform: [
              { translateX: piece.x },
              { translateY: piece.y },
              {
                rotate: piece.rotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
};

export default Confetti;
