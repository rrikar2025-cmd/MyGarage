export type ReminderClaim = {
  service_entry_id: string;
  push_device_id: string;
  reminder_state: 'soon' | 'overdue';
  revision: string;
  expo_push_token: string;
  locale: 'uk' | 'en';
};
export type ExpoTicket = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };
export function equalJobHash(a: string, b: string) {
  if (a.length !== b.length || !a.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
export function validMediaPath(path: string) {
  return /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}\/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}\.jpg$/.test(
    path,
  );
}
export function reminderMessage(claim: ReminderClaim) {
  const overdue = claim.reminder_state === 'overdue';
  const copy =
    claim.locale === 'uk'
      ? {
          title: overdue ? 'Час виконати сервіс' : 'Незабаром час сервісу',
          body: 'Відкрийте «Мій гараж», щоб переглянути нагадування про ТО.',
        }
      : {
          title: overdue ? 'Service is due' : 'Service is coming up',
          body: 'Open My Garage to review your service reminder.',
        };
  return {
    to: claim.expo_push_token,
    ...copy,
    sound: 'default',
    channelId: 'service-reminders',
    data: { type: 'service-reminder' },
  };
}
export function ticketDisposition(ticket: ExpoTicket) {
  return {
    status: ticket.status === 'ok' && ticket.id ? 'accepted' : 'failed',
    ticket_id: ticket.id ?? null,
    disableDevice: ticket.details?.error === 'DeviceNotRegistered',
  } as const;
}
