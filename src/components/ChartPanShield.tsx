import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { ScrollContext } from './ScrollContext';

/**
 * Locks parent vertical scroll while a horizontal pan is active.
 * - Uses activeOffsetX + failOffsetY for early, directional recognition.
 * - Allows child touch handlers (pointerEvents = 'box-none') so tooltips/popups keep working.
 */
const ChartPanShield: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setScrollEnabled } = React.useContext(ScrollContext);

  const enableParent = React.useCallback(() => {
    if (setScrollEnabled) setScrollEnabled(true);
  }, [setScrollEnabled]);

  const disableParent = React.useCallback(() => {
    if (setScrollEnabled) setScrollEnabled(false);
  }, [setScrollEnabled]);

  const pan = Gesture.Pan()
    .maxPointers(1)
    // Be picky about direction: activate only when clearly horizontal,
    // and fail quickly on vertical so page scroll works when intended.
    .activeOffsetX([-4, 4])
    .failOffsetY([-8, 8])
    .onBegin(() => {
      // Activated as horizontal — take over and disable vertical scroll
      runOnJS(disableParent)();
    })
    .onFinalize(() => {
      // Always restore
      runOnJS(enableParent)();
    });

  return (
    <GestureDetector gesture={pan}>
      <View pointerEvents="box-none">
        {children}
      </View>
    </GestureDetector>
  );
};

export default ChartPanShield;
