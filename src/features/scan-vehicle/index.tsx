import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useGarage, useSelectedVehicle, type DiagnosticScan } from '@/entities/garage';
import { useOBD, readFaultCodes, disconnectAdapter, vinMismatch, CodeGroup } from '@/entities/obd';
import type { ScanMode } from '@/shared/types';
import { useTranslation } from '@/shared/i18n';
import { useUnsavedChanges } from '@/shared/navigation';
import { formatDate } from '@/shared/lib';
import { Text, Button, Card, Notice, Section, Choice, Toggle, Confirm } from '@/shared/ui';
export function ScanVehicle() {
  const { t, locale } = useTranslation();
  const vehicle = useSelectedVehicle();
  const connected = useOBD((s) => s.status === 'connected');
  const reading = useOBD((s) => s.reading);
  const clearedAt = useOBD((s) => s.codesClearedAt);
  const [mode, setMode] = useState<ScanMode>('all');
  const [includeVin, setIncludeVin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<DiagnosticScan | null>(null);
  const [capturedVehicle, setCapturedVehicle] = useState({ name: '', vin: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [confirmVin, setConfirmVin] = useState(false);
  const running = useRef(false);
  const guard = useUnsavedChanges(Boolean(snapshot && !saved), busy);
  useEffect(() => {
    useOBD.setState({ scanPending: Boolean(snapshot && !saved) });
    return () => {
      useOBD.setState({ scanPending: false });
    };
  }, [snapshot, saved]);
  async function save(result: DiagnosticScan) {
    try {
      await useGarage.getState().saveScan(result);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }
  async function scan() {
    if (!vehicle || !connected || running.current || reading) return;
    running.current = true;
    const vehicleId = vehicle.id;
    const generation = useGarage.getState().generation;
    setCapturedVehicle({ name: `${vehicle.make} ${vehicle.model}`, vin: vehicle.vin });
    setBusy(true);
    setError(false);
    setSnapshot(null);
    setSaved(false);
    try {
      const result = {
        id: randomUUID(),
        vehicle_id: vehicleId,
        created_at: new Date().toISOString(),
        ...(await readFaultCodes(mode, includeVin)),
      };
      if (generation !== useGarage.getState().generation) return;
      result.created_at = new Date().toISOString();
      setSnapshot(result);
      if (!vinMismatch(vehicle.vin, result.context.vin)) await save(result);
    } catch {
      setError(true);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function retrySave() {
    if (running.current || !snapshot) return;
    running.current = true;
    setBusy(true);
    setConfirmVin(false);
    try {
      await save(snapshot);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const mismatch = snapshot && vinMismatch(capturedVehicle.vin, snapshot.context?.vin);
  return (
    <Section title={t('diagnostics')}>
      <Text muted variant="caption">
        {t('scanHint')}
      </Text>
      <Choice
        label={t('scanMode')}
        value={mode}
        options={[
          { value: 'confirmed', label: t('scanConfirmedMode') },
          { value: 'all', label: t('scanAllMode') },
        ]}
        onChange={setMode}
        disabled={busy || reading}
      />
      <Toggle
        label={t('includeVin')}
        value={includeVin}
        onChange={setIncludeVin}
        disabled={busy || reading}
      />
      {vehicle ? (
        <Notice>
          {vehicle.make} {vehicle.model} · {t('scanVehicleHint')}
        </Notice>
      ) : (
        <Notice>{t('selectVehicleHint')}</Notice>
      )}
      <Button
        label={t(busy ? 'scanning' : 'scanCar')}
        icon="activity"
        busy={busy}
        disabled={!connected || !vehicle || reading || Boolean(snapshot && !saved)}
        onPress={() => void scan()}
      />
      {busy && reading && (
        <Button
          label={t('stopScan')}
          variant="secondary"
          onPress={() => void disconnectAdapter().catch(() => {})}
        />
      )}
      {error && <Notice tone="error">{t('scanFailed')}</Notice>}
      {snapshot && (
        <Card>
          <Text variant="heading">{t('scanComplete')}</Text>
          <Text>{capturedVehicle.name}</Text>
          <Text muted variant="caption">
            {formatDate(snapshot.created_at, locale)}
          </Text>
          {clearedAt && clearedAt > snapshot.created_at && (
            <Notice>{t('snapshotBeforeClear')}</Notice>
          )}
          {snapshot.context?.vin && <Text selectable>VIN: {snapshot.context.vin}</Text>}
          {mismatch && (
            <Notice tone="error">
              {t('vinMismatch')} {capturedVehicle.vin} → {snapshot.context?.vin}
            </Notice>
          )}
          {includeVin && snapshot.context?.vin_status === 'unavailable' && (
            <Notice>{t('vinUnavailable')}</Notice>
          )}
          {(['stored', 'pending', 'permanent'] as const).map((kind) => (
            <CodeGroup
              key={kind}
              kind={kind}
              codes={snapshot[kind]}
              status={snapshot.context?.statuses?.[kind]}
            />
          ))}
          <Notice>{t('scanScopeHint')}</Notice>
          {saved ? (
            <>
              <Notice tone="success">{t('scanSaved')}</Notice>
              <Button
                label={t('scanDetails')}
                variant="secondary"
                onPress={() => router.push(`/scan/${snapshot.id}`)}
              />
            </>
          ) : (
            <>
              <Notice tone={mismatch ? 'info' : 'error'}>
                {t(mismatch ? 'confirmScanVehicle' : 'scanUnsaved')}
              </Notice>
              <Button
                label={t('saveScan')}
                busy={busy}
                onPress={() => (mismatch ? setConfirmVin(true) : void retrySave())}
              />
            </>
          )}
        </Card>
      )}
      <Confirm
        visible={confirmVin}
        title={t('confirmScanVehicle')}
        body={`${capturedVehicle.name}\n${capturedVehicle.vin} → ${snapshot?.context?.vin ?? ''}\n\n${t('confirmScanVehicleBody')}`}
        action={t('saveScan')}
        busy={busy}
        onCancel={() => setConfirmVin(false)}
        onConfirm={() => void retrySave()}
      />
      {guard}
    </Section>
  );
}
