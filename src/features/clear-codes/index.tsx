import { useEffect, useRef, useState } from 'react';
import { clearVehicleCodes, useOBD } from '@/entities/obd';
import { useSelectedVehicle } from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
import { useUnsavedChanges } from '@/shared/navigation';
import { Button, Card, Confirm, Notice, Text, Toggle } from '@/shared/ui';
export function ClearCodes() {
  const { t } = useTranslation();
  const connected = useOBD((s) => s.status === 'connected');
  const reading = useOBD((s) => s.reading);
  const pending = useOBD((s) => s.scanPending);
  const vehicle = useSelectedVehicle();
  const [confirmed, setConfirmed] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const lock = useRef(false);
  const device = useOBD((s) => s.deviceName);
  useEffect(() => {
    setConfirmed(false);
    setDialog(false);
    setResult(null);
  }, [connected, device, vehicle?.id]);
  const guard = useUnsavedChanges(false, busy);
  async function clear() {
    if (lock.current || !connected || !confirmed || pending) return;
    lock.current = true;
    setBusy(true);
    setResult(null);
    try {
      await clearVehicleCodes();
      useOBD.setState({ codesClearedAt: new Date().toISOString() });
      setResult('success');
      setConfirmed(false);
    } catch {
      setResult('error');
    } finally {
      lock.current = false;
      setBusy(false);
      setDialog(false);
    }
  }
  return (
    <Card>
      <Text variant="heading">{t('clearCodes')}</Text>
      <Text muted variant="caption">
        {t('clearCodesHint')}
      </Text>
      <Toggle
        label={t('clearConditions')}
        value={confirmed}
        disabled={!connected || busy || pending}
        onChange={setConfirmed}
      />
      {pending && <Notice>{t('saveBeforeClear')}</Notice>}
      <Button
        label={t('clearCodes')}
        variant="danger"
        disabled={!vehicle || !connected || reading || !confirmed || pending}
        busy={busy}
        onPress={() => setDialog(true)}
      />
      {result && (
        <Notice tone={result}>
          {t(result === 'success' ? 'clearAcknowledged' : 'clearFailed')}
        </Notice>
      )}
      <Confirm
        visible={dialog}
        title={t('clearCodes')}
        body={`${vehicle?.make ?? ''} ${vehicle?.model ?? ''}\n\n${t('clearCodesBody')}`}
        action={t('sendClearCommand')}
        busy={busy}
        onCancel={() => setDialog(false)}
        onConfirm={() => void clear()}
      />
      {guard}
    </Card>
  );
}
