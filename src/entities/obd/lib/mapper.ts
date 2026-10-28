import type { Metrics } from '../model/store';
const KEYS: Record<string, keyof Metrics> = {
  RPM: 'rpm',
  Speed: 'speed',
  Coolant: 'coolant',
  Battery: 'battery',
  ControlVoltage: 'battery',
  Fuel: 'fuel',
  EngineLoad: 'engineLoad',
  IntakeAir: 'intake',
  MAF: 'maf',
  MAP: 'map',
  OilTemp: 'oilTemp',
  Throttle: 'throttle',
  FuelRailPressure: 'fuelPressure',
  ShortFuelTrim: 'fuelTrim',
  FuelTrim: 'fuelTrim',
  TimingAdvance: 'timing',
  ShortFuelTrimB1: 'fuelTrim',
  LongFuelTrimB1: 'longFuelTrim',
  ShortFuelTrimB2: 'shortFuelTrimB2',
  LongFuelTrimB2: 'longFuelTrimB2',
  BaroPressure: 'baro',
  Ambient: 'ambient',
  PedalPosition: 'pedal',
};
/** Reuses DriveSpecX key mapping. Missing values remain absent, never a synthetic zero. */
export function mapLiveValues(values: { key: string; value: string }[]): Metrics {
  const result: Metrics = {};
  for (const { key, value } of values) {
    const target = KEYS[key];
    const number = parseFloat(value);
    if (target && Number.isFinite(number)) result[target] = number;
  }
  return result;
}
