
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Goal = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // ISO
  icon?: string;       // emoji or token key
  roundUps?: boolean;
  autoSave?: { cadence: 'weekly'|'biweekly'|'monthly'; amount: number };
  createdAt: string;
  updatedAt: string;
  history: Array<{ id: string; type: 'contribution'|'roundup'|'adjust'; amount: number; date: string; note?: string }>;
};

type State = {
  goals: Goal[];
  ready: boolean;
  hydrate: () => Promise<void>;
  createGoal: (g: { title: string; targetAmount: number; targetDate?: string; icon?: string }) => Promise<string>;
  contribute: (id: string, amount: number, note?: string) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  setRoundUps: (id: string, enabled: boolean) => Promise<void>;
  setAutoSave: (id: string, cadence: 'weekly'|'biweekly'|'monthly', amount: number) => Promise<void>;
};

const KEY = 'fingrow.goals.v1';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useGoalsStore = create<State>((set, get) => ({
  goals: [],
  ready: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const arr = JSON.parse(raw) as Goal[];
        set({ goals: arr, ready: true });
      } else {
        set({ ready: true });
      }
    } catch {
      set({ ready: true });
    }
  },
  createGoal: async (input) => {
    const now = new Date().toISOString();
    const goal: Goal = {
      id: uid(),
      title: input.title.trim() || 'New Goal',
      targetAmount: Number(input.targetAmount) || 0,
      currentAmount: 0,
      targetDate: input.targetDate,
      icon: input.icon,
      createdAt: now,
      updatedAt: now,
      history: []
    };
    const arr = [goal, ...(get().goals || [])];
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
    return goal.id;
  },
  contribute: async (id, amount, note) => {
    const amt = Number(amount) || 0;
    const arr = (get().goals || []).map(g => {
      if (g.id !== id) return g;
      const now = new Date().toISOString();
      const hist = [{ id: uid(), type: 'contribution' as const, amount: amt, date: now, note }, ...(g.history || [])];
      return { ...g, currentAmount: (g.currentAmount || 0) + amt, updatedAt: now, history: hist };
    });
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  removeGoal: async (id) => {
    const arr = (get().goals || []).filter(g => g.id !== id);
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  setRoundUps: async (id, enabled) => {
    const arr = (get().goals || []).map(g => (g.id === id ? { ...g, roundUps: enabled, updatedAt: new Date().toISOString() } : g));
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  setAutoSave: async (id, cadence, amount) => {
    const arr = (get().goals || []).map(g => (g.id === id ? { ...g, autoSave: { cadence, amount }, updatedAt: new Date().toISOString() } : g));
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
}));
