export { useOBD } from './model/store';
export type { Metrics } from './model/store';
export { mapLiveValues } from './lib/mapper';
export {
  isOBDAvailable,
  searchAdapters,
  getAdapters,
  stopAdapterSearch,
  connectAdapter,
  disconnectAdapter,
  readFaultCodes,
  readVehicleVin,
  clearVehicleCodes,
  startTelemetry,
} from './api/controller';
export type { OBDDevice } from './api/controller';

export { metricCatalog, displayMetric } from './lib/metrics';
export { describeDtc, normalizeVin, vinMismatch } from './lib/codes';
export { CodeGroup } from './ui/CodeGroup';
export { MetricGrid } from './ui/MetricGrid';
export { MetricTrend } from './ui/MetricTrend';
export { describeConnectionFailure } from './lib/connection-failure';
export { isLikelyOBDName, bleDeviceName } from './lib/device-discovery';
