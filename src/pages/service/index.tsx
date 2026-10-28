import { useMemo } from 'react';
import { router } from 'expo-router';
import {
  getServiceSchedule,
  localDate,
  ServiceReminderCard,
  useGarage,
  useSelectedVehicle,
} from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
import { Button, EmptyState, ErrorState, Loading, Notice, Screen } from '@/shared/ui';
export function ServicePage() {
  const { t } = useTranslation();
  const state = useGarage();
  const vehicle = useSelectedVehicle();
  const today = localDate();
  const reminders = useMemo(
    () => getServiceSchedule(state.service, vehicle?.id ?? '', vehicle?.mileage ?? 0),
    [state.service, vehicle?.id, vehicle?.mileage, today],
  );
  return (
    <Screen
      title={t('serviceCalendar')}
      subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : undefined}
      action={<Button label={t('back')} variant="ghost" onPress={() => router.back()} />}
    >
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorState onRetry={() => void state.load(state.owner)} />
      ) : !vehicle ? (
        <EmptyState title={t('selectVehicle')} description={t('selectVehicleHint')}>
          <Button label={t('garage')} onPress={() => router.replace('/garage')} />
        </EmptyState>
      ) : (
        <>
          <Button
            label={t('addService')}
            icon="plus"
            onPress={() => router.push('/entry/service')}
          />
          {!reminders.length && (
            <EmptyState
              title={t('noServiceDates')}
              description={t('noServiceDatesHint')}
              icon="calendar"
            />
          )}
          {reminders.map((reminder) => (
            <ServiceReminderCard
              key={reminder.entry.id}
              reminder={reminder}
              onEdit={() =>
                router.push({
                  pathname: '/entry/[kind]',
                  params: { kind: 'service', id: reminder.entry.id },
                })
              }
            />
          ))}
          <Notice>{t('serviceScheduleHint')}</Notice>
        </>
      )}
    </Screen>
  );
}
