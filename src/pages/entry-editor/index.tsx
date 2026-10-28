import { router, useLocalSearchParams } from 'expo-router';
import { useGarage } from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
import { Button, EmptyState, ErrorState, Loading, Screen } from '@/shared/ui';
import { EntryForm } from './ui/EntryForm';
export function EntryEditorPage() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id?: string }>();
  const { t } = useTranslation();
  const loading = useGarage((s) => s.loading);
  const error = useGarage((s) => s.error);
  const owner = useGarage((s) => s.owner);
  const existing = useGarage((s) =>
    kind === 'fuel' ? s.fuel.find((x) => x.id === id) : s.service.find((x) => x.id === id),
  );
  // Editing a historical entry uses its own car, even if a different car is currently selected.
  const vehicle = useGarage((s) =>
    s.vehicles.find((v) => v.id === (existing?.vehicle_id ?? s.selectedId)),
  );
  if (loading)
    return (
      <Screen title={t('journal')}>
        <Loading />
      </Screen>
    );
  if (error)
    return (
      <Screen title={t('journal')}>
        <ErrorState onRetry={() => void useGarage.getState().load(owner)} />
      </Screen>
    );
  if (!vehicle || !['fuel', 'service'].includes(kind) || (id && !existing))
    return (
      <Screen title={t('journal')}>
        <EmptyState title={t('selectVehicle')} description={t('selectVehicleHint')}>
          <Button label={t('garage')} onPress={() => router.replace('/garage')} />
        </EmptyState>
      </Screen>
    );
  return (
    <EntryForm
      key={`${kind}:${id ?? 'new'}:${vehicle.id}`}
      kind={kind as 'fuel' | 'service'}
      vehicleId={vehicle.id}
      mileage={vehicle.mileage}
      existing={existing}
    />
  );
}
