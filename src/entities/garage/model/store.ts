import { removeLocalVehicleCover } from '@/shared/media';
import { create } from 'zustand';
import { randomUUID } from 'expo-crypto';
import { createSerialQueue } from '@/shared/lib';
import {
  readGarage,
  saveGuest,
  writeCloud,
  removeCloud,
  type RecordTable,
} from '../api/repository';
import {
  emptyGarage,
  type GarageData,
  type VehicleInput,
  type DiagnosticScan,
  type FuelEntry,
  type ServiceEntry,
} from './types';
import { validateVehicle } from '../lib/validation';
import { validateJournal } from '../lib/journal-validation';
const run = createSerialQueue();
type GarageStore = GarageData & {
  owner: string | null;
  generation: number;
  loading: boolean;
  error: boolean;
  busy: boolean;
  load: (owner: string | null) => Promise<void>;
  clear: () => void;
  select: (id: string) => void;
  saveVehicle: (input: VehicleInput, id?: string, draftId?: string) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  saveScan: (scan: DiagnosticScan) => Promise<void>;
  saveFuel: (entry: FuelEntry) => Promise<void>;
  saveService: (entry: ServiceEntry) => Promise<void>;
  deleteEntry: (kind: 'fuel' | 'service', id: string) => Promise<void>;
};
function dataOnly(s: GarageData): GarageData {
  return {
    vehicles: s.vehicles,
    scans: s.scans,
    fuel: s.fuel,
    service: s.service,
    selectedId: s.selectedId,
    mods: s.mods,
    builds: s.builds,
  };
}
export const useGarage = create<GarageStore>((set, get) => {
  async function mutate<T extends { id: string }>(
    table: RecordTable,
    record: T,
    transform: (data: GarageData, canonical: T) => GarageData,
    remove = false,
  ) {
    const initial = get();
    if (initial.loading || initial.error) throw new Error('Garage is not ready');
    const generation = initial.generation;
    return run(async () => {
      if (get().generation !== generation) throw new Error('Garage session changed');
      set({ busy: true });
      try {
        const current = get();
        let next = transform(dataOnly(current), record);
        if (
          table !== 'vehicles' &&
          !next.vehicles.some(
            (v) => v.id === (record as { id: string; vehicle_id?: string }).vehicle_id,
          ) &&
          !remove
        )
          throw new Error('Vehicle not found');
        if (current.owner) {
          if (remove) await removeCloud(table, current.owner, record.id);
          else {
            const canonical = await writeCloud(table, current.owner, record);
            next = transform(dataOnly(current), canonical);
          }
        } else await saveGuest(next);
        if (get().generation !== generation) throw new Error('Garage session changed');
        set(next);
      } finally {
        if (get().generation === generation) set({ busy: false });
      }
    });
  }
  return {
    ...emptyGarage(),
    owner: null,
    generation: 0,
    loading: true,
    error: false,
    busy: false,
    load: async (owner) => {
      const generation = get().generation + 1;
      const previousSelection = get().owner === owner ? get().selectedId : null;
      set({ ...emptyGarage(), owner, generation, loading: true, error: false });
      try {
        const data = await readGarage(owner);
        if (get().generation !== generation) return;
        const selectedId = data.vehicles.some((v) => v.id === previousSelection)
          ? previousSelection
          : data.selectedId;
        set({ ...data, selectedId, loading: false });
      } catch {
        if (get().generation === generation) set({ loading: false, error: true });
      }
    },
    clear: () =>
      set({
        ...emptyGarage(),
        owner: null,
        generation: get().generation + 1,
        loading: true,
        error: false,
        busy: false,
      }),
    select: (id) => {
      if (get().vehicles.some((v) => v.id === id)) set({ selectedId: id });
    },
    saveVehicle: async (input, id, draftId) => {
      if (validateVehicle(input)) throw new Error('Invalid vehicle');
      const now = new Date().toISOString();
      const recordId = id ?? draftId ?? randomUUID();
      const existing = get().vehicles.find((v) => v.id === recordId);
      if (id && !existing) throw new Error('Vehicle not found');
      const record = {
        ...input,
        build_budget: existing?.build_budget ?? null,
        id: recordId,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      await mutate('vehicles', record, (s, canonical) => ({
        ...s,
        vehicles: s.vehicles.some((v) => v.id === recordId)
          ? s.vehicles.map((v) => (v.id === recordId ? canonical : v))
          : [...s.vehicles, canonical],
        selectedId: s.selectedId ?? record.id,
      }));
    },
    deleteVehicle: async (id) => {
      const local = !get().owner;
      await mutate(
        'vehicles',
        { id },
        (s) => ({
          ...s,
          vehicles: s.vehicles.filter((v) => v.id !== id),
          mods: s.mods.filter((x) => x.vehicle_id !== id),
          builds: s.builds.filter((x) => x.vehicle_id !== id),
          scans: s.scans.filter((x) => x.vehicle_id !== id),
          fuel: s.fuel.filter((x) => x.vehicle_id !== id),
          service: s.service.filter((x) => x.vehicle_id !== id),
          selectedId:
            s.selectedId === id ? (s.vehicles.find((v) => v.id !== id)?.id ?? null) : s.selectedId,
        }),
        true,
      );
      if (local) await removeLocalVehicleCover(id).catch(() => {});
    },
    saveScan: async (scan) =>
      mutate('diagnostic_scans', scan, (s) => ({
        ...s,
        scans: [scan, ...s.scans.filter((x) => x.id !== scan.id)],
      })),
    saveFuel: async (entry) => {
      if (validateJournal(entry)) throw new Error('Invalid entry');
      await mutate('fuel_entries', entry, (s) => ({
        ...s,
        vehicles: s.vehicles.map((v) =>
          v.id === entry.vehicle_id ? { ...v, mileage: Math.max(v.mileage, entry.odometer) } : v,
        ),
        fuel: [entry, ...s.fuel.filter((x) => x.id !== entry.id)],
      }));
    },
    saveService: async (entry) => {
      if (validateJournal(entry)) throw new Error('Invalid entry');
      await mutate('service_entries', entry, (s) => ({
        ...s,
        vehicles: s.vehicles.map((v) =>
          v.id === entry.vehicle_id ? { ...v, mileage: Math.max(v.mileage, entry.odometer) } : v,
        ),
        service: [entry, ...s.service.filter((x) => x.id !== entry.id)],
      }));
    },
    deleteEntry: async (kind, id) =>
      mutate(
        kind === 'fuel' ? 'fuel_entries' : 'service_entries',
        { id },
        (s) => ({ ...s, [kind]: s[kind].filter((x) => x.id !== id) }),
        true,
      ),
  };
});
export function useSelectedVehicle() {
  return useGarage((s) => s.vehicles.find((v) => v.id === s.selectedId) ?? null);
}
