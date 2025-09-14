
import { useTxStore } from '../store/transactions';
import { useBudgetsStore, getBudgetStatus } from '../store/budgets';
import { initNotifications } from './notifications';
import * as Notifications from 'expo-notifications';

/**
 * Call once (e.g., in App) to hydrate budgets and subscribe.
 */
export async function setupBudgetWatcher() {
  try {
    await initNotifications();
  } catch {}
  try {
    await useBudgetsStore.getState().hydrate();
  } catch {}

  // initial check
  checkAndNotify();

  // subscribe to future changes
  useTxStore.subscribe(
    (state) => state.transactions,
    () => checkAndNotify(),
    { equalityFn: (a, b) => a.length === b.length } as any
  );
}

function nowYM() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}

async function checkAndNotify() {
  const { y, m } = nowYM();
  const txs = useTxStore.getState().transactions;
  const budgets = useBudgetsStore.getState().budgets;
  if (!budgets || Object.keys(budgets).length === 0) return;

  const statuses = getBudgetStatus(txs, budgets, y, m);
  for (const s of statuses) {
    if (s.limit <= 0) continue;

    if (s.ratio >= 1) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Budget exceeded: ${s.category}`,
          body: `You've spent ${fmtCurrency(s.spent)} of ${fmtCurrency(s.limit)} this month.`,
        },
        trigger: null,
      });
    } else if (s.ratio >= s.warnAt) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `You're close on ${s.category}`,
          body: `At ${(s.ratio * 100).toFixed(0)}% of your ${fmtCurrency(s.limit)} budget.`,
        },
        trigger: null,
      });
    }
  }
}

function fmtCurrency(v: number) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(v); }
  catch { return `S$${v.toFixed(0)}`; }
}
