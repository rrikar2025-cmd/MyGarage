import { router } from 'expo-router';
import type { AttachmentKind } from '@/entities/attachment';
import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';
export function AttachmentButton({ kind, id }: { kind: AttachmentKind; id: string }) {
  const { t } = useTranslation();
  return (
    <Button
      label={t(kind === 'fuel' || kind === 'service' ? 'receiptPhotos' : 'photos')}
      icon="image"
      variant="secondary"
      onPress={() => router.push({ pathname: '/attachments/[kind]/[id]', params: { kind, id } })}
    />
  );
}
