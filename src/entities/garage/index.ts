export { useGarage, useSelectedVehicle } from './model/store';
export type {
  Vehicle,
  VehicleInput,
  DiagnosticScan,
  FuelEntry,
  ServiceEntry,
  ServiceCategory,
  JournalEntry,
} from './model/types';
export { validateVehicle, isDateOnly, localDate, parseDecimal } from './lib/validation';
export { getExpenses, getNextService } from './lib/expenses';
export { VehicleCard, CarDrawing } from './ui/VehicleCard';
export { validateJournal } from './lib/journal-validation';

export type { FuelType } from './model/types';
export {
  getReportRange,
  shiftReportPeriod,
  entriesInRange,
  sumExpenses,
  getExpenseBuckets,
} from './lib/reports';
export type {
  ReportMode,
  ReportPeriod,
  DateRange,
  ExpenseTotals,
  ExpenseBucket,
} from './lib/reports';
export { getFuelCycles, summarizeFuelEfficiency } from './lib/fuel-efficiency';
export { getServiceSchedule } from './lib/service-schedule';
export type { ServiceReminder } from './lib/service-schedule';
export { buildJournalCsv } from './lib/csv';
export type { CsvLabels } from './lib/csv';
export { ServiceReminderCard } from './ui/ServiceReminderCard';
export { JournalRow } from './ui/JournalRow';
