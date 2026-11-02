import { Image } from 'react-native';
import { useOBD } from '@/entities/obd';
import { useTranslation } from '@/shared/i18n';
import { radius } from '@/shared/theme';
import { Card, Text } from '@/shared/ui';

const adapterImage = require('../../../../assets/elm-327.jpg');

export function AdapterGuide() {
  const { t } = useTranslation();
  const status = useOBD((state) => state.status);
  if (status === 'connected') return null;

  return (
    <Card>
      <Text variant="heading">{t('adapterGuideTitle')}</Text>
      <Text muted>{t('adapterGuideBody')}</Text>
      <Image
        source={adapterImage}
        accessibilityLabel={t('adapterGuideImage')}
        resizeMode="contain"
        style={{ width: '100%', height: 180, borderRadius: radius.sm }}
      />
      <Text variant="caption" muted>
        {t('adapterGuideCompatibility')}
      </Text>
    </Card>
  );
}
