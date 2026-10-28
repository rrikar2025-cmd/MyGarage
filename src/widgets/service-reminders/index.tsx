import { useMemo } from 'react';
import { router } from 'expo-router';
import { getServiceSchedule, localDate, ServiceReminderCard, useGarage } from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
import { Button, Section } from '@/shared/ui';
export function ServiceReminders({ vehicleId, mileage }: { vehicleId: string; mileage: number }) {
  const { t } = useTranslation();
  const entries = useGarage((s) => s.service);
  const today = localDate();
  const reminders = useMemo(
    () => getServiceSchedule(entries, vehicleId, mileage),
    [entries, vehicleId, mileage, today],
  );
  if (!reminders.length) return null;
  return (
    <Section title={t('nextService')}>
      {reminders.slice(0, 2).map((reminder) => (
        <ServiceReminderCard key={reminder.entry.id} reminder={reminder} />
      ))}
      <Button
        label={t('allServiceDates')}
        variant="ghost"
        onPress={() => router.push('/service')}
      />
    </Section>
  );
}
