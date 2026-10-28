export { storage } from './storage';
export { createSerialQueue } from './serial-queue';
export function formatDate(value: string, locale: 'uk' | 'en') {
  return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function formatNumber(value: number, locale: 'uk' | 'en', digits = 0, minimumDigits = 0) {
  return new Intl.NumberFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    maximumFractionDigits: digits,
    minimumFractionDigits: minimumDigits,
  }).format(value);
}

export function formatDateOnly(value: string, locale: 'uk' | 'en') {
  return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    dateStyle: 'medium',
  }).format(new Date(`${value}T12:00:00`));
}
