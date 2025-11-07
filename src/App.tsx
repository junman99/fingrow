import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import RootNavigator from './navigation/RootNavigator';
import AuthNavigator from './navigation/AuthNavigator';
import { useTxStore } from './store/transactions';
import { useGroupsStore } from './features/groups';
import { useAuthStore } from './store/auth';
import { seedInvestSixMonths } from './lib/demo_invest';
import { useInvestStore } from './features/invest';
import './i18n/config';

// Create a client for React Query with optimized cache settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Real-time quotes: 5 minutes cache
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch on window focus for mobile app
      refetchOnWindowFocus: false,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
  },
});

// Create persister to save cache to AsyncStorage
// This makes the cache survive app restarts - HUGE performance boost!
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'FINGROW_QUERY_CACHE',
  // Only persist ticker data, not other queries
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }} // 24 hours max cache age
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <StatusBarThemed />
            <AppBody />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}