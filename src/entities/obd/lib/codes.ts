import type { MessageKey } from '@/shared/i18n';
// Small, explicit generic-code glossary. Unknown/manufacturer codes never receive invented diagnoses.
// Reference: Ford 2024-2025 OBD operation summary (see PROVENANCE.md).
const descriptions: Record<string, MessageKey> = {
  P0171: 'dtcLeanB1',
  P0172: 'dtcRichB1',
  P0300: 'dtcMisfireRandom',
  P0301: 'dtcMisfire1',
  P0302: 'dtcMisfire2',
  P0303: 'dtcMisfire3',
  P0304: 'dtcMisfire4',
  P0420: 'dtcCatalyst1',
  P0430: 'dtcCatalyst2',
};
export function normalizeDtc(code: string) {
  return code.trim().toUpperCase();
}
export function validDtc(code: string) {
  return /^[PCBU][0-3][0-9A-F]{3}$/.test(normalizeDtc(code));
}
export function describeDtc(code: string): MessageKey {
  return descriptions[normalizeDtc(code)] ?? 'dtcUnknown';
}
export function normalizeVin(value: string): string | null {
  const vin = value.trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : null;
}
export function vinMismatch(expected: string, actual?: string) {
  return Boolean(
    normalizeVin(expected) && actual && normalizeVin(expected) !== normalizeVin(actual),
  );
}
