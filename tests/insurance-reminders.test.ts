import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderDates } from '../src/features/insurance-reminders/model/reminder-dates';

test('schedules 30 and 7 calendar days before expiry, in local time', () => {
  const dates = reminderDates('2026-12-10', new Date(2026, 9, 1, 12));
  assert.deepEqual(
    dates.map((date) => [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()]),
    [
      [2026, 11, 10, 9],
      [2026, 12, 3, 9],
    ],
  );
});

test('past reminders are skipped, near expiry is notified soon, and expired or invalid dates do not schedule', () => {
  assert.equal(reminderDates('2026-12-10', new Date(2026, 10, 20, 12)).length, 1);
  const now = new Date(2026, 11, 8, 12);
  assert.equal(reminderDates('2026-12-10', now)[0]?.getTime(), now.getTime() + 60_000);
  assert.deepEqual(reminderDates('2026-12-10', new Date(2026, 11, 11)), []);
  assert.deepEqual(reminderDates('2027-02-29', now), []);
});
