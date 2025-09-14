
import { useTxStore } from '../store/transactions';
type Tx = ReturnType<typeof useTxStore.getState>['transactions'][number];

const categories = [
  { name: 'Food 🍔', min: 5, max: 40, weight: 0.28 },
  { name: 'Transport 🚗', min: 2, max: 15, weight: 0.18 },
  { name: 'Groceries 🛒', min: 8, max: 60, weight: 0.24 },
  { name: 'Bills 💡', min: 30, max: 180, weight: 0.12 },
  { name: 'Entertainment 🎮', min: 5, max: 80, weight: 0.10 },
  { name: 'Coffee ☕️', min: 3, max: 10, weight: 0.08 },
];

function pickCategory(r: number) { let acc=0; for(const c of categories){ acc+=c.weight; if(r<=acc) return c; } return categories[categories.length-1]; }
function randBetween(min: number, max: number) { return Math.random() * (max - min) + min; }

export async function seedFiveMonths() {
  const { add } = useTxStore.getState();
  const now = new Date();
  for(let m=0;m<5;m++){
    const ref = new Date(now.getFullYear(), now.getMonth()-m, 1);
    const days = new Date(ref.getFullYear(), ref.getMonth()+1, 0).getDate();
    // Salary
    const payDate = new Date(ref.getFullYear(), ref.getMonth(), 1 + Math.floor(Math.random()*3), 9, 0, 0);
    await add({ id: Math.random().toString(36).slice(2), type: 'income', amount: Math.floor(randBetween(1800, 3200)), category: 'Salary 💼', date: payDate.toISOString(), note: 'Monthly pay' } as Tx);
    // Expenses
    for(let d=1; d<=days; d++){
      const count = Math.random() < 0.2 ? 0 : (Math.random() < 0.5 ? 1 : 2);
      for(let i=0;i<count;i++){
        const cat = pickCategory(Math.random());
        const dt = new Date(ref.getFullYear(), ref.getMonth(), d, Math.floor(Math.random()*24), Math.floor(Math.random()*60), 0);
        await add({ id: Math.random().toString(36).slice(2), type: 'expense', amount: Number(randBetween(cat.min, cat.max).toFixed(2)), category: cat.name, date: dt.toISOString(), note: '' } as Tx);
      }
    }
  }
}

export async function clearAllData() {
  const { transactions, remove } = useTxStore.getState();
  for (const t of [...transactions]) { await remove(t.id); }
}
