
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GoalType = 'milestone' | 'networth';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
  type: 'first_goal' | 'goal_completed' | 'streak' | 'multi_goal' | 'big_saver' | 'speedster' | 'consistent' | 'level_up';
};

export type Goal = {
  id: string;
  type: GoalType; // milestone or networth
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // ISO
  icon?: string;       // emoji or token key
  category?: string;   // for milestone: 'wedding', 'trip', 'computer', 'house', 'car', 'education', 'other'
  roundUps?: boolean;
  autoSave?: { cadence: 'weekly'|'biweekly'|'monthly'; amount: number };
  linkedTransactions?: string[]; // transaction IDs linked to this goal
  isPinned?: boolean; // pinned goals appear prominently
  completedAt?: string; // ISO date when goal was completed
  createdAt: string;
  updatedAt: string;
  history: Array<{ id: string; type: 'contribution'|'roundup'|'adjust'; amount: number; date: string; note?: string }>;
};

type State = {
  goals: Goal[];
  achievements: Achievement[];
  level: number;
  xp: number;
  ready: boolean;
  hydrate: () => Promise<void>;
  createGoal: (g: { type: GoalType; title: string; targetAmount: number; targetDate?: string; icon?: string; category?: string }) => Promise<string>;
  contribute: (id: string, amount: number, note?: string) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  completeGoal: (id: string) => Promise<void>;
  pinGoal: (id: string, pinned: boolean) => Promise<void>;
  linkTransaction: (goalId: string, transactionId: string) => Promise<void>;
  unlinkTransaction: (goalId: string, transactionId: string) => Promise<void>;
  setRoundUps: (id: string, enabled: boolean) => Promise<void>;
  setAutoSave: (id: string, cadence: 'weekly'|'biweekly'|'monthly', amount: number) => Promise<void>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<void>;
  unlockAchievement: (type: Achievement['type'], title: string, description: string, icon: string) => Promise<Achievement | null>;
  addXP: (amount: number) => Promise<void>;
};

const KEY = 'fingrow.goals.v1';
const ACHIEVEMENTS_KEY = 'fingrow.goals.achievements.v1';
const PROGRESS_KEY = 'fingrow.goals.progress.v1';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// XP needed for each level: level * 100
function xpForLevel(level: number): number {
  return level * 100;
}

export const useGoalsStore = create<State>((set, get) => ({
  goals: [],
  achievements: [],
  level: 1,
  xp: 0,
  ready: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const achievementsRaw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
      const progressRaw = await AsyncStorage.getItem(PROGRESS_KEY);

      const goals = raw ? (JSON.parse(raw) as Goal[]) : [];
      const achievements = achievementsRaw ? (JSON.parse(achievementsRaw) as Achievement[]) : [];
      const progress = progressRaw ? JSON.parse(progressRaw) : { level: 1, xp: 0 };

      set({ goals, achievements, level: progress.level, xp: progress.xp, ready: true });
    } catch {
      set({ ready: true });
    }
  },
  createGoal: async (input) => {
    const now = new Date().toISOString();
    const goal: Goal = {
      id: uid(),
      type: input.type || 'milestone',
      title: input.title.trim() || 'New Goal',
      targetAmount: Number(input.targetAmount) || 0,
      currentAmount: 0,
      targetDate: input.targetDate,
      icon: input.icon,
      category: input.category,
      createdAt: now,
      updatedAt: now,
      history: []
    };
    const arr = [goal, ...(get().goals || [])];
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));

    // Check for first goal achievement
    if (arr.length === 1) {
      await get().unlockAchievement('first_goal', 'First Goal!', 'You created your first goal', '🎯');
    }

    // Check for multi-goal achievement
    if (arr.length === 3) {
      await get().unlockAchievement('multi_goal', 'Multi-Tasker', 'Managing 3 goals at once', '🎭');
    }

    // Award XP for creating a goal
    await get().addXP(10);

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

    // Award XP for contributing
    await get().addXP(5);

    // Check if goal is now complete
    const goal = arr.find(g => g.id === id);
    if (goal && goal.currentAmount >= goal.targetAmount && !goal.completedAt) {
      await get().completeGoal(id);
    }
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
  completeGoal: async (id) => {
    const now = new Date().toISOString();
    const arr = (get().goals || []).map(g => (g.id === id ? { ...g, completedAt: now, updatedAt: now } : g));
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));

    // Unlock achievement for completing first goal
    const completedCount = arr.filter(g => g.completedAt).length;
    if (completedCount === 1) {
      await get().unlockAchievement('goal_completed', 'Goal Crusher!', 'Completed your first goal', '🏆');
    }

    // Check for speedster achievement (completed in less than half the time)
    const goal = arr.find(g => g.id === id);
    if (goal && goal.targetDate) {
      const created = new Date(goal.createdAt);
      const target = new Date(goal.targetDate);
      const completed = new Date(now);
      const totalTime = target.getTime() - created.getTime();
      const actualTime = completed.getTime() - created.getTime();
      if (actualTime < totalTime / 2) {
        await get().unlockAchievement('speedster', 'Speedster!', 'Completed a goal in half the time', '⚡');
      }
    }

    // Award XP for completing goal
    await get().addXP(100);
  },
  pinGoal: async (id, pinned) => {
    const arr = (get().goals || []).map(g => (g.id === id ? { ...g, isPinned: pinned, updatedAt: new Date().toISOString() } : g));
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  linkTransaction: async (goalId, transactionId) => {
    const arr = (get().goals || []).map(g => {
      if (g.id !== goalId) return g;
      const linked = g.linkedTransactions || [];
      if (linked.includes(transactionId)) return g;
      return { ...g, linkedTransactions: [...linked, transactionId], updatedAt: new Date().toISOString() };
    });
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  unlinkTransaction: async (goalId, transactionId) => {
    const arr = (get().goals || []).map(g => {
      if (g.id !== goalId) return g;
      const linked = (g.linkedTransactions || []).filter(tid => tid !== transactionId);
      return { ...g, linkedTransactions: linked, updatedAt: new Date().toISOString() };
    });
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  updateGoal: async (id, patch) => {
    const arr = (get().goals || []).map(g => (g.id === id ? { ...g, ...patch, updatedAt: new Date().toISOString() } : g));
    set({ goals: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  },
  unlockAchievement: async (type, title, description, icon) => {
    const existing = get().achievements.find(a => a.type === type);
    if (existing) return null; // Already unlocked

    const achievement: Achievement = {
      id: uid(),
      type,
      title,
      description,
      icon,
      unlockedAt: new Date().toISOString()
    };

    const achievements = [...get().achievements, achievement];
    set({ achievements });
    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));

    // Award XP for unlocking achievement
    await get().addXP(50);

    return achievement;
  },
  addXP: async (amount) => {
    let { xp, level } = get();
    xp += amount;

    // Check for level up
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;

      // Unlock level up achievement
      await get().unlockAchievement(
        'level_up',
        `Level ${level} Achieved!`,
        `You've reached level ${level}`,
        '⬆️'
      );
    }

    set({ xp, level });
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ level, xp }));
  },
}));
