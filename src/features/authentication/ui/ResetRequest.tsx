import { useRef, useState } from 'react';
import { requireCloud, assertPKCECrypto } from '@/shared/api';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { Card, Field, Button, Notice } from '@/shared/ui';
import { authRedirectURL } from '../model/links';
import { authErrorKey, validEmail } from '../lib/callback';
export function ResetRequest() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    if (!validEmail(email)) {
      setMessage('emailInvalid');
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      assertPKCECrypto();
      const { error } = await requireCloud().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectURL(),
      });
      if (error) throw error;
      setMessage('resetSent');
    } catch (error) {
      setMessage(authErrorKey(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Card>
      <Notice>{t('resetInfo')}</Notice>
      <Field
        label={t('email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!busy}
      />
      {message && (
        <Notice tone={message === 'resetSent' ? 'success' : 'error'}>{t(message)}</Notice>
      )}
      <Button label={t('sendReset')} busy={busy} onPress={() => void submit()} />
    </Card>
  );
}
