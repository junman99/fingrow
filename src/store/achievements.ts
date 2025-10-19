import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'spending' | 'saving' | 'investing' | 'learning' | 'streaks';
  unlockedAt?: number;
  progress?: number;
  target?: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Spending achievements
  {
    id: 'first_transaction',
    title: 'First Step',
    description: 'Record your first transaction',
    icon: 'check-circle',
    category: 'spending',
  },
  {
    id: 'budget_master',
    title: 'Budget Master',
    description: 'Stay under budget for a full month',
    icon: 'target',
    category: 'spending',
  },
  {
    id: 'categorize_pro',
    title: 'Categorize Pro',
    description: 'Categorize 50 transactions',
    icon: 'tag',
    category: 'spending',
    target: 50,
  },

  // Saving achievements
  {
    id: 'savings_starter',
    title: 'Savings Starter',
    description: 'Save your first $100',
    icon: 'piggy-bank',
    category: 'saving',
    target: 100,
  },
  {
    id: 'emergency_fund',
    title: 'Emergency Ready',
    description: 'Build a 3-month emergency fund',
    icon: 'shield',
    category: 'saving',
  },
  {
    id: 'goal_achiever',
    title: 'Goal Achiever',
    description: 'Complete your first savings goal',
    icon: 'flag',
    category: 'saving',
  },

  // Investing achievements
  {
    id: 'first_investment',
    title: 'Market Entry',
    description: 'Make your first investment',
    icon: 'trending-up',
    category: 'investing',
  },
  {
    id: 'diversified',
    title: 'Diversified',
    description: 'Own 5 different assets',
    icon: 'layers',
    category: 'investing',
    target: 5,
  },
  {
    id: 'portfolio_milestone',
    title: 'Portfolio Milestone',
    description: 'Reach $1,000 invested',
    icon: 'gift',
    category: 'investing',
    target: 1000,
  },

  // Learning achievements
  {
    id: 'quiz_master',
    title: 'Quiz Master',
    description: 'Complete 10 financial quizzes',
    icon: 'book',
    category: 'learning',
    target: 10,
  },
  {
    id: 'perfect_score',
    title: 'Perfect Score',
    description: 'Get 100% on a quiz',
    icon: 'award',
    category: 'learning',
  },

  // Streak achievements
  {
    id: 'week_warrior',
    title: 'Week Warrior',
    description: 'Log in 7 days in a row',
    icon: 'calendar',
    category: 'streaks',
    target: 7,
  },
  {
    id: 'monthly_champion',
    title: 'Monthly Champion',
    description: 'Log in 30 days in a row',
    icon: 'trophy',
    category: 'streaks',
    target: 30,
  },
  {
    id: 'consistency_king',
    title: 'Consistency King',
    description: 'Log in 100 days in a row',
    icon: 'crown',
    category: 'streaks',
    target: 100,
  },
  {
    id: 'frugal_month',
    title: 'Frugal Master',
    description: 'Spend less than $500 in a month',
    icon: 'coffee',
    category: 'spending',
  },
  {
    id: 'zero_impulse',
    title: 'Zero Impulse',
    description: 'No unplanned purchases for a week',
    icon: 'lock',
    category: 'spending',
  },
  {
    id: 'thousand_saver',
    title: 'Thousand Club',
    description: 'Save $1,000 total',
    icon: 'dollar-sign',
    category: 'saving',
    target: 1000,
  },
  {
    id: 'portfolio_5k',
    title: 'Rising Star',
    description: 'Reach $5,000 portfolio value',
    icon: 'rocket',
    category: 'investing',
    target: 5000,
  },
  {
    id: 'portfolio_10k',
    title: 'Diamond Hands',
    description: 'Reach $10,000 portfolio value',
    icon: 'gem',
    category: 'investing',
    target: 10000,
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Log spending before 9 AM for 7 days',
    icon: 'sunrise',
    category: 'streaks',
  },
  {
    id: 'budget_ninja',
    title: 'Budget Ninja',
    description: 'Stay under budget for 3 months straight',
    icon: 'activity',
    category: 'spending',
  },
];

type AchievementState = {
  unlockedAchievements: Record<string, number>; // id -> timestamp
  progress: Record<string, number>; // id -> current progress
  lastChecked: number;
  newUnlocks: string[]; // Recently unlocked, not yet viewed

  // Actions
  unlockAchievement: (id: string) => Promise<void>;
  updateProgress: (id: string, progress: number) => Promise<void>;
  markAsViewed: (id: string) => void;
  checkAchievements: (stats: AchievementCheckStats) => Promise<void>;
  hydrate: () => Promise<void>;
};

