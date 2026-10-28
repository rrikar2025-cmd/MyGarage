export const metricKeys = [
  'rpm',
  'speed',
  'coolant',
  'battery',
  'fuel',
  'engineLoad',
  'intake',
  'maf',
  'map',
  'oilTemp',
  'throttle',
  'fuelPressure',
  'fuelTrim',
  'longFuelTrim',
  'shortFuelTrimB2',
  'longFuelTrimB2',
  'timing',
  'baro',
  'ambient',
  'pedal',
] as const;
export type MetricKey = (typeof metricKeys)[number];
export type TelemetryUnits = 'metric' | 'imperial';
export type Metrics = Partial<Record<MetricKey, number>>;
export type ScanMode = 'confirmed' | 'all';
export type ReadStatus = 'read' | 'unavailable' | 'not_requested';
export type ScanContext = {
  mode?: ScanMode;
  duration_ms?: number;
  device_name?: string;
  vin?: string;
  vin_status?: ReadStatus;
  statuses?: Partial<Record<'stored' | 'pending' | 'permanent', ReadStatus>>;
  telemetry_at?: string | null;
};
export const defaultDashboardMetrics: MetricKey[] = ['rpm', 'speed', 'coolant', 'battery'];
export function normalizeMetricSelection(value: unknown): MetricKey[] {
  if (!Array.isArray(value)) return [...defaultDashboardMetrics];
  const valid = [
    ...new Set(value.filter((key): key is MetricKey => metricKeys.includes(key as MetricKey))),
  ].slice(0, 8);
  return valid.length ? valid : [...defaultDashboardMetrics];
}
