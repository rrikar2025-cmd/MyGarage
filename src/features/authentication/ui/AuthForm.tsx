import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { requireCloud, assertPKCECrypto } from '@/shared/api';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { Card, Field, Button, Notice } from '@/shared/ui';
import { authRedirectURL } from '../model/links';
import { authErrorKey, validEmail } from '../lib/callback';
export function AuthForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [success, setSuccess] = useState(false);
  async function submit(resend = false) {
    if (lock.current) return;
    if (!validEmail(email) || (!resend && (mode === 'signUp' ? password.length < 8 : !password))) {
      setSuccess(false);
      setMessage(mode === 'signUp' ? 'authInvalid' : 'signInInvalid');
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage(null);
    setSuccess(false);
    try {
      if (resend || mode === 'signUp') assertPKCECrypto();
      const auth = requireCloud().auth;
      if (resend) {
        const result = await auth.resend({
          type: 'signup',
          email: email.trim(),
          options: { emailRedirectTo: authRedirectURL() },
        });
        if (result.error) throw result.error;
        setSuccess(true);
        setMessage('confirmEmail');
        return;
      }
      const result =
        mode === 'signIn'
          ? await auth.signInWithPassword({ email: email.trim(), password })
          : await auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: authRedirectURL() },
            });
      if (result.error) throw result.error;
      setPassword('');
      if (!result.data.session) {
        setSuccess(true);
        setMessage('confirmEmail');
      } else router.replace('/settings');
    } catch (error) {
      setPassword('');
      setMessage(authErrorKey(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Card>
      <Field
        label={t('email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        editable={!busy}
      />
      <Field
        label={t('password')}
        value={password}
        onChangeText={setPassword}
        secret
        autoCapitalize="none"
        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
        textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
        hint={mode === 'signUp' ? t('passwordHint') : undefined}
        editable={!busy}
      />
      {message && <Notice tone={success ? 'success' : 'error'}>{t(message)}</Notice>}
      <Button label={t(mode)} busy={busy} onPress={() => void submit()} />
      {(message === 'confirmEmail' || message === 'emailNotConfirmed') && (
        <Button
          label={t('resendEmail')}
          variant="secondary"
          disabled={busy}
          onPress={() => void submit(true)}
        />
      )}
      <Button
        label={t('forgotPassword')}
        variant="ghost"
        disabled={busy}
        onPress={() => router.push('/auth/reset')}
      />
      <Button
        label={t(mode === 'signIn' ? 'signUp' : 'signIn')}
        variant="ghost"
        disabled={busy}
        onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setMessage(null);
          setPassword('');
        }}
      />
    </Card>
  );
}
