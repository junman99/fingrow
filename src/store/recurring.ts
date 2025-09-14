import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Freq = 'monthly' | 'biweekly' | 'weekly';

export type Recurring = {
  id: string;
  label: string;
  category: string;
  amount: number;
  freq: Freq;
  anchorISO: string;   // first due date (or anchor date)
  endISO?: string | null; // optional end date
  occurrences?: number | null; // optional total count for installments
  autoPost?: boolean; // auto-create transaction on due
  autoMatch?: boolean; // try to match transactions near due
  remind?: boolean;   // push a reminder on due
  active?: boolean;   // allow disable without deleting
};

type State = {
  skipOnce: (id: string) => Promise<void>;
  snooze: (id: string, days: number) => Promise<void>;
  items: Recurring[];
  ready: boolean;
  hydrate: () => Promise<void>;
  add: (r: Omit<Recurring, 'id'>) => Promise<string>;
  update: (id: string, patch: Partial<Recurring>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

const KEY = 'fingrow/recurring';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function computeNextDue(r: Recurring, after = new Date()): Date | null {
  if (r.active === false) return null;
  const start = new Date(r.anchorISO);
  let due = new Date(Math.max(start.getTime(), startOfDay(after).getTime()));
  // ensure due is at least the anchor
  if (due < start) due = new Date(start);

  // step forward until due >= after
  const maxSteps = 200;
  let step = 0;
  while (due < after && step < maxSteps) {
    due = increment(due, r.freq, start);
    step++;
  }

  if (r.endISO && new Date(due) > new Date(r.endISO)) return null;
  return due;
}

function startOfDay(d: Date) { const n = new Date(d); n.setHours(0,0,0,0); return n; }

function lastDayOfMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function increment(d: Date, freq: Freq, anchor: Date): Date {
  if (freq === 'weekly') return new Date(d.getTime() + 7*24*60*60*1000);
  if (freq === 'biweekly') return new Date(d.getTime() + 14*24*60*60*1000);
  // monthly: preserve day-of-month as best effort
  const day = anchor.getDate();
  const y = d.getFullYear(), m = d.getMonth();
  const targetDay = Math.min(day, lastDayOfMonth(y, m+1));
  return new Date(y, m+1, targetDay);
}

export const useRecurringStore = create<State>((set, get) => ({
  items: [],
  ready: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const list = safeParse<Recurring[]>(raw, []);
      set({ items: list, ready: true });
    } catch {
      set({ ready: true });
    }
  },
  add: async (r) => {
    const id = Math.random().toString(36).slice(2);
    const item: Recurring = { active: true, autoPost: false, remind: true, autoMatch: true, ...r, id };
    const items = [...get().items, item];
    set({ items });
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
    return id;
  },
  update: async (id, patch) => {
    const items = get().items.map(it => it.id === id ? { ...it, ...patch } : it);
    set({ items });
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  },
  remove: async (id) => {
    const items = get().items.filter(it => it.id !== id);
    set({ items });
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  },
  clearAll: async () => {
    set({ items: [] });
    await AsyncStorage.setItem(KEY, JSON.stringify([]));
  },
  skipOnce: async (id) => {
    const { items } = get();
    const it = items.find(x => x.id === id);
    if (!it) return;
    const now = new Date();
    const due = computeNextDue(it, now);
    if (!due) return;
    const next = increment(due, it.freq, new Date(it.anchorISO));
    const updated = items.map(x => x.id === id ? { ...x, anchorISO: next.toISOString() } : x);
    set({ items: updated });
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  },
  snooze: async (id, days) => {
    const { items } = get();
    const it = items.find(x => x.id === id);
    if (!it) return;
    const now = new Date();
    const due = computeNextDue(it, now);
    if (!due) return;
    const snoozed = new Date(due.getTime() + days * 24 * 60 * 60 * 1000);
    const updated = items.map(x => x.id === id ? { ...x, anchorISO: snoozed.toISOString() } : x);
    set({ items: updated });
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  }
}));