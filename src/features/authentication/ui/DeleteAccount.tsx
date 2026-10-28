import { deleteAccountWithPassword } from '../lib/delete-account';
import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { requireCloud } from '@/shared/api';
import { useSession } from '@/entities/session';
import { useGarage } from '@/entities/garage';
import { disconnectAdapter } from '@/entities/obd';
import { useTranslation } from '@/shared/i18n';
import { useUnsavedChanges } from '@/shared/navigation';
import { Card, Field, Button, Confirm, Notice, Text } from '@/shared/ui';
export function DeleteAccount() {
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const lock = useRef(false);
  const navigationGuard = useUnsavedChanges(false, busy);
  const allowed = Boolean(session?.user.email && password && word.trim() === t('deleteWord'));
  async function remove() {
    if (lock.current || !allowed || !session?.user.email) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const cloud = requireCloud();
      await deleteAccountWithPassword(cloud, session.user.id, password);
      // Immediately invalidate in-flight reads and erase private data before signing out.
      useGarage.getState().clear();
      useSession.getState().set(null);
      setPassword('');
      setWord('');
      setConfirm(false);
      setDeleted(true);
      await disconnectAdapter().catch(() => {});
      await cloud.auth.signOut({ scope: 'local' });
    } catch {
      setPassword('');
      setConfirm(false);
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (deleted)
    return (
      <Card>
        <Notice tone="success">{t('accountDeleted')}</Notice>
        <Button label={t('openGarage')} onPress={() => router.replace('/')} />
      </Card>
    );
  if (!session)
    return (
      <Card>
        <Notice>{t('deleteRequiresAccount')}</Notice>
        <Button label={t('signIn')} onPress={() => router.replace('/auth')} />
      </Card>
    );
  return (
    <>
      <Card>
        <Text style={{ fontWeight: '700' }}>{session.user.email}</Text>
        <Notice>{t('deleteAccountScope')}</Notice>
        <Field
          label={t('currentPassword')}
          value={password}
          onChangeText={setPassword}
          secret
          autoComplete="current-password"
          textContentType="password"
          autoCapitalize="none"
          editable={!busy}
        />
        <Field
          label={t('deleteWordLabel')}
          hint={t('deleteWordHint')}
          value={word}
          onChangeText={setWord}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
        />
        {failed && <Notice tone="error">{t('deleteAccountFailed')}</Notice>}
        <Button
          label={t('deleteAccount')}
          variant="danger"
          disabled={!allowed}
          busy={busy}
          onPress={() => setConfirm(true)}
        />
      </Card>
      <Confirm
        visible={confirm}
        title={t('deleteAccount')}
        body={`${session.user.email}\n\n${t('deleteAccountBody')}`}
        action={t('deletePermanently')}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void remove()}
      />
      {navigationGuard}
    </>
  );
}
