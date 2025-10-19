import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FMP_API_KEY } from '../config/secrets';

export type ThemeMode = 'system' | 'light' | 'dark';

export type Profile = {
  id: string;
  name: string;
  handle?: string;
  email: string;
  avatarUri?: string;
  currency: string;
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
  dataSource?: 'yahoo' | 'fmp';
  fmpApiKey?: string;
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
  dataSource: 'fmp',
  fmpApiKey: FMP_API_KEY,
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
