import { ScrollContext } from './ScrollContext';
import React, { useState, useCallback, useMemo } from 'react';
import { Platform, KeyboardAvoidingView, View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';
type ScrollProps = {
  children: React.ReactNode;
  style?: any;
  contentStyle?: any;
  allowBounce?: boolean;
  stickyHeaderIndices?: number[];
  onScroll?: any;
  scrollEventThrottle?: number;
  inTab?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export const ScreenScroll: React.FC<ScrollProps> = ({  children, style, contentStyle, allowBounce = true, stickyHeaderIndices, onScroll, scrollEventThrottle = 16, inTab, refreshing, onRefresh  }) => {
  const { get } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 0; // Bottom tab bar height (if needed, import from @react-navigation/bottom-tabs)
  const bottomPad = inTab ? 0 : Math.max(insets.bottom, 16);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  return (
    <ScrollContext.Provider value={{ setScrollEnabled }}>
    <SafeAreaView edges={inTab ? ['top','left','right'] : ['top','left','right','bottom']} style={{ flex: 1, backgroundColor: get('background.default') as string }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[{ flex: 1 }, style]}>
          <ScrollView directionalLockEnabled scrollEnabled={scrollEnabled}
            overScrollMode="always"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            alwaysBounceVertical={Platform.OS === 'ios' && allowBounce}
            contentContainerStyle={[{ flexGrow: 1, paddingBottom: bottomPad }, contentStyle]}
            contentInset={{ bottom: bottomPad }}
            scrollIndicatorInsets={{ bottom: bottomPad }}
            stickyHeaderIndices={stickyHeaderIndices}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
            onScroll={onScroll}
            scrollEventThrottle={scrollEventThrottle}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </ScrollContext.Provider>
  );
};
