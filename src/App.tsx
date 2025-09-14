import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import * as SafeAreaCtx from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import RootNavigator from './navigation/RootNavigator';
import { useTxStore } from './store/transactions';
import { useGroupsStore } from './store/groups';

function StatusBarThemed() {
  const { isDark } = useTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}

export default function App() {
  const SafeAreaProvider = (SafeAreaCtx as any)?.SafeAreaProvider || React.Fragment;

  useEffect(() => {
    useTxStore.getState().hydrate();
    useGroupsStore.getState().hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBarThemed />
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
