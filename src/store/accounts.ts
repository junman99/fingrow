import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BankAccount = {
  id: string;
  name: string;
  institution?: string;
  mask?: string; // last 4
  balance: number; // in user's currency for now
  kind?: 'checking' | 'savings' | 'cash' | 'credit' | 'investment' | 'retirement' | 'loan' | 'mortgage' | 'other';
  includeInNetWorth?: boolean;
  note?: string;
  isDefault?: boolean; // default account for transactions
  apr?: number; // Annual Percentage Rate for credit cards/loans
  creditLimit?: number; // Credit limit for credit cards
  minPaymentPercent?: number; // Minimum payment percentage (e.g., 2.5%)
};

type AccountsState = {
  accounts: BankAccount[];
  hydrate: () => Promise<void>;
  addAccount: (a: Omit<BankAccount, 'id'>) => Promise<void>;
  updateAccount: (id: string, patch: Partial<BankAccount>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  setDefaultAccount: (id: string) => Promise<void>;
  updateAccountBalance: (accountName: string, amount: number, isExpense: boolean) => Promise<void>;
  payCredit: (creditCardName: string, fromAccountName: string, amount: number) => Promise<void>;
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
  setDefaultAccount: async (id) => {
    const next = get().accounts.map(x => ({ ...x, isDefault: x.id === id }));
    set({ accounts: next });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  },
  updateAccountBalance: async (accountName, amount, isExpense) => {
    const account = get().accounts.find(a => a.name === accountName);
    if (!account) return;

    // For credit cards, expenses increase debt (make balance more negative)
    // For regular accounts, expenses decrease balance
    let newBalance: number;
    if (account.kind === 'credit') {
      // Credit card: expense increases debt (more negative), income decreases debt (less negative)
      newBalance = isExpense ? account.balance - amount : account.balance + amount;
    } else {
      // Regular account: expense decreases balance, income increases balance
      newBalance = isExpense ? account.balance - amount : account.balance + amount;
    }

    const next = get().accounts.map(a => a.id === account.id ? { ...a, balance: newBalance } : a);
    set({ accounts: next });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  },
  payCredit: async (creditCardName, fromAccountName, amount) => {
    const creditCard = get().accounts.find(a => a.name === creditCardName && a.kind === 'credit');
    const fromAccount = get().accounts.find(a => a.name === fromAccountName);

    if (!creditCard || !fromAccount) return;

    // Reduce credit card debt (make balance less negative)
    const newCreditBalance = creditCard.balance + amount;

    // Reduce the paying account balance
    const newFromBalance = fromAccount.balance - amount;

    const next = get().accounts.map(a => {
      if (a.id === creditCard.id) return { ...a, balance: newCreditBalance };
      if (a.id === fromAccount.id) return { ...a, balance: newFromBalance };
      return a;
    });

    set({ accounts: next });
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  },
}));
