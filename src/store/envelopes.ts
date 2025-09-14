import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EnvelopeOverrides = Record<string, number>; // category -> cap (S$)

type State = {
  overrides: EnvelopeOverrides;
  ready: boolean;
  hydrate: () => Promise<void>;
  setOverride: (category: string, cap: number | null) => Promise<void>; // null to clear
  resetAll: () => Promise<void>;
};

const KEY = 'fingrow/envelopes/overrides';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export const useEnvelopesStore = create<State>((set, get) => ({
  overrides: {},
  ready: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const data = safeParse<EnvelopeOverrides>(raw, {});
      set({ overrides: data, ready: true });
    } catch {
      set({ ready: true });
    }
  },
  setOverride: async (category, cap) => {
    const curr = { ...get().overrides };
    if (cap === null || !isFinite(cap) || cap < 0) {
      delete curr[category];
    } else {
      curr[category] = Math.round(Number(cap));
    }
    set({ overrides: curr });
    await AsyncStorage.setItem(KEY, JSON.stringify(curr));
  },
  resetAll: async () => {
    set({ overrides: {} });
    await AsyncStorage.setItem(KEY, JSON.stringify({}));
  }
}));