/** Schedule at 09:00 in the device's local time, 30 and 7 calendar days before expiry. */
export function reminderDates(expiresOn: string, now = new Date()): Date[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return [];
  const [year, month, day] = expiresOn.split('-').map(Number);
  if (!year || !month || !day) return [];
  const expiration = new Date(year, month - 1, day, 23, 59, 59);
  if (
    expiration.getFullYear() !== year ||
    expiration.getMonth() !== month - 1 ||
    expiration.getDate() !== day ||
    expiration <= now
  )
    return [];
  const dates = [30, 7].map((offset) => new Date(year, month - 1, day - offset, 9));
  const future = dates.filter((date) => date > now);
  if (!future.length) return [new Date(now.getTime() + 60_000)];
  return future;
}
