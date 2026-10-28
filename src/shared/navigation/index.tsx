import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useNavigation, usePreventRemove, type NavigationAction } from '@react-navigation/native';
import { Confirm } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
export function useUnsavedChanges(dirty: boolean, busy = false) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [pending, setPending] = useState<NavigationAction | null>(null);
  const [allow, setAllow] = useState(false);
  usePreventRemove((dirty && !allow) || busy, ({ data }) => {
    if (!busy) setPending(data.action);
  });
  useEffect(() => {
    if (allow && pending) navigation.dispatch(pending);
  }, [allow, pending, navigation]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  return (
    <Confirm
      visible={Boolean(pending)}
      title={t('unsavedTitle')}
      body={t('unsavedBody')}
      action={t('discard')}
      onCancel={() => setPending(null)}
      onConfirm={() => setAllow(true)}
    />
  );
}
