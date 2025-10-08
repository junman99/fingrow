import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import RootNavigator from './navigation/RootNavigator';
import AuthNavigator from './navigation/AuthNavigator';
import { useTxStore } from './store/transactions';
import { useGroupsStore } from './store/groups';
import { useAuthStore } from './store/auth';
import { seedInvestSixMonths } from './lib/demo_invest';
import { useInvestStore } from './store/invest';

function StatusBarThemed() {
  const { isDark } = useTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}

function AppBody() {
  const { navTheme } = useTheme();
  const { isSignedIn, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    useTxStore.getState().hydrate();
    useGroupsStore.getState().hydrate();
    useInvestStore.getState().hydrate();
    hydrate();
  }, [hydrate]);

  // Seed 6 months demo invest data once on first run, then fetch quotes
  useEffect(() => {
    (async () => {
      try {
        const k = 'fingrow:investDemoSeeded:v1';
        const done = await AsyncStorage.getItem(k);
        const hasAnySymbols = (useInvestStore.getState().allSymbols()?.length || 0) > 0;
        if (!done && !hasAnySymbols) {
          const pid = useInvestStore.getState().activePortfolioId;
          await seedInvestSixMonths();
          await AsyncStorage.setItem(k, '1');
        }
        const syms = useInvestStore.getState().allSymbols();
        if (syms && syms.length) {
          await useInvestStore.getState().refreshQuotes(syms);
        }
      } catch {}
    })();
  }, []);

  if (!hydrated) return null;

  if (!isSignedIn) {
    return (
      <NavigationContainer theme={navTheme}>
        <AuthNavigator />
      </NavigationContainer>
    );
  }
  return <RootNavigator />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBarThemed />
          <AppBody />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}