export type AchievementCheckStats = {
  totalTransactions?: number;
  totalSaved?: number;
  investedAmount?: number;
  assetsCount?: number;
  currentStreak?: number;
  quizzesCompleted?: number;
  budgetMonthsUnder?: number;
  goalsCompleted?: number;
};

export const useAchievementsStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      unlockedAchievements: {},
      progress: {},
      lastChecked: Date.now(),
      newUnlocks: [],

      unlockAchievement: async (id: string) => {
        const { unlockedAchievements, newUnlocks } = get();
        if (unlockedAchievements[id]) return; // Already unlocked

        const now = Date.now();
        set({
          unlockedAchievements: { ...unlockedAchievements, [id]: now },
          newUnlocks: [...newUnlocks, id],
        });

        // Haptic feedback
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      },

      updateProgress: async (id: string, progress: number) => {
        const { progress: currentProgress } = get();
        set({ progress: { ...currentProgress, [id]: progress } });

        // Check if achievement should be unlocked
        const achievement = ACHIEVEMENTS.find(a => a.id === id);
        if (achievement?.target && progress >= achievement.target) {
          await get().unlockAchievement(id);
        }
      },

      markAsViewed: (id: string) => {
        const { newUnlocks } = get();
        set({ newUnlocks: newUnlocks.filter(unlockId => unlockId !== id) });
      },

      checkAchievements: async (stats: AchievementCheckStats) => {
        const { unlockAchievement, updateProgress } = get();

        // First transaction
        if (stats.totalTransactions && stats.totalTransactions >= 1) {
          await unlockAchievement('first_transaction');
        }

        // Categorize pro
        if (stats.totalTransactions) {
          await updateProgress('categorize_pro', stats.totalTransactions);
        }

        // Savings achievements
        if (stats.totalSaved) {
          if (stats.totalSaved >= 100) {
            await unlockAchievement('savings_starter');
          }
          await updateProgress('savings_starter', stats.totalSaved);
        }

        // Goals completed
        if (stats.goalsCompleted && stats.goalsCompleted >= 1) {
          await unlockAchievement('goal_achiever');
        }

        // Budget master
        if (stats.budgetMonthsUnder && stats.budgetMonthsUnder >= 1) {
          await unlockAchievement('budget_master');
        }

        // Investment achievements
        if (stats.investedAmount && stats.investedAmount > 0) {
          await unlockAchievement('first_investment');
          await updateProgress('portfolio_milestone', stats.investedAmount);
        }

        // Diversified
        if (stats.assetsCount) {
          await updateProgress('diversified', stats.assetsCount);
        }

        // Streak achievements
        if (stats.currentStreak) {
          await updateProgress('week_warrior', stats.currentStreak);
          await updateProgress('monthly_champion', stats.currentStreak);
          await updateProgress('consistency_king', stats.currentStreak);
        }

        // Quiz achievements
        if (stats.quizzesCompleted) {
          await updateProgress('quiz_master', stats.quizzesCompleted);
        }

        set({ lastChecked: Date.now() });
      },

      hydrate: async () => {
        // Rehydrate from storage if needed
        try {
          const stored = await AsyncStorage.getItem('achievements-storage');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.state) {
              set(parsed.state);
            }
          }
        } catch {}
      },
    }),
    {
      name: 'achievements-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Helper to get achievement with unlock status
export function getAchievementWithStatus(id: string): Achievement & { unlocked: boolean; progress?: number } {
  const achievement = ACHIEVEMENTS.find(a => a.id === id);
  if (!achievement) throw new Error(`Achievement ${id} not found`);

  const store = useAchievementsStore.getState();
  return {
    ...achievement,
    unlocked: !!store.unlockedAchievements[id],
    unlockedAt: store.unlockedAchievements[id],
    progress: store.progress[id],
  };
}

// Helper to get all achievements with status
export function getAllAchievementsWithStatus(): Array<Achievement & { unlocked: boolean }> {
  const store = useAchievementsStore.getState();
  return ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    unlocked: !!store.unlockedAchievements[achievement.id],
    unlockedAt: store.unlockedAchievements[achievement.id],
    progress: store.progress[achievement.id],
  }));
}
