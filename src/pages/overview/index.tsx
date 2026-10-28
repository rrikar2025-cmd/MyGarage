import { View } from 'react-native';
import { router } from 'expo-router';
import { useGarage, useSelectedVehicle, VehicleCard } from '@/entities/garage';
import { LiveTelemetry } from '@/widgets/live-telemetry';
import { ServiceReminders } from '@/widgets/service-reminders';
import { ExpenseSummary } from '@/widgets/expense-summary';
import { useTranslation } from '@/shared/i18n';
import { Text, Screen, Button, EmptyState, Loading, ErrorState } from '@/shared/ui';
export function OverviewPage() {
  const { t } = useTranslation();
  const vehicle = useSelectedVehicle();
  const loading = useGarage((s) => s.loading);
  const error = useGarage((s) => s.error);
  const owner = useGarage((s) => s.owner);
  return (
    <Screen title={t('appName')} subtitle={t('greetingSub')}>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState onRetry={() => void useGarage.getState().load(owner)} />
      ) : !vehicle ? (
        <>
          <View style={{ paddingVertical: 12 }}>
            <Text variant="title" style={{ fontSize: 38, lineHeight: 46, maxWidth: 340 }}>
              {t('greeting')}
            </Text>
          </View>
          <EmptyState title={t('noVehicles')} description={t('noVehiclesBody')} icon="truck">
            <Button
              label={t('addVehicle')}
              icon="plus"
              onPress={() => router.push('/vehicle/new')}
            />
          </EmptyState>
        </>
      ) : (
        <>
          <VehicleCard vehicle={vehicle} selected />
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Button
                label={t('addFuel')}
                icon="droplet"
                variant="secondary"
                onPress={() => router.push('/entry/fuel')}
              />
            </View>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Button
                label={t('addService')}
                icon="tool"
                variant="secondary"
                onPress={() => router.push('/entry/service')}
              />
            </View>
          </View>
          <ExpenseSummary vehicleId={vehicle.id} />
          <ServiceReminders vehicleId={vehicle.id} mileage={vehicle.mileage} />
          <LiveTelemetry />
        </>
      )}
    </Screen>
  );
}
