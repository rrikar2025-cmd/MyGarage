import { useLocalSearchParams, router } from 'expo-router';
import { useGarage } from '@/entities/garage';
import { attachmentKinds, type AttachmentKind, type AttachmentTarget } from '@/entities/attachment';
import { AttachmentGallery } from '@/features/manage-attachments';
import { useTranslation } from '@/shared/i18n';
import { formatDateOnly } from '@/shared/lib';
import { Button, EmptyState, ErrorState, Loading, Screen } from '@/shared/ui';
export function AttachmentsPage() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const state = useGarage();
  const { t, locale } = useTranslation();
  const targetKind = kind as AttachmentKind;
  const record =
    targetKind === 'vehicle'
      ? state.vehicles.find((v) => v.id === id)
      : targetKind === 'fuel'
        ? state.fuel.find((v) => v.id === id)
        : targetKind === 'service'
          ? state.service.find((v) => v.id === id)
          : undefined;
  const vehicleId = record && ('vehicle_id' in record ? record.vehicle_id : record.id);
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  const target: AttachmentTarget | null =
    attachmentKinds.includes(targetKind) && record && vehicle
      ? { kind: targetKind, id, vehicleId: vehicle.id }
      : null;
  const recordLabel =
    record && ('title' in record ? record.title : 'date' in record ? t('fuel') : null);
  const recordDate = record && 'date' in record ? formatDateOnly(record.date, locale) : null;
  const subtitle = vehicle
    ? [`${vehicle.make} ${vehicle.model}`, recordLabel, recordDate].filter(Boolean).join(' · ')
    : undefined;
  return (
    <Screen
      title={t(kind === 'fuel' || kind === 'service' ? 'receiptPhotos' : 'photos')}
      subtitle={subtitle}
      action={<Button label={t('back')} variant="ghost" onPress={() => router.back()} />}
    >
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorState onRetry={() => void state.load(state.owner)} />
      ) : target ? (
        <AttachmentGallery key={`${state.owner}:${kind}:${id}`} target={target} />
      ) : (
        <EmptyState title={t('attachmentNotFound')} description={t('attachmentNotFoundHint')} />
      )}
    </Screen>
  );
}
