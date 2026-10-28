import { router } from 'expo-router';
import { Screen, Button, Text } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen title={t('pageNotFound')}>
      <Text>{t('pageNotFoundHint')}</Text>
      <Button label={t('overview')} onPress={() => router.replace('/')} />
    </Screen>
  );
}
