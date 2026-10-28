import { router } from 'expo-router';
import { DeleteAccount } from '@/features/authentication';
import { useTranslation } from '@/shared/i18n';
import { Button, Screen } from '@/shared/ui';
export function AccountDeletionPage() {
  const { t } = useTranslation();
  return (
    <Screen
      title={t('deleteAccount')}
      action={
        <Button label={t('back')} variant="ghost" onPress={() => router.replace('/settings')} />
      }
    >
      <DeleteAccount />
    </Screen>
  );
}
