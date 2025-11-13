import React, { createContext, useContext, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';

type TabBarScrollContextType = {
  scrollY: any; // Reanimated shared value
  lastScrollY: React.MutableRefObject<number>;
  contentHeight: any; // Reanimated shared value
  layoutHeight: any; // Reanimated shared value
};

const TabBarScrollContext = createContext<TabBarScrollContextType | null>(null);

export const TabBarScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scrollY = useSharedValue(0);
  const lastScrollY = useRef(0);
  const contentHeight = useSharedValue(0);
  const layoutHeight = useSharedValue(0);

  return (
    <TabBarScrollContext.Provider value={{ scrollY, lastScrollY, contentHeight, layoutHeight }}>
      {children}
    </TabBarScrollContext.Provider>
  );
};

export const useTabBarScroll = () => {
  const context = useContext(TabBarScrollContext);
  if (!context) {
    throw new Error('useTabBarScroll must be used within TabBarScrollProvider');
  }
  return context;
};
