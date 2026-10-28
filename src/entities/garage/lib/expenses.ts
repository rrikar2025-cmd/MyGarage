import { getServiceSchedule } from './service-schedule';
import type { FuelEntry, ServiceEntry } from '../model/types';
export function getExpenses(
  fuel: FuelEntry[],
  service: ServiceEntry[],
  vehicleId: string,
  period: 'month' | 'year',
  now = new Date(),
) {
  const prefix =
    period === 'year'
      ? String(now.getFullYear())
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const matches = (entry: FuelEntry | ServiceEntry) =>
    entry.vehicle_id === vehicleId && entry.date.startsWith(prefix) && entry.currency === 'UAH';
  // Integer kopecks avoid cumulative floating-point errors in financial summaries.
  const sum = (entries: (FuelEntry | ServiceEntry)[]) =>
    entries.filter(matches).reduce((n, x) => n + Math.round(x.total * 100), 0) / 100;
  const fuelTotal = sum(fuel),
    serviceTotal = sum(service);
  return {
    fuel: fuelTotal,
    service: serviceTotal,
    total: Math.round((fuelTotal + serviceTotal) * 100) / 100,
  };
}
/** @deprecated Use getServiceSchedule for date and mileage reminders. */
export function getNextService(entries: ServiceEntry[], vehicleId: string) {
  return getServiceSchedule(entries, vehicleId, 0)
    .map((reminder) => reminder.entry)
    .filter((entry) => entry.next_odometer !== null)
    .sort((a, b) => a.next_odometer! - b.next_odometer!)[0];
}
