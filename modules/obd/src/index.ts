import { requireOptionalNativeModule } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';
export type OBDDevice = { id: string; name: string; rssi: number };
export type OBDLiveValue = { key: string; value: string; ts?: string };
type NativeBridge = {
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  getDevices(): Promise<OBDDevice[]>;
  connect(id: string): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getLiveValues(): Promise<OBDLiveValue[]>;
  readDTCs(): Promise<void>;
  getDTCs(): Promise<string[]>;
  readPendingDTCs(): Promise<void>;
  getPendingDTCs(): Promise<string[]>;
  readPermanentDTCs(): Promise<void>;
  getPermanentDTCs(): Promise<string[]>;
  clearDTCs(): Promise<void>;
  readVIN(): Promise<void>;
  getVIN(): Promise<string>;
};
const native = Platform.OS === 'web' ? null : requireOptionalNativeModule<NativeBridge>('Obd');
export const isOBDAvailable = native !== null;
function bridge(): NativeBridge {
  if (!native) throw new Error('OBD_NATIVE_UNAVAILABLE');
  return native;
}
// Unsupported environments reject explicitly; an empty fallback must never look like a clean scan.
export const obdNative: NativeBridge = {
  startScan: async () => bridge().startScan(),
  stopScan: async () => bridge().stopScan(),
  getDevices: async () => bridge().getDevices(),
  connect: async (id) => bridge().connect(id),
  disconnect: async () => bridge().disconnect(),
  isConnected: async () => bridge().isConnected(),
  getLiveValues: async () => bridge().getLiveValues(),
  readDTCs: async () => bridge().readDTCs(),
  getDTCs: async () => bridge().getDTCs(),
  readPendingDTCs: async () => bridge().readPendingDTCs(),
  getPendingDTCs: async () => bridge().getPendingDTCs(),
  readPermanentDTCs: async () => bridge().readPermanentDTCs(),
  getPermanentDTCs: async () => bridge().getPermanentDTCs(),
  clearDTCs: async () => bridge().clearDTCs(),
  readVIN: async () => bridge().readVIN(),
  getVIN: async () => bridge().getVIN(),
};
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (!isOBDAvailable) return false;
  if (Platform.OS !== 'android') return true;
  const permissions =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
}
