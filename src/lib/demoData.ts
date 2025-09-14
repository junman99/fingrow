
import { useTxStore, Transaction } from '../store/transactions';

const KEY = 'fingrow/transactions';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const categories = [
  { name: 'Food 🍔', min: 6, max: 50, p: 0.6 },
  { name: 'Bills 💡', min: 10, max: 120, p: 0.2 },
  { name: 'Groceries 🛒', min: 8, max: 80, p: 0.35 },
  { name: 'Transport 🚇', min: 2, max: 30, p: 0.35 },
  { name: 'Fun 🎮', min: 5, max: 60, p: 0.2 },
  { name: 'General', min: 5, max: 40, p: 0.15 },
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]) { return arr[Math.floor(Math.random()*arr.length)]; }

export async function simulateMonths(months = 3) {
  const store = useTxStore.getState();
  const now = new Date();
  const items: Transaction[] = [];

  for (let m = 0; m < months; m++) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();

    // Salary on 1st (income)
    const salaryDay = new Date(base.getFullYear(), base.getMonth(), 1);
    items.push({
      id: uid(),
      type: 'income',
      amount: Math.round(rand(2800, 3800) * 100) / 100,
      category: 'Salary',
      date: salaryDay.toISOString(),
      note: 'Monthly salary',
    });

    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(base.getFullYear(), base.getMonth(), d, Math.floor(rand(9, 21)), Math.floor(rand(0,60)));

      // Random expenses per day (0–3)
      const n = Math.random() < 0.15 ? 0 : Math.floor(rand(0, 3.9));
      for (let i = 0; i < n; i++) {
        const cat = pick(categories);
        items.push({
          id: uid(),
          type: 'expense',
          amount: Math.round(rand(cat.min, cat.max) * 100) / 100,
          category: cat.name,
          date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(rand(9, 22)), Math.floor(rand(0, 60))).toISOString(),
        });
      }

      // Occasional refund (income)
      if (Math.random() < 0.03) {
        items.push({
          id: uid(),
          type: 'income',
          amount: Math.round(rand(5, 60) * 100) / 100,
          category: 'Refund',
          date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(rand(12, 20)), Math.floor(rand(0, 60))).toISOString(),
          note: 'Refund',
        });
      }
    }
  }

  await store.insertMany(items);
  await store.hydrate();
}
