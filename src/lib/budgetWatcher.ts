
import { useTxStore } from '../store/transactions';
import { useBudgetsStore } from '../store/budgets';
import * as Notifications from 'expo-notifications';

/**
 * Call once (e.g., in App) to hydrate budgets and subscribe.
 */
export async function setupBudgetWatcher() {
  try {
    await Notifications.requestPermissionsAsync();
  } catch {}
  try {
    await useBudgetsStore.getState().hydrate();
  } catch {}

  // initial check
  checkAndNotify();

  // subscribe to future changes
  useTxStore.subscribe(
    () => checkAndNotify()
  );
}

function nowYM() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}

async function checkAndNotify() {
  const { y, m } = nowYM();
  const txs = useTxStore.getState().transactions;
  const budgetState = useBudgetsStore.getState() as any;
  const budgets = budgetState.budgets || {};
  if (!budgets || Object.keys(budgets).length === 0) return;

  // Simple budget check without getBudgetStatus
  for (const [category, budget] of Object.entries(budgets) as any) {
    const spent = txs
      .filter((t: any) => t.type === 'expense' && t.category === category)
      .reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);

    const limit = budget.limit || 0;
    if (limit <= 0) continue;

    const ratio = spent / limit;

    if (ratio >= 1) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Budget exceeded: ${category}`,
          body: `You've spent ${fmtCurrency(spent)} of ${fmtCurrency(limit)} this month.`,
        },
        trigger: null,
      });
    } else if (ratio >= 0.8) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `You're close on ${category}`,
          body: `At ${(ratio * 100).toFixed(0)}% of your ${fmtCurrency(limit)} budget.`,
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
