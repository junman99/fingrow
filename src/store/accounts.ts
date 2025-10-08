import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BankAccount = {
  id: string;
  name: string;
  institution?: string;
  mask?: string; // last 4
  balance: number; // in user's currency for now
};

type AccountsState = {
  accounts: BankAccount[];
  hydrate: () => Promise<void>;
  addAccount: (a: Omit<BankAccount, 'id'>) => Promise<void>;
  updateAccount: (id: string, patch: Partial<BankAccount>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
};

const KEY = 'fingrow:accounts:v1';

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ accounts: JSON.parse(raw) });
    } catch {}
  },
  addAccount: async (a) => {
    const id = Math.random().toString(36).slice(2);
    const next = [...get().accounts, { id, ...a }];
    set({ accounts: next });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  },
  updateAccount: async (id, patch) => {
    const next = get().accounts.map(x => x.id === id ? { ...x, ...patch } : x);
    set({ accounts: next });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  },
  removeAccount: async (id) => {
    const next = get().accounts.filter(x => x.id !== id);
    set({ accounts: next });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  },
}));
