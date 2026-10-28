import { requireCloud } from '@/shared/api';
import { storage } from '@/shared/lib';
import type { GarageData, Vehicle, DiagnosticScan, FuelEntry, ServiceEntry } from '../model/types';
import { emptyGarage } from '../model/types';
const KEY = 'mygarage.guest.v1';
export async function readGarage(owner: string | null): Promise<GarageData> {
  if (!owner) {
    const raw = await storage.getItem(KEY);
    if (!raw) return emptyGarage();
    const data = JSON.parse(raw) as GarageData;
    if (
      !Array.isArray(data.vehicles) ||
      !Array.isArray(data.scans) ||
      !Array.isArray(data.fuel) ||
      !Array.isArray(data.service)
    )
      throw new Error('Invalid local garage');
    return data;
  }
  const db = requireCloud();
  const [vehicles, scans, fuel, service] = await Promise.all([
    db
      .from('vehicles')
      .select('*')
      .eq('owner_id', owner)
      .order('created_at')
      .limit(100)
      .returns<Vehicle[]>(),
    db
      .from('diagnostic_scans')
      .select('*')
      .eq('owner_id', owner)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<DiagnosticScan[]>(),
    // All financial rows are required for accurate totals. Read every page, never a truncated year.
    readAll<FuelEntry>('fuel_entries', owner),
    readAll<ServiceEntry>('service_entries', owner),
  ]);
  if (vehicles.error) throw vehicles.error;
  if (scans.error) throw scans.error;
  return {
    vehicles: vehicles.data,
    scans: scans.data,
    fuel,
    service,
    selectedId: vehicles.data[0]?.id ?? null,
  };
}
async function readAll<T extends { id: string }>(
  table: 'fuel_entries' | 'service_entries',
  owner: string,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = requireCloud().from(table).select('*').eq('owner_id', owner).order('id').limit(500);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query.returns<T[]>();
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
    cursor = data[data.length - 1]!.id;
  }
}
export async function saveGuest(data: GarageData) {
  await storage.setItem(KEY, JSON.stringify(data));
}
export type RecordTable = 'vehicles' | 'diagnostic_scans' | 'fuel_entries' | 'service_entries';
export async function writeCloud<T extends { id: string }>(
  table: RecordTable,
  owner: string,
  record: T,
) {
  // Upsert by client UUID makes a retry after an uncertain network response idempotent.
  const { error } = await requireCloud()
    .from(table)
    .upsert({ ...record, owner_id: owner }, { onConflict: 'id' });
  if (error) throw error;
}
export async function removeCloud(table: RecordTable, owner: string, id: string) {
  const { error } = await requireCloud().from(table).delete().eq('owner_id', owner).eq('id', id);
  if (error) throw error;
}
