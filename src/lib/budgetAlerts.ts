import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

type BudgetSnapshot = {
  periodKey: string;
  budget: number;
  spent: number;
  expectedByToday: number;
  paceDelta: number;
  usedRatio: number;
};

const KEY_BASE = 'fingrow/budget/alerts';

function notchFromRatio(r: number): number {
  if (!isFinite(r) || r < 0) return 0;
  if (r >= 1.1) return 110;
  if (r >= 1.0) return 100;
  if (r >= 0.8) return 80;
  return 0;
}

export async function maybeFireThresholdAlerts(s: BudgetSnapshot, enabled: boolean = true) {
  if (!enabled) return;
  if (!s.budget || s.budget <= 0) return;

  const notch = notchFromRatio(s.usedRatio);
  const key = `${KEY_BASE}/threshold/${s.periodKey}`;
  const prevRaw = await AsyncStorage.getItem(key);
  const prev = prevRaw ? JSON.parse(prevRaw) : { last: 0 };

  if (notch > prev.last) {
    let title = 'Budget update';
    let body = '';
    if (notch === 80) { title = '80% of budget used'; body = 'You have reached 80% of your budget for this period.'; }
    else if (notch === 100) { title = "Budget reached"; body = "You've fully used your budget for this period."; }
    else if (notch === 110) { title = 'Over budget'; body = 'You are 10% over budget. Consider slowing down spend.'; }

    if (body) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: null, priority: Notifications.AndroidNotificationPriority.DEFAULT },
          trigger: null,
        });
      } catch {}
    }
    await AsyncStorage.setItem(key, JSON.stringify({ last: notch }));
  }
}

export async function maybeFirePaceAlert(s: BudgetSnapshot, enabled: boolean = true) {
  if (!enabled) return;
  if (!s.budget || s.budget <= 0) return;
  const amountThreshold = Math.max(50, s.budget * 0.10);
  const ahead = s.paceDelta; // positive = ahead
  if (ahead <= amountThreshold) return;

  const key = `${KEY_BASE}/pace/${s.periodKey}`;
  const prevRaw = await AsyncStorage.getItem(key);
  const prev = prevRaw ? JSON.parse(prevRaw) : { lastAt: 0 };
  const now = Date.now();
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  if (now - (prev.lastAt || 0) < THREE_DAYS) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'You are ahead of pace', body: `Spent about ${formatMoney(ahead)} more than expected by today.` },
      trigger: null,
    });
  } catch {}

  await AsyncStorage.setItem(key, JSON.stringify({ lastAt: now }));
}

type DigestInfo = { id?: string };
const DIGEST_KEY = `${KEY_BASE}/digest/info`;

export async function toggleWeeklyDigest(enabled: boolean) {
  try {
    const raw = await AsyncStorage.getItem(DIGEST_KEY);
    const info: DigestInfo = raw ? JSON.parse(raw) : {};
    if (!enabled) {
      if (info.id) {
        try { await Notifications.cancelScheduledNotificationAsync(info.id); } catch {}
      }
      await AsyncStorage.removeItem(DIGEST_KEY);
      return;
    }
    if (info.id) return; // already scheduled
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'FinGrow weekly budget digest', body: 'Check your remaining, pace, and projection for the new week.' },
      trigger: { weekday: 1, hour: 9, minute: 0, repeats: true } as any
    });
    await AsyncStorage.setItem(DIGEST_KEY, JSON.stringify({ id }));
  } catch {}
}

export async function ensureWeeklyDigest(enabled: boolean = true) {
  return toggleWeeklyDigest(enabled);
}

function formatMoney(n: number) {
  try { return new Intl.NumberFormat(undefined, { style:'currency', currency:'SGD', maximumFractionDigits:0 }).format(n); }
  catch { return `S$${n.toFixed(0)}`; }
}