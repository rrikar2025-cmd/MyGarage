import {
  localDate,
  parseDecimal,
  type FuelEntry,
  type ServiceEntry,
  type FuelType,
  type ServiceCategory,
} from '@/entities/garage';
export type EntryDraft = {
  date: string;
  odometer: string;
  total: string;
  liters: string;
  fuelType: FuelType | 'unknown';
  fullTank: boolean;
  title: string;
  notes: string;
  next: string;
  nextDate: string;
  category: ServiceCategory;
};
export function createDraft(mileage: number, existing?: FuelEntry | ServiceEntry): EntryDraft {
  const service = existing && 'title' in existing ? existing : undefined;
  const fuel = existing && 'liters' in existing ? existing : undefined;
  return {
    date: existing?.date ?? localDate(),
    odometer: String(existing?.odometer ?? mileage),
    total: String(existing?.total ?? ''),
    liters: String(fuel?.liters ?? ''),
    fuelType: fuel?.fuel_type ?? 'unknown',
    fullTank: fuel?.full_tank ?? false,
    title: service?.title ?? '',
    notes: service?.notes ?? '',
    next: String(service?.next_odometer ?? ''),
    nextDate: service?.next_date ?? '',
    category: service?.category ?? 'oil',
  };
}
export function buildEntry(
  kind: 'fuel' | 'service',
  form: EntryDraft,
  id: string,
  vehicleId: string,
  createdAt: string,
): FuelEntry | ServiceEntry {
  const base = {
    id,
    vehicle_id: vehicleId,
    date: form.date.trim(),
    odometer: parseDecimal(form.odometer),
    total: parseDecimal(form.total),
    currency: 'UAH' as const,
    created_at: createdAt,
  };
  return kind === 'fuel'
    ? {
        ...base,
        liters: parseDecimal(form.liters),
        fuel_type: form.fuelType === 'unknown' ? null : form.fuelType,
        full_tank: form.fullTank,
      }
    : {
        ...base,
        title: form.title.trim(),
        notes: form.notes.trim(),
        category: form.category,
        next_odometer: form.next.trim() ? parseDecimal(form.next) : null,
        next_date: form.nextDate.trim() || null,
      };
}
