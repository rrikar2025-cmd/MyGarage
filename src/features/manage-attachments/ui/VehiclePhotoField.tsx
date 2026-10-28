import { useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { useTranslation } from '@/shared/i18n';
import { radius } from '@/shared/theme';
import { Button, Card, Notice, Text } from '@/shared/ui';
import { CarDrawing } from '@/entities/garage';
import { useTheme } from '@/shared/theme';
import type { useVehiclePhotoDraft } from '../model/use-vehicle-photo-draft';
type Draft = ReturnType<typeof useVehiclePhotoDraft>;
export function VehiclePhotoField({
  draft,
  currentURI,
  disabled,
  cloud,
}: {
  draft: Draft;
  currentURI?: string;
  disabled: boolean;
  cloud: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [failedURI, setFailedURI] = useState<string | null>(null);
  const uri = draft.photo?.uri ?? currentURI;
  return (
    <Card>
      <Text variant="heading">{t('vehiclePhoto')}</Text>
      <View
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: radius.sm,
          backgroundColor: colors.inset,
        }}
      >
        {uri && failedURI !== uri ? (
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityLabel={t('vehiclePhoto')}
            onError={() => setFailedURI(uri)}
          />
        ) : (
          <CarDrawing color={colors.primary} />
        )}
      </View>
      <Text muted variant="caption">
        {t(cloud ? 'vehiclePhotoCloudHint' : 'vehiclePhotoLocalHint')}
      </Text>
      <Button
        label={t(uri ? 'vehiclePhotoReplace' : 'photoChoose')}
        icon="image"
        variant="secondary"
        busy={draft.busy}
        disabled={disabled}
        onPress={() => void draft.choose(false)}
      />
      {Platform.OS !== 'web' && (
        <Button
          label={t('photoCamera')}
          variant="ghost"
          icon="camera"
          disabled={disabled || draft.busy}
          onPress={() => void draft.choose(true)}
        />
      )}
      {draft.photo && (
        <Button
          label={t('vehiclePhotoCancelSelection')}
          variant="ghost"
          disabled={disabled || draft.busy}
          onPress={draft.clear}
        />
      )}
      {draft.error && <Notice tone="error">{t(draft.error)}</Notice>}
      {uri && failedURI === uri && <Notice tone="error">{t('photoPreviewFailed')}</Notice>}
    </Card>
  );
}
