// src/lib/notifications.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type Reminder = {
  key: string;              // groupId:billId:memberId
  notificationId?: string;  // native id if scheduled
  title: string;
  body: string;
  hour: number;             // local hour (0–23)
  groupId: string;
  billId: string;
  memberId: string;
  enabled: boolean;
  createdAt: number;
};

type NotifSettings = {
  enabled: boolean;   // global master switch
  hour: number;       // default hour (0-23)
};

const KEY = 'fingrow/notifications';
const KEY_SETTINGS = 'fingrow/notif-settings';

function getModule(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
}

export async function getSettings(): Promise<NotifSettings> {
  const raw = await AsyncStorage.getItem(KEY_SETTINGS);
  if (raw) return JSON.parse(raw);
  const def: NotifSettings = { enabled: false, hour: 19 };
  await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(def));
  return def;
}

export async function setSettings(next: Partial<NotifSettings>) {
  const cur = await getSettings();
  const out: NotifSettings = { ...cur, ...next };
  await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(out));
  return out;
}

export async function ensurePermissions(): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  try {
    const settings = await mod.getPermissionsAsync();
    let granted = !!(settings as any).granted;
    const iosStatus = (settings as any).ios?.status;
    const PROV = (mod as any).IosAuthorizationStatus?.PROVISIONAL;
    if (iosStatus && PROV && iosStatus === PROV) granted = true;

    if (!granted) {
      const req = await mod.requestPermissionsAsync();
      granted = !!(req as any).granted || ((req as any).ios?.status && PROV && (req as any).ios.status === PROV);
    }
    return !!granted;
  } catch (e) {
    return false;
  }
}

export async function listReminders(): Promise<Reminder[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function save(list: Reminder[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function cancel(key: string) {
  const list = await listReminders();
  const r = list.find(x => x.key === key);
  // Only touch the native module if we actually scheduled one
  if (r?.notificationId) {
    const mod = getModule();
    if (mod) {
      try {
        await mod.cancelScheduledNotificationAsync(r.notificationId);
      } catch (e) {
        // ignore
      }
    }
  }
  await save(list.filter(x => x.key !== key));
}

export async function scheduleDaily(
  key: string,
  title: string,
  body: string,
  hour: number,
  groupId: string,
  billId: string,
  memberId: string
) {
  const { enabled } = await getSettings();
  if (!enabled) throw new Error('Notifications are disabled in settings.');

  const mod = getModule();
  if (!mod) throw new Error('Notifications module missing. Run: npx expo install expo-notifications');

  const granted = await ensurePermissions();
  if (!granted) throw new Error('Notification permission not granted.');

  if (Platform.OS === 'android' && (mod as any).setNotificationChannelAsync) {
    try {
      await (mod as any).setNotificationChannelAsync('fingrow-reminders', {
        name: 'FinGrow Reminders',
        importance: (mod as any).AndroidImportance?.DEFAULT ?? 3,
      });
    } catch (e) {
      // ignore
    }
  }

  const trigger: any = { hour, minute: 0, repeats: true };
  const notificationId = await mod.scheduleNotificationAsync({ content: { title, body }, trigger });

  const list = await listReminders();
  const exists = list.find(r => r.key === key);
  const entry: Reminder = { key, notificationId, title, body, hour, groupId, billId, memberId, enabled: true, createdAt: Date.now() };
  const next = exists ? list.map(r => (r.key === key ? entry : r)) : [entry, ...list];
  await save(next);
  return entry;
}

export async function toggleEnabled(key: string, enable: boolean) {
  const list = await listReminders();
  const r = list.find(x => x.key === key);
  if (!r) return;

  if (!enable) {
    if (r.notificationId) {
      const mod = getModule();
      if (mod) {
        try {
          await mod.cancelScheduledNotificationAsync(r.notificationId);
        } catch (e) {
          // ignore
        }
      }
    }
    r.enabled = false;
    await save(list);
  } else {
    // Re-schedule with the same parameters
    await scheduleDaily(r.key, r.title, r.body, r.hour, r.groupId, r.billId, r.memberId);
  }
}

export async function selfTestOnce(delaySeconds = 10) {
  const { enabled } = await getSettings();
  if (!enabled) throw new Error('Enable notifications first in settings.');
  const mod = getModule();
  if (!mod) throw new Error('Notifications module missing.');
  const granted = await ensurePermissions();
  if (!granted) throw new Error('Permission not granted.');
  const trigger: any = { seconds: delaySeconds };
  await mod.scheduleNotificationAsync({
    content: { title: 'FinGrow Test', body: 'This is a one-time test notification.' },
    trigger
  });
}
