import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from '../config/env';
import type { CountryCode } from '../lib/countryConfig';

export type ThemeMode = 'system' | 'light' | 'dark';

export type AITier = 'free' | 'premium';

export type Profile = {
  id: string;
  name: string;
  handle?: string;
  email: string;
  avatarUri?: string;
  country?: CountryCode; // User's country for region-specific features
  currency: string;
  investCurrency?: string; // Separate currency for investment portfolios
  budgetCycleDay: number;
  monthlyBudget?: number;
  monthlySavingsGoal?: number;
  themeMode: ThemeMode;
  language?: string;
  alerts: {
    budgetWarnings: boolean;
    largeTx: boolean;
    goalReminders: boolean;
  };
  analyticsOptIn: boolean;
  tier: 'Starter' | 'Plus';
  aiTier: AITier; // AI Assistant tier
  dataSource?: 'yahoo' | 'fmp' | 'finnhub';
  fmpApiKey?: string;
  finnhubApiKey?: string;
  includeRetirementInInvestments?: boolean; // Toggle to include retirement accounts in investment totals
  createdAt: string;
  updatedAt: string;
};

type ProfileState = {
  profile: Profile;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Profile>) => void;
  setAvatar: (uri: string | undefined) => Promise<void>;
  clearAllLocalData: () => Promise<void>;
};

const KEY = 'fingrow:profile:v1';

const defaultProfile: Profile = {
  id: 'me',
  name: 'There',
  email: 'you@example.com',
  currency: 'SGD',
  budgetCycleDay: 1,
  themeMode: 'system',
  alerts: { budgetWarnings: true, largeTx: true, goalReminders: false },
  analyticsOptIn: false,
  tier: 'Starter',
  aiTier: 'free', // Default AI tier
  dataSource: 'fmp',
  fmpApiKey: env.FMP_API_KEY,
  includeRetirementInInvestments: true, // Default to including retirement accounts
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: defaultProfile,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const prof = JSON.parse(raw);
        set({ profile: { ...defaultProfile, ...prof } });
      }
    } catch {}
  },
  update: (patch) => {
    const curr = get().profile;
    const next = { ...curr, ...patch, updatedAt: new Date().toISOString() };
    set({ profile: next });
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  },
  setAvatar: async (uri) => {
    const curr = get().profile;
    const next = { ...curr, avatarUri: uri, updatedAt: new Date().toISOString() };
    set({ profile: next });
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  },
  clearAllLocalData: async () => {
    await AsyncStorage.removeItem(KEY).catch(() => {});
    set({ profile: { ...defaultProfile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  },
}));
