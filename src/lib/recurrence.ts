export type RecurringType = 'monthly' | 'biweekly' | 'weekly';
export type Tx = { id: string; type: 'expense'|'income'; amount: number; category: string; date: string; note?: string };

type Series = {
  key: string;
  label: string;
  category: string;
  type: RecurringType;
  avgAmount: number;
  lastDate: Date;
  intervalDays: number;
};

type ForecastItem = { key: string; label: string; category: string; amount: number; due: Date };

const DAY = 24*60*60*1000;

function normLabel(t: Tx) {
  const note = (t.note || '').toLowerCase().trim();
  // Simplify: remove numbers and extra spaces
  const simplified = note.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  if (simplified) return simplified;
  // Fallback to category-only
  return t.category.toLowerCase();
}

function approxEqual(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol;
}

function inferType(gaps: number[]): {type: RecurringType|null, intervalDays: number} {
  if (!gaps.length) return { type: null, intervalDays: 0 };
  const med = gaps.sort((x,y)=>x-y)[Math.floor(gaps.length/2)];
  if (approxEqual(med, 30, 3) || approxEqual(med, 31, 3) || approxEqual(med, 29, 3) || approxEqual(med, 28, 3)) return { type:'monthly', intervalDays: med };
  if (approxEqual(med, 14, 2)) return { type:'biweekly', intervalDays: med };
  if (approxEqual(med, 7, 1)) return { type:'weekly', intervalDays: med };
  return { type: null, intervalDays: med };
}

export function detectRecurring(tx: Tx[], today = new Date()): Series[] {
  const expenses = tx.filter(t => t.type === 'expense' && isFinite(Number(t.amount)) && Number(t.amount) > 0);
  const byKey: Record<string, Tx[]> = {};
  expenses.forEach(t => {
    const key = `${t.category.toLowerCase()}|${normLabel(t)}`;
    byKey[key] = byKey[key] || [];
    byKey[key].push(t);
  });
  const series: Series[] = [];
  for (const [key, list] of Object.entries(byKey)) {
    if (list.length < 3) continue;
    const sorted = list.slice().sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime());
    const gaps: number[] = [];
    for (let i=1;i<sorted.length;i++) {
      gaps.push(Math.round((new Date(sorted[i].date).getTime() - new Date(sorted[i-1].date).getTime())/DAY));
    }
    const { type, intervalDays } = inferType(gaps);
    if (!type) continue;
    const amounts = sorted.map(t=> Number(t.amount)||0);
    const avg = amounts.reduce((s,n)=>s+n,0)/amounts.length;
    const last = new Date(sorted[sorted.length-1].date);
    const label = key.split('|')[1] || key.split('|')[0];
    series.push({ key, label, category: sorted[0].category, type, avgAmount: avg, lastDate: last, intervalDays });
  }
  return series;
}

export function forecastUpcoming(series: Series[], windowStart: Date, windowEnd: Date, today = new Date()): ForecastItem[] {
  const items: ForecastItem[] = [];
  for (const s of series) {
    let due = new Date(s.lastDate);
    // step forward until we pass today
    while (due <= today) {
      if (s.type === 'monthly') {
        const d = new Date(due.getFullYear(), due.getMonth()+1, due.getDate());
        due = d;
      } else {
        due = new Date(due.getTime() + s.intervalDays*DAY);
      }
    }
    // collect all occurrences within window
    while (due >= windowStart && due <= windowEnd) {
      items.push({ key: s.key + '@' + due.toISOString().slice(0,10), label: s.label, category: s.category, amount: Math.round(s.avgAmount), due: new Date(due) });
      if (s.type === 'monthly') {
        due = new Date(due.getFullYear(), due.getMonth()+1, due.getDate());
      } else {
        due = new Date(due.getTime() + s.intervalDays*DAY);
      }
    }
  }
  // sort by due date
  items.sort((a,b)=> a.due.getTime() - b.due.getTime());
  return items;
}