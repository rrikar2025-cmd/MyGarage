import { useEffect, useRef, useState } from 'react';
import { readVehicleVin, useOBD } from '@/entities/obd';
import { useTranslation } from '@/shared/i18n';
import { Button, Notice, Text } from '@/shared/ui';
export function ReadVin({
  disabled,
  onApply,
}: {
  disabled?: boolean;
  onApply: (vin: string) => void;
}) {
  const { t } = useTranslation();
  const connected = useOBD((s) => s.status === 'connected');
  const reading = useOBD((s) => s.reading);
  const [vin, setVin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!connected) setVin(null);
  }, [connected]);
  async function read() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    setVin(null);
    try {
      setVin(await readVehicleVin());
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        label={t('readVin')}
        variant="secondary"
        disabled={disabled || !connected || reading}
        busy={busy}
        onPress={() => void read()}
      />
      {!connected && (
        <Text muted variant="caption">
          {t('readVinHint')}
        </Text>
      )}
      {failed && <Notice tone="error">{t('vinUnavailable')}</Notice>}
      {vin && (
        <>
          <Text selectable>{vin}</Text>
          <Button
            label={t('applyVin')}
            variant="secondary"
            disabled={disabled || !connected}
            onPress={() => {
              onApply(vin);
              setVin(null);
            }}
          />
        </>
      )}
    </>
  );
}
