import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DCAPlan = {
  amount: number;                // total amount per period (assume monthly for now)
  symbols: { symbol: string; weight: number }[]; // weights add up to 1
  period: 'monthly';
};

type State = {
  plan: DCAPlan | null;
  ready: boolean;
  hydrate: () => Promise<void>;
  save: (p: DCAPlan) => Promise<void>;
  clear: () => Promise<void>;
};

const KEY = 'fingrow:plans:v1';

export const usePlansStore = create<State>((set, get) => ({
  plan: null,
  ready: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const plan = raw ? JSON.parse(raw) as DCAPlan : null;
      set({ plan, ready: true });
    } catch {
      set({ plan: null, ready: true });
    }
  },
  save: async (p) => {
    set({ plan: p });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  },
  clear: async () => {
    set({ plan: null });
    try { await AsyncStorage.removeItem(KEY); } catch {}
  },
}));
