import type { ServiceEntry } from '../model/types';
import { localDate, daysBetween } from './dates';
export type ServiceReminder = {
  entry: ServiceEntry;
  status: 'overdue' | 'soon' | 'upcoming';
  remainingKm: number | null;
  remainingDays: number | null;
};
export function getServiceSchedule(
  entries: ServiceEntry[],
  vehicleId: string,
  mileage: number,
  now = new Date(),
): ServiceReminder[] {
  const today = localDate(now);
  const latest = new Map<string, ServiceEntry>();
  const sorted = entries
    .filter((x) => x.vehicle_id === vehicleId)
    .slice()
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.odometer - a.odometer ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    );
  for (const row of sorted) {
    const key =
      row.category === 'other'
        ? `other:${row.title.trim().toLowerCase().replace(/\s+/g, ' ')}`
        : row.category;
    if (!latest.has(key)) latest.set(key, row);
  }
  const reminders: ServiceReminder[] = [];
  for (const entry of latest.values()) {
    if (entry.next_odometer === null && !entry.next_date) continue;
    const remainingKm = entry.next_odometer === null ? null : entry.next_odometer - mileage;
    const remainingDays = entry.next_date ? daysBetween(today, entry.next_date) : null;
    const status =
      (remainingKm !== null && remainingKm <= 0) || (remainingDays !== null && remainingDays <= 0)
        ? 'overdue'
        : (remainingKm !== null && remainingKm <= 500) ||
            (remainingDays !== null && remainingDays <= 30)
          ? 'soon'
          : 'upcoming';
    reminders.push({ entry, status, remainingKm, remainingDays });
  }
  const order = { overdue: 0, soon: 1, upcoming: 2 };
  return reminders.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (a.remainingDays ?? Infinity) - (b.remainingDays ?? Infinity) ||
      (a.remainingKm ?? Infinity) - (b.remainingKm ?? Infinity) ||
      a.entry.title.localeCompare(b.entry.title),
  );
}
