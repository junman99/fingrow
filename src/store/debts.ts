import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DebtType = 'credit' | 'loan' | 'bnpl';

export type Debt = {
  id: string;
  name: string;
  type: DebtType;
  apr?: number;       // % APR
  balance: number;    // outstanding balance
  minDue: number;     // minimum payment per cycle
  dueISO: string;     // next due date ISO
};

type DebtsState = {
  items: Debt[];
  ready: boolean;
  hydrate: () => Promise<void>;
  add: (d: Omit<Debt, 'id'>) => Promise<void>;
  update: (id: string, patch: Partial<Debt>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

const KEY = 'fingrow:debts:v1';

export const useDebtsStore = create<DebtsState>((set, get) => ({
  items: [],
  ready: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const parsed: Debt[] = raw ? JSON.parse(raw) : [];
      set({ items: parsed, ready: true });
    } catch {
      set({ items: [], ready: true });
    }
  },
  add: async (d) => {
    const id = Math.random().toString(36).slice(2);
    const next = [...get().items, { id, ...d }];
    set({ items: next });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  },
  update: async (id, patch) => {
    const next = get().items.map(x => x.id === id ? { ...x, ...patch } : x);
    set({ items: next });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  },
  remove: async (id) => {
    const next = get().items.filter(x => x.id !== id);
    set({ items: next });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  },
  clearAll: async () => {
    set({ items: [] });
    try { await AsyncStorage.removeItem(KEY); } catch {}
  },
}));
