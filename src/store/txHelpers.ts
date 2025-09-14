
import { Transaction, TxType } from './transactions';

export type TxFilters = {
  type?: TxType;
  category?: string;
  from?: Date;
  to?: Date;
  min?: number;
  max?: number;
  text?: string;
};

export function filterTransactions(list: Transaction[], f: TxFilters): Transaction[] {
  return list.filter(t => {
    if (f.type && t.type !== f.type) return false;
    if (f.category && t.category !== f.category) return false;
    const d = new Date(t.date);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    const amt = Math.abs(t.amount);
    if (typeof f.min === 'number' && amt < f.min) return false;
    if (typeof f.max === 'number' && amt > f.max) return false;
    if (f.text) {
      const needle = f.text.toLowerCase();
      if (!((t.note||'').toLowerCase().includes(needle) || t.category.toLowerCase().includes(needle))) return false;
    }
    return true;
  });
}

export function groupByCategory(list: Transaction[]) {
  const map: Record<string, { expense: number; income: number; count: number }> = {};
  for (const t of list) {
    const m = map[t.category] || { expense: 0, income: 0, count: 0 };
    if (t.type === 'expense') m.expense += Math.abs(t.amount); else m.income += t.amount;
    m.count += 1;
    map[t.category] = m;
  }
  return map;
}

export function transactionsToCSV(list: Transaction[]) {
  const header = ['id','type','amount','category','date','note'].join(',');
  const rows = list.map(t => [
    t.id, t.type, (t.type==='expense' ? -Math.abs(t.amount) : Math.abs(t.amount)).toFixed(2), 
    escapeCsv(t.category), t.date, escapeCsv(t.note || '')
  ].join(','));
  return [header, ...rows].join('\n');
}

function escapeCsv(v: string) {
  if (v.includes(',') || v.includes('\n') || v.includes('"')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}
