import { router } from 'expo-router';
import { useAuthLink, consumeAuthLink } from '@/features/authentication';
import { useTranslation } from '@/shared/i18n';
import { Button, Card, Loading, Notice, Screen } from '@/shared/ui';
export function AuthCallbackPage() {
  const { t } = useTranslation();
  const { status, recovery } = useAuthLink();
  return (
    <Screen title={t('emailLinkTitle')}>
      <Card>
        {status === 'empty' ? (
          <Loading />
        ) : status === 'pending' || status === 'busy' ? (
          <>
            <Notice>{t('emailLinkBody')}</Notice>
            <Button
              label={t('continueAuth')}
              busy={status === 'busy'}
              onPress={() => void consumeAuthLink()}
            />
          </>
        ) : status === 'success' ? (
          <>
            <Notice tone="success">{t(recovery ? 'recoveryVerified' : 'emailConfirmed')}</Notice>
            <Button
              label={t(recovery ? 'newPassword' : 'openGarage')}
              onPress={() => router.replace(recovery ? '/auth/password' : '/settings')}
            />
          </>
        ) : (
          <>
            <Notice tone="error">{t('linkInvalid')}</Notice>
            <Button label={t('forgotPassword')} onPress={() => router.replace('/auth/reset')} />
            <Button
              label={t('signIn')}
              variant="secondary"
              onPress={() => router.replace('/auth')}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}
