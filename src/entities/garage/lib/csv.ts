import type { JournalEntry, Vehicle } from '../model/types';
export type CsvLabels = {
  vehicle: string;
  date: string;
  kind: string;
  description: string;
  odometer: string;
  liters: string;
  total: string;
  currency: string;
  fuelType: string;
  fullTank: string;
  nextOdometer: string;
  nextDate: string;
  notes: string;
  fuel: string;
  service: string;
  yes: string;
  no: string;
  fuelTypes: Record<string, string>;
};
function cell(value: string | number): string {
  let text = String(value);
  // Quoting alone does not prevent spreadsheet formula execution in user-authored text.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function buildJournalCsv(
  entries: JournalEntry[],
  vehicle: Vehicle,
  labels: CsvLabels,
): string {
  const header = [
    labels.vehicle,
    labels.date,
    labels.kind,
    labels.description,
    labels.odometer,
    labels.liters,
    labels.total,
    labels.currency,
    labels.fuelType,
    labels.fullTank,
    labels.nextOdometer,
    labels.nextDate,
    labels.notes,
  ];
  const rows = entries.map((row) => {
    const x = row.data;
    return [
      `${vehicle.make} ${vehicle.model}`,
      x.date,
      labels[row.kind],
      row.kind === 'service' ? row.data.title : labels.fuel,
      x.odometer,
      row.kind === 'fuel' ? row.data.liters : '',
      x.total.toFixed(2),
      x.currency,
      row.kind === 'fuel' ? (labels.fuelTypes[row.data.fuel_type ?? 'unknown'] ?? '') : '',
      row.kind === 'fuel' ? labels[row.data.full_tank ? 'yes' : 'no'] : '',
      row.kind === 'service' ? (row.data.next_odometer ?? '') : '',
      row.kind === 'service' ? (row.data.next_date ?? '') : '',
      row.kind === 'service' ? row.data.notes : '',
    ];
  });
  return '\uFEFF' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
