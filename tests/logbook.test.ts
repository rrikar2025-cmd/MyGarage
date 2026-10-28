import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getReportRange,
  entriesInRange,
  sumExpenses,
  getExpenseBuckets,
  shiftReportPeriod,
} from '../src/entities/garage/lib/reports';
import { getFuelCycles, summarizeFuelEfficiency } from '../src/entities/garage/lib/fuel-efficiency';
import { getServiceSchedule } from '../src/entities/garage/lib/service-schedule';
import { buildJournalCsv, type CsvLabels } from '../src/entities/garage/lib/csv';
import { validateJournal } from '../src/entities/garage/lib/journal-validation';
import type { FuelEntry, ServiceEntry, Vehicle } from '../src/entities/garage/model/types';
const now = new Date(2026, 9, 28, 23, 30);
const fuel = (
  id: string,
  odometer: number,
  liters: number,
  full = false,
  date = '2026-10-01',
): FuelEntry => ({
  id,
  vehicle_id: 'a',
  odometer,
  liters,
  total: liters * 50,
  currency: 'UAH',
  date,
  created_at: `${date}T12:00:00Z`,
  fuel_type: 'petrol',
  full_tank: full,
});
const service = (
  id: string,
  date: string,
  overrides: Partial<ServiceEntry> = {},
): ServiceEntry => ({
  id,
  vehicle_id: 'a',
  date,
  odometer: 1000,
  title: 'Oil change',
  category: 'oil',
  total: 300,
  currency: 'UAH',
  next_odometer: null,
  notes: '',
  created_at: `${date}T12:00:00Z`,
  ...overrides,
});
test('rolling dates include exactly 30 local calendar days and clamp leap years', () => {
  assert.deepEqual(getReportRange({ mode: 'last30', anchor: '2026-10-28' }, now), {
    from: '2026-09-29',
    to: '2026-10-28',
  });
  assert.deepEqual(getReportRange({ mode: 'last12', anchor: '2026-10-28' }, now), {
    from: '2025-10-29',
    to: '2026-10-28',
  });
  assert.deepEqual(
    getReportRange({ mode: 'last12', anchor: '2024-02-29' }, new Date(2024, 1, 29)),
    { from: '2023-03-01', to: '2024-02-29' },
  );
  assert.deepEqual(getReportRange({ mode: 'month', anchor: '2024-02-01' }, now), {
    from: '2024-02-01',
    to: '2024-02-29',
  });
  assert.deepEqual(shiftReportPeriod({ mode: 'month', anchor: '2026-01-31' }, -1), {
    mode: 'month',
    anchor: '2025-12-01',
  });
});
test('report snapshots isolate car, currency, dates and include all rows before aggregating', () => {
  const fills = Array.from({ length: 601 }, (_, i) => ({
    ...fuel(String(i), 1000 + i, 1),
    total: 0.1,
  }));
  fills.push(
    { ...fuel('other', 3000, 20), vehicle_id: 'b' },
    fuel('old', 3000, 20, false, '2025-10-01'),
  );
  const rows = entriesInRange(fills, [service('s', '2026-10-28')], 'a', {
    from: '2026-10-01',
    to: '2026-10-28',
  });
  const totals = sumExpenses(rows);
  assert.equal(rows.length, 602);
  assert.equal(totals.fuel, 60.1);
  assert.equal(totals.service, 300);
  assert.equal(totals.total, 360.1);
  assert.equal(totals.liters, 601);
  const buckets = getExpenseBuckets(rows, { from: '2026-10-01', to: '2026-10-28' });
  assert.equal(buckets.length, 4);
  assert.equal(Math.round(buckets.reduce((n, b) => n + b.total, 0) * 100), 36010);
});
test('month buckets keep partial boundary months without dropping their records', () => {
  const range = { from: '2025-10-29', to: '2026-10-28' };
  const rows = entriesInRange(
    [fuel('first', 100, 10, true, '2025-10-29'), fuel('last', 200, 20, true, '2026-10-28')],
    [],
    'a',
    range,
  );
  const buckets = getExpenseBuckets(rows, range);
  assert.equal(buckets.length, 13);
  assert.equal(buckets[0]?.from, '2025-10-29');
  assert.equal(buckets.at(-1)?.to, '2026-10-28');
  assert.equal(
    buckets.reduce((n, x) => n + x.total, 0),
    1500,
  );
});
test('full-to-full consumption excludes baseline litres and includes all partial fills', () => {
  const cycles = getFuelCycles(
    [fuel('base', 1000, 50, true), fuel('partial', 1200, 10), fuel('close', 1500, 25, true)],
    'a',
  );
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0]?.distance, 500);
  assert.equal(cycles[0]?.liters, 35);
  assert.ok(Math.abs(cycles[0]!.litersPer100 - 7) < 1e-10);
  assert.equal(
    getFuelCycles([fuel('partial', 1000, 20), fuel('first-full', 1200, 40, true)], 'a').length,
    0,
  );
});
test('consumption averages are weighted by distance and include cycles ending in the selected period', () => {
  const cycles = getFuelCycles(
    [
      fuel('base', 1000, 50, true, '2026-09-29'),
      fuel('one', 1500, 30, true, '2026-10-01'),
      fuel('two', 2500, 80, true, '2026-10-10'),
    ],
    'a',
  );
  const [summary] = summarizeFuelEfficiency(cycles, { from: '2026-10-01', to: '2026-10-28' });
  assert.equal(summary?.count, 2);
  assert.equal(summary?.distance, 1500);
  assert.equal(summary?.liters, 110);
  assert.equal(summary?.litersPer100, (110 / 1500) * 100);
});
test('unknown fuel, fuel changes and decreasing odometers break the full-tank baseline', () => {
  assert.equal(
    getFuelCycles(
      [
        fuel('b', 1000, 40, true),
        { ...fuel('unknown', 1200, 10), fuel_type: null },
        fuel('e', 1500, 30, true),
      ],
      'a',
    ).length,
    0,
  );
  assert.equal(
    getFuelCycles(
      [
        fuel('b', 1000, 40, true),
        { ...fuel('diesel', 1200, 10), fuel_type: 'diesel' },
        fuel('e', 1500, 30, true),
      ],
      'a',
    ).length,
    0,
  );
  assert.equal(
    getFuelCycles(
      [fuel('b', 2000, 40, true, '2026-10-01'), fuel('e', 1000, 30, true, '2026-10-02')],
      'a',
    ).length,
    0,
  );
  assert.equal(
    getFuelCycles([fuel('b', 1000, 40, true), fuel('e', 1000, 30, true)], 'a').length,
    0,
  );
  assert.equal(
    getFuelCycles(
      [fuel('b', 1000, 40, true), { ...fuel('e', 1500, 30, true), vehicle_id: 'b' }],
      'a',
    ).length,
    0,
  );
});
test('service dates and odometers independently trigger the earliest due condition', () => {
  const rows = [
    service('dated', '2026-01-01', { next_date: '2026-10-27' }),
    service('tires', '2026-01-01', { category: 'tires', next_odometer: 2000 }),
    service('filters', '2026-01-01', { category: 'filters', next_date: '2026-11-15' }),
  ];
  const schedule = getServiceSchedule(rows, 'a', 2100, now);
  assert.equal(schedule.find((x) => x.entry.id === 'dated')?.status, 'overdue');
  assert.equal(schedule.find((x) => x.entry.id === 'tires')?.remainingKm, -100);
  assert.equal(schedule.find((x) => x.entry.id === 'filters')?.status, 'soon');
});
test('latest completed maintenance supersedes prior category; distinct other tasks remain separate', () => {
  const rows = [
    service('old', '2026-01-01', { next_date: '2026-02-01' }),
    service('new', '2026-09-01'),
    service('belt', '2026-01-01', {
      category: 'other',
      title: 'Timing belt',
      next_date: '2027-01-01',
    }),
    service('coolant', '2026-02-01', {
      category: 'other',
      title: 'Coolant',
      next_date: '2027-02-01',
    }),
  ];
  assert.deepEqual(
    getServiceSchedule(rows, 'a', 1000, now).map((x) => x.entry.id),
    ['belt', 'coolant'],
  );
});
test('future service dates are allowed, while invalid or non-forward dates are rejected', () => {
  assert.equal(validateJournal(service('s', '2024-01-01', { next_date: '2027-01-01' })), null);
  assert.equal(
    validateJournal(service('s', '2024-01-01', { next_date: '2023-12-31' })),
    'nextDateInvalid',
  );
  assert.equal(
    validateJournal(service('s', '2024-01-01', { next_date: '2027-02-29' })),
    'nextDateInvalid',
  );
  assert.equal(
    validateJournal({ ...fuel('s', 1000, 30), full_tank: 'yes' as unknown as boolean }),
    'entryInvalid',
  );
});
test('CSV preserves Unicode, quotes and newlines and neutralises spreadsheet formulas', () => {
  const labels = {
    vehicle: 'Vehicle',
    date: 'Date',
    kind: 'Kind',
    description: 'Description',
    odometer: 'Odometer',
    liters: 'Litres',
    total: 'Total',
    currency: 'Currency',
    fuelType: 'Fuel type',
    fullTank: 'Full',
    nextOdometer: 'Next km',
    nextDate: 'Next date',
    notes: 'Notes',
    fuel: 'Fuel',
    service: 'Service',
    yes: 'Yes',
    no: 'No',
    fuelTypes: { petrol: 'Petrol' },
  } satisfies CsvLabels;
  const vehicle = { make: '=HYPERLINK("bad")', model: 'Golf' } as Vehicle;
  const entry = service('s', '2026-10-01', { title: 'Заміна "мастила"', notes: '\n=1+1' });
  const csv = buildJournalCsv([{ kind: 'service', data: entry }], vehicle, labels);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes(`"'=HYPERLINK(""bad"") Golf"`));
  assert.ok(csv.includes('Заміна ""мастила""'));
  assert.ok(csv.includes(`"'\n=1+1"`));
  assert.ok(csv.endsWith('\r\n'));
});
