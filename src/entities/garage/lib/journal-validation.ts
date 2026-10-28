import type { FuelEntry, ServiceEntry } from '../model/types';
import { isCalendarDate } from './dates';
import { isDateOnly } from './validation';
export function validateJournal(
  entry: FuelEntry | ServiceEntry,
): 'entryInvalid' | 'nextInvalid' | 'nextDateInvalid' | null {
  if (
    !isDateOnly(entry.date) ||
    !Number.isInteger(entry.odometer) ||
    entry.odometer < 0 ||
    entry.odometer > 10_000_000 ||
    !Number.isFinite(entry.total) ||
    entry.total < 0 ||
    entry.total > 100_000_000 ||
    Math.abs(entry.total * 100 - Math.round(entry.total * 100)) > 0.00001 ||
    entry.currency !== 'UAH'
  )
    return 'entryInvalid';
  if (
    'liters' in entry &&
    (!Number.isFinite(entry.liters) ||
      entry.liters <= 0 ||
      entry.liters > 10000 ||
      Math.abs(entry.liters * 1000 - Math.round(entry.liters * 1000)) > 0.00001 ||
      entry.total <= 0)
  )
    return 'entryInvalid';
  if (
    'liters' in entry &&
    ((entry.fuel_type != null && !['petrol', 'diesel', 'lpg', 'other'].includes(entry.fuel_type)) ||
      (entry.full_tank !== undefined && typeof entry.full_tank !== 'boolean'))
  )
    return 'entryInvalid';
  if ('title' in entry) {
    if (
      !entry.title.trim() ||
      entry.title.length > 120 ||
      entry.notes.length > 1000 ||
      !['oil', 'filters', 'tires', 'brakes', 'other'].includes(entry.category)
    )
      return 'entryInvalid';
    if (
      entry.next_date != null &&
      (!isCalendarDate(entry.next_date) || entry.next_date <= entry.date)
    )
      return 'nextDateInvalid';
    if (
      entry.next_odometer !== null &&
      (!Number.isInteger(entry.next_odometer) ||
        entry.next_odometer <= entry.odometer ||
        entry.next_odometer > 10_000_000)
    )
      return 'nextInvalid';
  }
  return null;
}
