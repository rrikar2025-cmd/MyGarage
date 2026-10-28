import { AppState } from 'react-native';
import { isOBDAvailable, obdNative, requestBluetoothPermissions, type OBDDevice } from 'obd';
import { createSerialQueue } from '@/shared/lib';
import type { ScanMode } from '@/shared/types';
import { executeDiagnosticRead } from './read-scan';
import { normalizeVin } from '../lib/codes';
import { useOBD, resetOBD, publishTelemetry } from '../model/store';
import { mapLiveValues } from '../lib/mapper';
const serial = createSerialQueue();
export { isOBDAvailable, type OBDDevice };
let connectionEpoch = 0;
export async function searchAdapters() {
  if (!(await requestBluetoothPermissions())) throw new Error('BLUETOOTH_PERMISSION');
  await obdNative.startScan();
}
export const getAdapters = () => obdNative.getDevices();
export const stopAdapterSearch = () => (isOBDAvailable ? obdNative.stopScan() : Promise.resolve());
export async function connectAdapter(device: OBDDevice) {
  if (useOBD.getState().reading || useOBD.getState().status === 'connecting')
    throw new Error('OBD_BUSY');
  const epoch = ++connectionEpoch;
  useOBD.setState({
    status: 'connecting',
    deviceName: null,
    metrics: {},
    samples: [],
    updatedAt: null,
    error: false,
  });
  try {
    await stopAdapterSearch();
    const connected = await serial(() => obdNative.connect(device.id));
    if (epoch !== connectionEpoch) return;
    if (!connected) throw new Error('NOT_CONNECTED');
    useOBD.setState({ status: 'connected', deviceName: device.name, error: false });
  } catch (error) {
    if (epoch === connectionEpoch) resetOBD();
    throw error;
  }
}
export async function disconnectAdapter() {
  ++connectionEpoch;
  resetOBD();
  // Interrupt an in-flight native operation instead of waiting behind a whole PID polling cycle.
  if (isOBDAvailable) await obdNative.disconnect();
}
async function withOperation<T>(
  action: (assertActive: () => Promise<void>) => Promise<T>,
): Promise<T> {
  if (useOBD.getState().reading) throw new Error('OBD_BUSY');
  const epoch = connectionEpoch;
  useOBD.setState({ reading: true });
  async function assertActive() {
    if (
      epoch !== connectionEpoch ||
      useOBD.getState().status !== 'connected' ||
      !(await obdNative.isConnected())
    )
      throw new Error('CONNECTION_CHANGED');
  }
  try {
    return await serial(async () => {
      await assertActive();
      return action(assertActive);
    });
  } finally {
    if (epoch === connectionEpoch) useOBD.setState({ reading: false });
  }
}
export function readFaultCodes(mode: ScanMode = 'all', includeVin = true) {
  return withOperation(async (assertActive) => {
    const result = await executeDiagnosticRead(
      obdNative,
      mode,
      includeVin,
      assertActive,
      async () => {
        const metrics = mapLiveValues(await obdNative.getLiveValues());
        await assertActive();
        publishTelemetry(metrics);
        return metrics;
      },
    );
    result.context.device_name = useOBD.getState().deviceName ?? undefined;
    return result;
  });
}
export function readVehicleVin() {
  return withOperation(async (assertActive) => {
    await obdNative.readVIN();
    await assertActive();
    const vin = normalizeVin(await obdNative.getVIN());
    if (!vin) throw new Error('VIN_UNAVAILABLE');
    return vin;
  });
}
export function clearVehicleCodes() {
  if (useOBD.getState().scanPending) return Promise.reject(new Error('UNSAVED_SCAN'));
  return withOperation(async (assertActive) => {
    // The native bridge re-reads engine RPM/speed and requires zero, then positive Mode 04 ACK.
    await obdNative.clearDTCs();
    await assertActive();
  });
}
/** One self-scheduling loop, foreground only, with no concurrent native command streams. */
export function startTelemetry() {
  if (!isOBDAvailable) return () => {};
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    if (stopped) return;
    const epoch = connectionEpoch;
    if (
      AppState.currentState === 'active' &&
      useOBD.getState().status === 'connected' &&
      !useOBD.getState().reading
    ) {
      try {
        await serial(async () => {
          if (stopped || epoch !== connectionEpoch || useOBD.getState().reading) return;
          if (!(await obdNative.isConnected())) throw new Error('DISCONNECTED');
          const metrics = mapLiveValues(await obdNative.getLiveValues());
          if (!stopped && epoch === connectionEpoch) publishTelemetry(metrics);
        });
      } catch {
        if (!stopped && epoch === connectionEpoch)
          useOBD.setState({ status: 'disconnected', error: true });
      }
    }
    if (!stopped) timer = setTimeout(poll, 1500);
  };
  void poll();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
