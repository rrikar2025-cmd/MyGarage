import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { requireCloud } from '@/shared/api';
import { useSession } from '@/entities/session';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { Card, Field, Button, Notice } from '@/shared/ui';
import { authErrorKey, validNewPassword } from '../lib/callback';
export function NewPassword() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const session = useSession((s) => s.session);
  const recoveryUser = useSession((s) => s.recoveryUser);
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    if (!validNewPassword(password, repeat)) {
      setMessage('newPasswordInvalid');
      return;
    }
    if (!session || session.user.id !== recoveryUser) {
      setMessage('linkInvalid');
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const auth = requireCloud().auth;
      const { error } = await auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setRepeat('');
      setSaved(true);
      useSession.getState().setRecovery(null);
      // Device-local logout: other sessions follow the server's password-change policy.
      await auth.signOut({ scope: 'local' });
    } catch (error) {
      setMessage(authErrorKey(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (saved)
    return (
      <Card>
        <Notice tone="success">{t('passwordChanged')}</Notice>
        <Button label={t('signIn')} onPress={() => router.replace('/auth')} />
      </Card>
    );
  if (!session || session.user.id !== recoveryUser)
    return (
      <Card>
        <Notice>{t('recoveryExpired')}</Notice>
        <Button label={t('forgotPassword')} onPress={() => router.replace('/auth/reset')} />
      </Card>
    );
  return (
    <Card>
      <Field
        label={t('newPassword')}
        value={password}
        onChangeText={setPassword}
        hint={t('passwordHint')}
        secret
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        editable={!busy}
      />
      <Field
        label={t('repeatPassword')}
        value={repeat}
        onChangeText={setRepeat}
        secret
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        editable={!busy}
      />
      {message && <Notice tone="error">{t(message)}</Notice>}
      <Button label={t('savePassword')} busy={busy} onPress={() => void submit()} />
    </Card>
  );
}
