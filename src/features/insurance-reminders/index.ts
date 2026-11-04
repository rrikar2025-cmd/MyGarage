import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { storage, createSerialQueue } from '@/shared/lib';
import { readInsurance, type InsurancePolicy } from '@/entities/insurance';
import { useSession } from '@/entities/session';
import { reminderDates } from './model/reminder-dates';

type Locale = 'uk' | 'en';
const run = createSerialQueue();
const key = (owner: string | null, id: string) =>
  `mygarage.insurance-reminders.v1:${owner ?? 'guest'}:${id}`;
const identifier = (owner: string | null, id: string, offset: number) =>
  `insurance:${owner ?? 'guest'}:${id}:${offset}`;
function checkOwner(owner: string | null) {
  if ((useSession.getState().session?.user.id ?? null) !== owner)
    throw new Error('session changed');
}

export async function insuranceReminderEnabled(owner: string | null, id: string): Promise<boolean> {
  if (Platform.OS === 'web' || !(await storage.getItem(key(owner, id)))) return false;
  if ((await Notifications.getPermissionsAsync()).status !== 'granted') return false;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((item) =>
    [0, 1].some((index) => item.identifier === identifier(owner, id, index)),
  );
}

async function cancel(owner: string | null, id: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await Promise.all(
      [0, 1].map((i) => Notifications.cancelScheduledNotificationAsync(identifier(owner, id, i))),
    );
  }
  await storage.removeItem(key(owner, id));
}
export function cancelInsuranceReminders(owner: string | null, id: string): Promise<void> {
  return run(() => cancel(owner, id));
}

async function schedule(
  owner: string | null,
  policy: InsurancePolicy,
  locale: Locale,
  askPermission: boolean,
): Promise<void> {
  if (Platform.OS === 'web') throw new Error('native required');
  checkOwner(owner);
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('insurance-reminders', {
      name: 'Insurance reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (askPermission && permission.status !== 'granted' && permission.canAskAgain)
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('permission denied');
  checkOwner(owner);
  const dates = reminderDates(policy.expires_on);
  if (!dates.length) throw new Error('policy expired');
  await Promise.all(
    [0, 1].map((i) =>
      Notifications.cancelScheduledNotificationAsync(identifier(owner, policy.vehicle_id, i)),
    ),
  );
  try {
    for (const [index, date] of dates.entries()) {
      checkOwner(owner);
      await Notifications.scheduleNotificationAsync({
        identifier: identifier(owner, policy.vehicle_id, index),
        content: {
          title: locale === 'uk' ? 'Нагадування про страхування' : 'Insurance reminder',
          body:
            locale === 'uk'
              ? 'Перевірте строк дії страхового поліса у своєму гаражі.'
              : 'Check the expiry date of your vehicle insurance in your garage.',
          data: {
            type: 'insurance-reminder',
            vehicleId: policy.vehicle_id,
            owner: owner ?? 'guest',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: 'insurance-reminders',
        },
      });
      checkOwner(owner);
    }
    await storage.setItem(
      key(owner, policy.vehicle_id),
      JSON.stringify({ expiresOn: policy.expires_on, locale }),
    );
    checkOwner(owner);
  } catch (error) {
    await cancel(owner, policy.vehicle_id).catch(() => {});
    throw error;
  }
}
export function scheduleInsuranceReminders(
  owner: string | null,
  policy: InsurancePolicy,
  locale: Locale,
  askPermission: boolean,
): Promise<void> {
  return run(() => schedule(owner, policy, locale, askPermission));
}

async function cancelOwner(owner: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const prefix = `insurance:${owner}:`;
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith(prefix))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
  const keys = await storage.getAllKeys();
  const saved = keys.filter((item) => item.startsWith(`mygarage.insurance-reminders.v1:${owner}:`));
  if (saved.length) await storage.multiRemove(saved);
}
export function cancelOwnerInsuranceReminders(owner: string): Promise<void> {
  return run(() => cancelOwner(owner));
}

/** Refresh changed/deleted policies on this device when its garage is opened. */
export async function reconcileInsuranceReminders(
  owner: string | null,
  vehicleIds: string[],
  locale: Locale,
): Promise<void> {
  if (Platform.OS === 'web') return;
  const prefix = `mygarage.insurance-reminders.v1:${owner ?? 'guest'}:`;
  const keys = (await storage.getAllKeys()).filter((item) => item.startsWith(prefix));
  for (const item of keys) {
    const vehicleId = item.slice(prefix.length);
    try {
      await run(async () => {
        checkOwner(owner);
        if (!(await storage.getItem(item))) return;
        if (!vehicleIds.includes(vehicleId)) {
          await cancel(owner, vehicleId);
          return;
        }
        const policy = await readInsurance(owner, vehicleId);
        checkOwner(owner);
        if (!policy) {
          await cancel(owner, vehicleId);
          return;
        }
        const raw = await storage.getItem(item);
        let saved: { expiresOn?: string; locale?: string } = {};
        try {
          saved = JSON.parse(raw ?? '{}');
        } catch {}
        if (saved.expiresOn !== policy.expires_on || saved.locale !== locale) {
          if (reminderDates(policy.expires_on).length) await schedule(owner, policy, locale, false);
          else await cancel(owner, vehicleId);
        }
      });
    } catch {
      /* Offline or session changed: keep existing schedules and retry later. */
    }
  }
}
