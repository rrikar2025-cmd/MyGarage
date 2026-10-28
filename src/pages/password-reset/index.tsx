import { router } from 'expo-router';
import { NewPassword, ResetRequest } from '@/features/authentication';
import { isCloudConfigured } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { Button, Notice, Screen } from '@/shared/ui';
export function PasswordResetPage({ update = false }: { update?: boolean }) {
  const { t } = useTranslation();
  return (
    <Screen
      title={t(update ? 'newPassword' : 'forgotPassword')}
      action={<Button label={t('back')} variant="ghost" onPress={() => router.replace('/auth')} />}
    >
      {!isCloudConfigured ? (
        <Notice>{t('cloudUnavailable')}</Notice>
      ) : update ? (
        <NewPassword />
      ) : (
        <ResetRequest />
      )}
    </Screen>
  );
}
