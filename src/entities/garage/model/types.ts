import type { ScanContext } from '@/shared/types';
export type Vehicle = {
  /** Retained for lossless round-tripping of pre-removal vehicle records. */
  build_budget?: number | null;
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  plate: string;
  vin: string;
  created_at: string;
  updated_at: string;
};
export type VehicleInput = Pick<Vehicle, 'make' | 'model' | 'year' | 'mileage' | 'plate' | 'vin'>;
export type DiagnosticScan = {
  context?: ScanContext;
  id: string;
  vehicle_id: string;
  created_at: string;
  stored: string[];
  pending: string[];
  permanent: string[];
  metrics: Record<string, number>;
};
export type FuelType = 'petrol' | 'diesel' | 'lpg' | 'other';
export type FuelEntry = {
  fuel_type?: FuelType | null;
  full_tank?: boolean;
  id: string;
  vehicle_id: string;
  date: string;
  odometer: number;
  liters: number;
  total: number;
  currency: 'UAH';
  created_at: string;
};
export type ServiceCategory = 'oil' | 'filters' | 'tires' | 'brakes' | 'other';
export type ServiceEntry = {
  next_date?: string | null;
  id: string;
  vehicle_id: string;
  date: string;
  odometer: number;
  title: string;
  category: ServiceCategory;
  total: number;
  currency: 'UAH';
  next_odometer: number | null;
  notes: string;
  created_at: string;
};
export type JournalEntry =
  { kind: 'fuel'; data: FuelEntry } | { kind: 'service'; data: ServiceEntry };
/** Opaque retired rows stay in guest snapshots so ordinary saves never discard prior data. */
type LegacyVehicleRecord = { id: string; vehicle_id: string; [field: string]: unknown };
export type GarageData = {
  mods: LegacyVehicleRecord[];
  builds: LegacyVehicleRecord[];
  vehicles: Vehicle[];
  scans: DiagnosticScan[];
  fuel: FuelEntry[];
  service: ServiceEntry[];
  selectedId: string | null;
};
export const emptyGarage = (): GarageData => ({
  vehicles: [],
  mods: [],
  builds: [],
  scans: [],
  fuel: [],
  service: [],
  selectedId: null,
});
