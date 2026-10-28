import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  buildJournalCsv,
  type JournalEntry,
  type Vehicle,
  type DateRange,
} from '@/entities/garage';
import { exportTextFile } from '@/shared/export';
import { useTranslation } from '@/shared/i18n';
import { Button, Notice, Text } from '@/shared/ui';
export function ExportJournal({
  entries,
  vehicle,
  range,
}: {
  entries: JournalEntry[];
  vehicle: Vehicle;
  range: DateRange;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function exportRows() {
    if (busy || !entries.length) return;
    setBusy(true);
    setError(false);
    const operation = new AbortController();
    controller.current = operation;
    try {
      const content = buildJournalCsv(entries, vehicle, {
        vehicle: t('vehicle'),
        date: t('dateColumn'),
        kind: t('recordType'),
        description: t('description'),
        odometer: t('odometer'),
        liters: t('liters'),
        total: t('amount'),
        currency: t('currency'),
        fuelType: t('fuelType'),
        fullTank: t('fullTankColumn'),
        nextOdometer: t('nextMileageColumn'),
        nextDate: t('nextDateColumn'),
        notes: t('notes'),
        fuel: t('fuel'),
        service: t('service'),
        yes: t('yes'),
        no: t('no'),
        fuelTypes: {
          petrol: t('petrol'),
          diesel: t('diesel'),
          lpg: t('lpg'),
          other: t('other'),
          unknown: t('unknown'),
        },
      });
      await exportTextFile(
        `my-garage-${range.from}-${range.to}.csv`,
        content,
        t('exportCsv'),
        operation.signal,
      );
    } catch {
      if (!operation.signal.aborted) setError(true);
    } finally {
      if (!operation.signal.aborted) setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Button
        label={t('exportCsv')}
        icon="download"
        variant="secondary"
        busy={busy}
        disabled={!entries.length}
        onPress={() => void exportRows()}
      />
      <Text variant="caption" muted>
        {t('exportHint')}
      </Text>
      {error && <Notice tone="error">{t('exportFailed')}</Notice>}
    </View>
  );
}
