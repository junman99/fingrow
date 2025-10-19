import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastVisit: number;
  totalVisits: number;
  visitDates: string[]; // ISO date strings (YYYY-MM-DD)

  // Actions
  recordVisit: () => void;
  resetStreak: () => void;
  hydrate: () => Promise<void>;
};

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isSameDay(date1: Date, date2: Date): boolean {
  return getDateString(date1) === getDateString(date2);
}

function isConsecutiveDay(lastDate: Date, currentDate: Date): boolean {
  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateString(lastDate) === getDateString(yesterday);
}

export const useStreaksStore = create<StreakState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastVisit: 0,
      totalVisits: 0,
      visitDates: [],

      recordVisit: () => {
        const now = Date.now();
        const today = new Date(now);
        const todayString = getDateString(today);

        const { lastVisit, currentStreak, longestStreak, totalVisits, visitDates } = get();

        // Check if already visited today
        if (visitDates.includes(todayString)) {
          // Update lastVisit but don't increment streak
          set({ lastVisit: now });
          return;
        }

        const lastVisitDate = lastVisit ? new Date(lastVisit) : null;
        let newStreak = currentStreak;

        if (!lastVisitDate) {
          // First ever visit
          newStreak = 1;
        } else if (isSameDay(lastVisitDate, today)) {
          // Already visited today (shouldn't happen due to check above)
          return;
        } else if (isConsecutiveDay(lastVisitDate, today)) {
          // Consecutive day
          newStreak = currentStreak + 1;
        } else {
          // Streak broken
          newStreak = 1;
        }

        const newLongest = Math.max(newStreak, longestStreak);
        const newVisitDates = [...visitDates, todayString].slice(-100); // Keep last 100 days

        set({
          currentStreak: newStreak,
          longestStreak: newLongest,
          lastVisit: now,
          totalVisits: totalVisits + 1,
          visitDates: newVisitDates,
        });
      },

      resetStreak: () => {
        set({ currentStreak: 0 });
      },

      hydrate: async () => {
        try {
          const stored = await AsyncStorage.getItem('streaks-storage');
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
      name: 'streaks-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Helper to get streak message
export function getStreakMessage(streak: number): string {
  if (streak === 0) return "Start your journey today!";
  if (streak === 1) return "Great start! Keep it going!";
  if (streak < 7) return `${streak} days strong! Keep building!`;
  if (streak < 30) return `${streak} days! You're on fire! 🔥`;
  if (streak < 100) return `${streak} days! You're a champion! 🏆`;
  return `${streak} days! Legendary status! 👑`;
}

// Helper to get next milestone
export function getNextMilestone(streak: number): { days: number; label: string } | null {
  const milestones = [
    { days: 7, label: 'Week Warrior' },
    { days: 14, label: 'Two Week Hero' },
    { days: 30, label: 'Monthly Champion' },
    { days: 60, label: 'Two Month Master' },
    { days: 100, label: 'Century Club' },
    { days: 365, label: 'Year Legend' },
  ];

  for (const milestone of milestones) {
    if (streak < milestone.days) {
      return milestone;
    }
  }
  return null;
}
