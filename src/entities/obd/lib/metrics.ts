import type { MetricKey, Metrics, TelemetryUnits } from '@/shared/types';
import type { MessageKey } from '@/shared/i18n';
export const metricCatalog: Record<
  MetricKey,
  { label: MessageKey; unit: string; digits: number; kind?: 'speed' | 'temperature' | 'pressure' }
> = {
  rpm: { label: 'rpm', unit: 'rpm', digits: 0 },
  speed: { label: 'speed', unit: 'km/h', digits: 0, kind: 'speed' },
  coolant: { label: 'coolant', unit: '°C', digits: 0, kind: 'temperature' },
  battery: { label: 'battery', unit: 'V', digits: 1 },
  fuel: { label: 'metricFuel', unit: '%', digits: 1 },
  engineLoad: { label: 'metricLoad', unit: '%', digits: 1 },
  intake: { label: 'metricIntake', unit: '°C', digits: 0, kind: 'temperature' },
  maf: { label: 'metricMaf', unit: 'g/s', digits: 2 },
  map: { label: 'metricMap', unit: 'kPa', digits: 1, kind: 'pressure' },
  oilTemp: { label: 'metricOilTemp', unit: '°C', digits: 0, kind: 'temperature' },
  throttle: { label: 'metricThrottle', unit: '%', digits: 1 },
  fuelPressure: { label: 'metricFuelPressure', unit: 'kPa', digits: 1, kind: 'pressure' },
  fuelTrim: { label: 'metricShortTrimB1', unit: '%', digits: 1 },
  longFuelTrim: { label: 'metricLongTrimB1', unit: '%', digits: 1 },
  shortFuelTrimB2: { label: 'metricShortTrimB2', unit: '%', digits: 1 },
  longFuelTrimB2: { label: 'metricLongTrimB2', unit: '%', digits: 1 },
  timing: { label: 'metricTiming', unit: '°', digits: 1 },
  baro: { label: 'metricBaro', unit: 'kPa', digits: 1, kind: 'pressure' },
  ambient: { label: 'metricAmbient', unit: '°C', digits: 0, kind: 'temperature' },
  pedal: { label: 'metricPedal', unit: '%', digits: 1 },
};
export function displayMetric(key: MetricKey, raw: number | undefined, units: TelemetryUnits) {
  const descriptor = metricCatalog[key];
  const value = raw !== undefined && Number.isFinite(raw) ? raw : undefined;
  if (units === 'imperial') {
    if (descriptor.kind === 'speed')
      return { value: value === undefined ? undefined : value / 1.609344, unit: 'mph' };
    if (descriptor.kind === 'temperature')
      return { value: value === undefined ? undefined : (value * 9) / 5 + 32, unit: '°F' };
    if (descriptor.kind === 'pressure')
      return { value: value === undefined ? undefined : value * 0.1450377377, unit: 'psi' };
  }
  return { value, unit: descriptor.unit };
}
export type TelemetrySample = { at: string; metrics: Metrics };
export function appendSample(samples: TelemetrySample[], sample: TelemetrySample) {
  return [...samples.filter((entry) => entry.at !== sample.at), sample].slice(-30);
}

export function buildSparkline(values: (number | undefined)[]) {
  const finite = values.filter((n): n is number => n !== undefined && Number.isFinite(n));
  if (finite.length < 2) return '';
  const min = Math.min(...finite),
    max = Math.max(...finite),
    span = max - min || 1;
  let path = '',
    gap = true;
  values.forEach((value, index) => {
    if (value === undefined || !Number.isFinite(value)) {
      gap = true;
      return;
    }
    const x = 4 + (index / Math.max(1, values.length - 1)) * 272;
    const y = max === min ? 30 : 56 - ((value - min) / span) * 52;
    path += `${gap ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)} `;
    gap = false;
  });
  return path.trim();
}
