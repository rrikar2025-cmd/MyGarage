import { emptyGarage, type GarageData } from '../model/types';
/** Additive upgrade of the existing v1 local format; no financial rows are discarded. */
export function parseGuestGarage(raw: string | null): GarageData {
  if (!raw) return emptyGarage();
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('Invalid local garage');
  const value = data as Record<string, unknown>;
  for (const key of ['vehicles', 'scans', 'fuel', 'service'])
    if (!Array.isArray(value[key])) throw new Error('Invalid local garage');
  for (const key of ['mods', 'builds'])
    if (value[key] !== undefined && !Array.isArray(value[key]))
      throw new Error('Invalid local projects');
  return { ...value, mods: value.mods ?? [], builds: value.builds ?? [] } as GarageData;
}
