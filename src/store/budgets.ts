
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fingrow/budget';

type BudgetState = {
  monthlyBudget: number | null;
  warnThreshold: number;
  ready: boolean;
  hydrate: () => Promise<void>;
  setMonthlyBudget: (val: number | null) => Promise<void>;
  setWarnThreshold: (val: number) => Promise<void>;
};

type Persist = { monthlyBudget: number | null; warnThreshold: number; };

export const useBudgetsStore = create<BudgetState>((set, get) => ({
  monthlyBudget: null,
  warnThreshold: 0.8,
  ready: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as Persist;
        set({ monthlyBudget: data.monthlyBudget ?? null, warnThreshold: typeof data.warnThreshold === 'number' ? data.warnThreshold : 0.8 });
      }
    } finally { set({ ready: true }); }
  },
  setMonthlyBudget: async (val) => {
    set({ monthlyBudget: val });
    const data: Persist = { monthlyBudget: val, warnThreshold: get().warnThreshold };
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  },
  setWarnThreshold: async (val) => {
    set({ warnThreshold: val });
    const data: Persist = { monthlyBudget: get().monthlyBudget, warnThreshold: val };
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  },
}));
