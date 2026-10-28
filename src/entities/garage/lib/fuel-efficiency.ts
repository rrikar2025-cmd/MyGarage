import type { FuelEntry, FuelType } from '../model/types';
import type { DateRange } from './reports';
export type FuelCycle = {
  startId: string;
  endId: string;
  from: string;
  to: string;
  fuelType: FuelType;
  distance: number;
  liters: number;
  litersPer100: number;
};
/** A baseline fill is excluded. Every partial fill after it and the closing full fill is included. */
export function getFuelCycles(entries: FuelEntry[], vehicleId: string): FuelCycle[] {
  const rows = entries
    .filter((x) => x.vehicle_id === vehicleId)
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.odometer - b.odometer ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  const cycles: FuelCycle[] = [];
  let baseline: FuelEntry | null = null;
  let lastOdometer = -1;
  let milliliters = 0;
  for (const row of rows) {
    if (
      !Number.isFinite(row.liters) ||
      row.liters <= 0 ||
      !Number.isInteger(row.odometer) ||
      row.odometer < 0
    ) {
      baseline = null;
      milliliters = 0;
      continue;
    }
    if (
      !row.fuel_type ||
      row.fuel_type === 'other' ||
      !Number.isFinite(row.liters) ||
      row.liters <= 0 ||
      row.odometer < lastOdometer ||
      (baseline && row.fuel_type !== baseline.fuel_type)
    ) {
      baseline = null;
      milliliters = 0;
    }
    lastOdometer = row.odometer;
    if (!row.fuel_type || row.fuel_type === 'other') continue;
    if (!baseline) {
      if (row.full_tank) baseline = row;
      continue;
    }
    milliliters += Math.round(row.liters * 1000);
    if (!row.full_tank) continue;
    const distance = row.odometer - baseline.odometer;
    if (distance > 0 && milliliters > 0) {
      const liters = milliliters / 1000;
      cycles.push({
        startId: baseline.id,
        endId: row.id,
        from: baseline.date,
        to: row.date,
        fuelType: row.fuel_type,
        distance,
        liters,
        litersPer100: (liters / distance) * 100,
      });
    }
    baseline = row;
    milliliters = 0;
  }
  return cycles;
}
export function summarizeFuelEfficiency(cycles: FuelCycle[], range: DateRange) {
  const groups = new Map<
    FuelType,
    { fuelType: FuelType; distance: number; liters: number; count: number; litersPer100: number }
  >();
  for (const cycle of cycles) {
    if (cycle.to < range.from || cycle.to > range.to) continue;
    const group = groups.get(cycle.fuelType) ?? {
      fuelType: cycle.fuelType,
      distance: 0,
      liters: 0,
      count: 0,
      litersPer100: 0,
    };
    group.distance += cycle.distance;
    group.liters += cycle.liters;
    group.count += 1;
    group.litersPer100 = (group.liters / group.distance) * 100;
    groups.set(cycle.fuelType, group);
  }
  return [...groups.values()];
}
