import test from 'node:test';
import assert from 'node:assert/strict';
import { getExpenses, getNextService } from '../src/entities/garage/lib/expenses';
import {
  validateVehicle,
  isDateOnly,
  localDate,
  parseDecimal,
} from '../src/entities/garage/lib/validation';
import { validateJournal } from '../src/entities/garage/lib/journal-validation';
import { mapLiveValues } from '../src/entities/obd/lib/mapper';
import { createSerialQueue } from '../src/shared/lib/serial-queue';
import { en } from '../src/shared/i18n/en';
import { uk } from '../src/shared/i18n/uk';
import type { FuelEntry, ServiceEntry } from '../src/entities/garage/model/types';
const fuel = (id: string, date: string, total: number, vehicle_id = 'car-a'): FuelEntry => ({
  id,
  vehicle_id,
  date,
  total,
  odometer: 1000,
  liters: 20,
  currency: 'UAH',
  created_at: `${date}T12:00:00Z`,
});
const service = (
  id: string,
  date: string,
  total: number,
  next_odometer: number | null = null,
): ServiceEntry => ({
  id,
  vehicle_id: 'car-a',
  date,
  total,
  odometer: 1000,
  title: 'Oil change',
  category: 'oil',
  notes: '',
  next_odometer,
  currency: 'UAH',
  created_at: `${date}T12:00:00Z`,
});
test('expense totals include only selected car and requested calendar period; cents are exact', () => {
  const fills = [
    fuel('1', '2026-10-01', 0.1),
    fuel('2', '2026-10-20', 0.2),
    fuel('3', '2026-09-01', 500),
    fuel('4', '2025-10-01', 900),
    fuel('5', '2026-10-01', 99, 'car-b'),
  ];
  const repairs = [service('a', '2026-10-10', 100), service('b', '2026-01-02', 700)];
  assert.deepEqual(getExpenses(fills, repairs, 'car-a', 'month', new Date(2026, 9, 28)), {
    fuel: 0.3,
    service: 100,
    total: 100.3,
  });
  assert.deepEqual(getExpenses(fills, repairs, 'car-a', 'year', new Date(2026, 9, 28)), {
    fuel: 500.3,
    service: 800,
    total: 1300.3,
  });
});
test('empty periods and year boundaries do not leak records', () => {
  assert.deepEqual(
    getExpenses([fuel('1', '2025-12-31', 300)], [], 'car-a', 'month', new Date(2026, 0, 1)),
    { fuel: 0, service: 0, total: 0 },
  );
});
test('service reminder supersedes old entry for same category', () => {
  assert.equal(
    getNextService(
      [service('old', '2026-01-01', 100, 2000), service('new', '2026-10-01', 100, 12000)],
      'car-a',
    )?.id,
    'new',
  );
  assert.equal(
    getNextService(
      [service('old', '2026-01-01', 100, 2000), service('new', '2026-10-01', 100, null)],
      'car-a',
    ),
    undefined,
  );
});
test('date-only validation rejects invalid dates and future entries', () => {
  const today = new Date(2026, 9, 28);
  assert.equal(isDateOnly('2024-02-29', today), true);
  assert.equal(isDateOnly('2026-02-29', today), false);
  assert.equal(isDateOnly('2026-13-01', today), false);
  assert.equal(isDateOnly('2026-10-29', today), false);
  assert.equal(localDate(today), '2026-10-28');
  assert.equal(parseDecimal('12,50'), 12.5);
  assert.ok(Number.isNaN(parseDecimal('')));
});
test('vehicle validation rejects invalid VIN, year and non-whole mileage', () => {
  const v = { make: 'BMW', model: '320', year: 2018, mileage: 1000, plate: '', vin: '' };
  assert.equal(validateVehicle(v), null);
  assert.equal(validateVehicle({ ...v, mileage: -1 }), 'validationMileage');
  assert.equal(validateVehicle({ ...v, year: 4000 }), 'validationYear');
  assert.equal(validateVehicle({ ...v, vin: 'INVALID' }), 'validationVin');
});
test('journal validation rejects negative money, fractional odometers and invalid reminders', () => {
  assert.equal(validateJournal(fuel('1', '2024-01-01', 100)), null);
  assert.equal(validateJournal({ ...fuel('1', '2024-01-01', 100), total: -1 }), 'entryInvalid');
  assert.equal(
    validateJournal({ ...fuel('1', '2024-01-01', 100), total: 100.001 }),
    'entryInvalid',
  );
  assert.equal(validateJournal({ ...fuel('1', '2024-01-01', 100), odometer: 1.5 }), 'entryInvalid');
  assert.equal(validateJournal(service('s', '2024-01-01', 0, 500)), 'nextInvalid');
});
test('telemetry preserves absence, legitimate zero, units and corrected pressure meanings', () => {
  const metrics = mapLiveValues([
    { key: 'RPM', value: '0 rpm' },
    { key: 'Battery', value: '14.2V' },
    { key: 'Coolant', value: 'NO DATA' },
    { key: 'MAP', value: '100' },
    { key: 'OilTemp', value: '85' },
    { key: 'Unknown', value: '7' },
  ]);
  assert.deepEqual(metrics, { rpm: 0, battery: 14.2, map: 100, oilTemp: 85 });
  assert.equal('coolant' in metrics, false);
  assert.equal('boost' in metrics, false);
});
test('native operations run serially and recover after rejection', async () => {
  const run = createSerialQueue();
  const order: string[] = [];
  const first = run(async () => {
    order.push('read-start');
    await new Promise((r) => setTimeout(r, 10));
    order.push('read-end');
    throw new Error('adapter');
  });
  const second = run(async () => {
    order.push('next');
    return 2;
  });
  await assert.rejects(first);
  assert.equal(await second, 2);
  assert.deepEqual(order, ['read-start', 'read-end', 'next']);
});
test('both locales have identical, nonempty message catalogs', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(uk).sort());
  for (const text of [...Object.values(en), ...Object.values(uk)]) assert.ok(text.trim());
});
