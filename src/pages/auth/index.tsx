import { router } from 'expo-router';
import { AuthForm } from '@/features/authentication';
import { useSession } from '@/entities/session';
import { isCloudConfigured } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { Screen, Button, Notice } from '@/shared/ui';
export function AuthPage() {
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  return (
    <Screen
      title={t('authIntro')}
      subtitle={t('authBody')}
      action={<Button label={t('back')} variant="ghost" onPress={() => router.back()} />}
    >
      {session ? (
        <Button label={t('settings')} onPress={() => router.replace('/settings')} />
      ) : isCloudConfigured ? (
        <AuthForm />
      ) : (
        <Notice>{t('cloudUnavailable')}</Notice>
      )}
    </Screen>
  );
}
