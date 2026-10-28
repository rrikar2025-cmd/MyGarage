import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { requireCloud, privateStorage } from '@/shared/api';
import { storage, createSerialQueue } from '@/shared/lib';
import { usePreferences } from '@/shared/model';
const KEY = 'mygarage.push-device.v1';
type Stored = { ownerId: string; token: string };
const run = createSerialQueue();
export class PushPermissionDeniedError extends Error {
  constructor() {
    super('Push notification permission was not granted');
    this.name = 'PushPermissionDeniedError';
  }
}
function projectId() {
  const id =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
  if (!id) throw new Error('EAS project ID is missing');
  return id;
}
function timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';
  } catch {
    return 'Europe/Kyiv';
  }
}
async function ownerGuard(ownerId: string) {
  const result = await requireCloud().auth.getSession();
  if (result.data.session?.user.id !== ownerId) throw new Error('Push session changed');
}
async function readStored(): Promise<Stored | null> {
  let raw = await privateStorage.getItem(KEY);
  if (!raw) {
    raw = await storage.getItem(KEY);
    if (raw) {
      await privateStorage.setItem(KEY, raw);
      await storage.removeItem(KEY);
    }
  }
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === 'object' &&
      'ownerId' in value &&
      typeof value.ownerId === 'string' &&
      'token' in value &&
      typeof value.token === 'string'
    )
      return { ownerId: value.ownerId, token: value.token };
  } catch {}
  await privateStorage.removeItem(KEY);
  return null;
}
async function expoToken(ask: boolean) {
  if (Platform.OS === 'web') throw new Error('Native device required');
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('service-reminders', {
      name: 'Service reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (ask && permission.status !== 'granted' && permission.canAskAgain)
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new PushPermissionDeniedError();
  return (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
}
async function register(ownerId: string, ask: boolean) {
  await ownerGuard(ownerId);
  const token = await expoToken(ask);
  await ownerGuard(ownerId);
  const result = await requireCloud().rpc('register_push_device', {
    p_token: token,
    p_timezone: timezone(),
    p_locale: usePreferences.getState().locale,
    p_platform: Platform.OS,
  });
  if (result.error) throw result.error;
  await ownerGuard(ownerId);
  await privateStorage.setItem(KEY, JSON.stringify({ ownerId, token }));
}
async function disable(ownerId: string) {
  const stored = await readStored();
  if (!stored || stored.ownerId !== ownerId) return;
  await ownerGuard(ownerId);
  const result = await requireCloud().rpc('set_push_device_enabled', {
    p_token: stored.token,
    p_enabled: false,
  });
  if (result.error) throw result.error;
  await privateStorage.removeItem(KEY);
}
async function synchronize(ownerId: string) {
  if (Platform.OS === 'web') return false;
  const stored = await readStored();
  if (!stored || stored.ownerId !== ownerId) return false;
  await ownerGuard(ownerId);
  if ((await Notifications.getPermissionsAsync()).status !== 'granted') {
    await disable(ownerId);
    return false;
  }
  const result = await requireCloud()
    .from('push_devices')
    .select('enabled')
    .eq('owner_id', ownerId)
    .eq('expo_push_token', stored.token)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data?.enabled) return false;
  await register(ownerId, false);
  return true;
}
export function enablePushDevice(ownerId: string) {
  return run(() => register(ownerId, true));
}
export function disablePushDevice(ownerId: string) {
  return run(() => disable(ownerId));
}
export function isPushDeviceEnabled(ownerId: string) {
  return run(() => synchronize(ownerId));
}
export function synchronizePushDevice(ownerId: string) {
  return run(() => synchronize(ownerId));
}
