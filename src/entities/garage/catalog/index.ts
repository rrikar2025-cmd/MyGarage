import catalogue from './models.json';

const models: Record<string, string[]> = catalogue;
export const vehicleMakes = Object.keys(models).sort((a, b) => a.localeCompare(b));
export const vehicleYears = Array.from({ length: 37 }, (_, index) => String(2026 - index));
export function vehicleModels(make: string): string[] {
  const key = vehicleMakes.find((item) => item.toLowerCase() === make.trim().toLowerCase());
  return key ? (models[key] ?? []) : [];
}
