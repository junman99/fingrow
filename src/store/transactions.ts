
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TxType = 'expense' | 'income';
export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  date: string;
  note?: string;
  title?: string;
  account?: string;
};

type State = {
  transactions: Transaction[];
  ready: boolean;
  add: (input: {
    type: TxType;
    amount: number | string;
    category: string;
    date?: string;
    note?: string;
    account?: string;
  }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  hydrate: () => Promise<void>;
  restore: (tx: Transaction) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
};

const KEY = 'fingrow/transactions';

function uid() { return Math.random().toString(36).slice(2); }

export const useTxStore = create<State>((set, get) => ({
  transactions: [],
  ready: false,
  add: async (input) => {
    const { type, category } = input as any;
    const amountNum = Number((input as any).amount);
    const amount = Number.isFinite(amountNum) ? amountNum : 0;
    const date = (input as any).date ? String((input as any).date) : new Date().toISOString();
    const note = (input as any).note ?? '';
    const account = (input as any).account ?? undefined;
    const tx: Transaction = {
      id: uid(),
      type: type as TxType,
      amount,
      category,
      date,
      note,
      account,
    };
    const arr = [tx, ...(get().transactions || [])];
    set({ transactions: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  remove: async (id) => {
    const arr = (get().transactions || []).filter(t => t.id !== id);
    set({ transactions: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  clearAll: async () => {
    set({ transactions: [] });
    await AsyncStorage.removeItem(KEY);
  },
  restore: async (tx) => {
    const arr = [tx, ...(get().transactions || [])];
    set({ transactions: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: Transaction[] = raw ? JSON.parse(raw) : [];
    set({ transactions: parsed, ready: true });
  },
  updateTransaction: async (id, updates) => {
    const arr = (get().transactions || []).map(t => t.id === id ? { ...t, ...updates } : t);
    set({ transactions: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  deleteTransaction: async (id) => {
    const arr = (get().transactions || []).filter(t => t.id !== id);
    set({ transactions: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  }
}));
