import { localDate } from './dates';
export { localDate } from './dates';
import type { VehicleInput } from '../model/types';
export function validateVehicle(
  input: VehicleInput,
  now = new Date(),
):
  | 'validationRequired'
  | 'validationYear'
  | 'validationMileage'
  | 'validationVin'
  | 'validationPlate'
  | null {
  if (
    !input.make.trim() ||
    !input.model.trim() ||
    input.make.length > 60 ||
    input.model.length > 60
  )
    return 'validationRequired';
  if (!Number.isInteger(input.year) || input.year < 1886 || input.year > now.getFullYear() + 1)
    return 'validationYear';
  if (!Number.isInteger(input.mileage) || input.mileage < 0 || input.mileage > 10_000_000)
    return 'validationMileage';
  if (input.vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(input.vin)) return 'validationVin';
  if (input.plate.length > 16) return 'validationPlate';
  return null;
}
export function isDateOnly(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= localDate(today) &&
    value >= '1886-01-01'
  );
}
export function parseDecimal(value: string): number {
  return value.trim() ? Number(value.replace(',', '.')) : NaN;
}
