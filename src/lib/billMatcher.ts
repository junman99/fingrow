import { useRecurringStore, Recurring, Freq, computeNextDue } from '../store/recurring';

const DAY = 24*60*60*1000;

function normalize(s: string) {
  return (s || '').toLowerCase().replace(/\d+/g,'').replace(/[^a-z]+/g,' ').replace(/\s+/g,' ').trim();
}

function lastDayOfMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate(); }
function incrementFromAnchor(d: Date, freq: Freq, anchorISO: string): Date {
  if (freq === 'weekly') return new Date(d.getTime() + 7*DAY);
  if (freq === 'biweekly') return new Date(d.getTime() + 14*DAY);
  const anchor = new Date(anchorISO);
  const day = anchor.getDate();
  const y = d.getFullYear(), m = d.getMonth();
  const targetDay = Math.min(day, lastDayOfMonth(y, m+1));
  return new Date(y, m+1, targetDay);
}

export async function autoMatchTx(tx: { amount: number; category?: string; note?: string; dateISO?: string; }) {
  try {
    const date = tx.dateISO ? new Date(tx.dateISO) : new Date();
    const noteN = normalize(tx.note || '');
    const catN = normalize(tx.category || '');
    const store = useRecurringStore.getState();
    const items = (store.items || []).filter(it => it.active !== false && (it.autoMatch !== false));
    const tolAmt = (n: number) => Math.max(2, Math.round(0.05 * (n || 0))); // ±5% or $2

    for (const it of items) {
      const due = computeNextDue(it, date);
      if (!due) continue;
      const delta = Math.abs(due.getTime() - date.getTime());
      if (delta > 3*DAY) continue; // only ±3 days
      const labN = normalize(it.label || it.category);
      const labelHit = (!!noteN && (noteN.includes(labN) || labN.includes(noteN))) || (!!catN && catN.includes(labN));
      const amountHit = Math.abs((Number(tx.amount)||0) - (Number(it.amount)||0)) <= tolAmt(Number(it.amount)||0);
      if (labelHit && amountHit) {
        const next = incrementFromAnchor(due, it.freq, it.anchorISO);
        await store.update(it.id, { anchorISO: next.toISOString() });
        return { matched: true, billId: it.id, label: it.label || it.category, oldDue: due, newDue: next };
      }
    }
    return { matched: false };
  } catch (e) {
    return { matched: false };
  }
}