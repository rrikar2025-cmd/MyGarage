import type { FuelEntry, ServiceEntry, JournalEntry } from '../model/types';
import { localDate, addDays, daysBetween, shiftMonthsClamped } from './dates';
export type ReportMode = 'month' | 'year' | 'last30' | 'last12';
export type ReportPeriod = { mode: ReportMode; anchor: string };
export type DateRange = { from: string; to: string };
export function getReportRange(period: ReportPeriod, now = new Date()): DateRange {
  const today = localDate(now);
  if (period.mode === 'last30') return { from: addDays(today, -29), to: today };
  // Last 12 calendar months up to and including today, with leap-day clamping.
  if (period.mode === 'last12')
    return { from: addDays(shiftMonthsClamped(today, -12), 1), to: today };
  const year = period.anchor.slice(0, 4);
  const month = period.anchor.slice(0, 7);
  const from = period.mode === 'year' ? `${year}-01-01` : `${month}-01`;
  const next = period.mode === 'year' ? `${Number(year) + 1}-01-01` : shiftMonthsClamped(from, 1);
  return { from, to: [addDays(next, -1), today].sort()[0]! };
}
export function shiftReportPeriod(period: ReportPeriod, delta: number): ReportPeriod {
  return {
    ...period,
    anchor: shiftMonthsClamped(
      `${period.anchor.slice(0, 7)}-01`,
      delta * (period.mode === 'year' ? 12 : 1),
    ),
  };
}
export function entriesInRange(
  fuel: FuelEntry[],
  service: ServiceEntry[],
  vehicleId: string,
  range: DateRange,
): JournalEntry[] {
  const rows: JournalEntry[] = [
    ...fuel.map((data) => ({ kind: 'fuel' as const, data })),
    ...service.map((data) => ({ kind: 'service' as const, data })),
  ];
  return rows
    .filter(
      (x) =>
        x.data.vehicle_id === vehicleId &&
        x.data.currency === 'UAH' &&
        x.data.date >= range.from &&
        x.data.date <= range.to,
    )
    .sort(
      (a, b) =>
        a.data.date.localeCompare(b.data.date) ||
        a.data.created_at.localeCompare(b.data.created_at) ||
        a.data.id.localeCompare(b.data.id),
    );
}
export type ExpenseTotals = {
  fuel: number;
  service: number;
  total: number;
  liters: number;
  fuelCount: number;
  serviceCount: number;
  pricePerLiter: number | null;
};
export function sumExpenses(entries: JournalEntry[]): ExpenseTotals {
  let fuel = 0,
    service = 0,
    milliliters = 0,
    fuelCount = 0,
    serviceCount = 0;
  for (const row of entries) {
    if (row.kind === 'fuel') {
      fuel += Math.round(row.data.total * 100);
      milliliters += Math.round(row.data.liters * 1000);
      ++fuelCount;
    } else {
      service += Math.round(row.data.total * 100);
      ++serviceCount;
    }
  }
  const liters = milliliters / 1000;
  return {
    fuel: fuel / 100,
    service: service / 100,
    total: (fuel + service) / 100,
    liters,
    fuelCount,
    serviceCount,
    pricePerLiter: liters > 0 ? fuel / 100 / liters : null,
  };
}
export type ExpenseBucket = DateRange & {
  key: string;
  granularity: 'week' | 'month';
  total: number;
  fuel: number;
  service: number;
};
export function getExpenseBuckets(entries: JournalEntry[], range: DateRange): ExpenseBucket[] {
  const monthly = daysBetween(range.from, range.to) > 62;
  const buckets: ExpenseBucket[] = [];
  for (let from = range.from; from <= range.to;) {
    const next = monthly ? shiftMonthsClamped(`${from.slice(0, 7)}-01`, 1) : addDays(from, 7);
    const to = [addDays(next, -1), range.to].sort()[0]!;
    buckets.push({
      from,
      to,
      key: from,
      granularity: monthly ? 'month' : 'week',
      total: 0,
      fuel: 0,
      service: 0,
    });
    from = next;
  }
  // One pass through records; no rounding drift and no dependence on the visible journal page.
  const cents = buckets.map(() => ({ fuel: 0, service: 0 }));
  for (const row of entries) {
    const index = buckets.findIndex((b) => row.data.date >= b.from && row.data.date <= b.to);
    if (index >= 0) cents[index]![row.kind] += Math.round(row.data.total * 100);
  }
  return buckets.map((b, i) => ({
    ...b,
    fuel: cents[i]!.fuel / 100,
    service: cents[i]!.service / 100,
    total: (cents[i]!.fuel + cents[i]!.service) / 100,
  }));
}
