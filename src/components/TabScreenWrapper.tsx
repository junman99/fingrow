import React from 'react';
import { View } from 'react-native';
import FloatingAIButton from './FloatingAIButton';

type Props = {
  children: React.ReactNode;
  showFloatingAI?: boolean;
};

/**
 * Wrapper component for tab screens that shows the floating AI button
 */
export default function TabScreenWrapper({ children, showFloatingAI = true }: Props) {
  return (
    <View style={{ flex: 1 }}>
      {children}
      {showFloatingAI && <FloatingAIButton />}
    </View>
  );
}
