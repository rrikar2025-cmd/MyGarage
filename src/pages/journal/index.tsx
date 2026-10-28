import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useGarage, useSelectedVehicle, type JournalEntry, JournalRow } from '@/entities/garage';
import { ExpenseSummary } from '@/widgets/expense-summary';
import { useTranslation } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib';
import {
  Button,
  Card,
  Confirm,
  EmptyState,
  ErrorState,
  Loading,
  Notice,
  Screen,
  Text,
  Icon,
} from '@/shared/ui';
export function JournalPage() {
  const { t, locale } = useTranslation();
  const vehicle = useSelectedVehicle();
  const state = useGarage();
  const [filter, setFilter] = useState<'all' | 'fuel' | 'service'>('all');
  const [limit, setLimit] = useState(20);
  const [deleting, setDeleting] = useState<JournalEntry | null>(null);
  const [failed, setFailed] = useState(false);
  const entries = useMemo<JournalEntry[]>(
    () =>
      [
        ...state.fuel
          .filter((x) => x.vehicle_id === vehicle?.id)
          .map((data) => ({ kind: 'fuel' as const, data })),
        ...state.service
          .filter((x) => x.vehicle_id === vehicle?.id)
          .map((data) => ({ kind: 'service' as const, data })),
      ]
        .filter((x) => filter === 'all' || x.kind === filter)
        .sort(
          (a, b) =>
            b.data.date.localeCompare(a.data.date) ||
            b.data.created_at.localeCompare(a.data.created_at),
        ),
    [state.fuel, state.service, vehicle?.id, filter],
  );
  async function remove() {
    if (!deleting) return;
    setFailed(false);
    try {
      await state.deleteEntry(deleting.kind, deleting.data.id);
      setDeleting(null);
    } catch {
      setFailed(true);
    }
  }
  return (
    <Screen
      title={t('journal')}
      subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : undefined}
    >
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorState onRetry={() => void state.load(state.owner)} />
      ) : !vehicle ? (
        <EmptyState title={t('selectVehicle')} description={t('selectVehicleHint')} icon="truck">
          <Button label={t('garage')} onPress={() => router.navigate('/garage')} />
        </EmptyState>
      ) : (
        <>
          <ExpenseSummary vehicleId={vehicle.id} />
          <Button
            label={t('serviceCalendar')}
            icon="calendar"
            variant="secondary"
            onPress={() => router.push('/service')}
          />
          <View style={{ gap: 12 }}>
            <Button
              label={t('addFuel')}
              icon="droplet"
              onPress={() => router.push('/entry/fuel')}
            />
            <Button
              label={t('addService')}
              icon="tool"
              variant="secondary"
              onPress={() => router.push('/entry/service')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['all', 'fuel', 'service'] as const).map((kind) => (
              <Button
                key={kind}
                label={t(kind)}
                accessibilityState={{ selected: filter === kind }}
                variant={filter === kind ? 'secondary' : 'ghost'}
                onPress={() => {
                  setFilter(kind);
                  setLimit(20);
                }}
              />
            ))}
          </View>
          {!entries.length && (
            <EmptyState title={t('noEntries')} description={t('noEntriesBody')} icon="book-open" />
          )}
          {entries.slice(0, limit).map((entry) => (
            <JournalRow
              key={`${entry.kind}-${entry.data.id}`}
              entry={entry}
              onEdit={() =>
                router.push({
                  pathname: '/entry/[kind]',
                  params: { kind: entry.kind, id: entry.data.id },
                })
              }
              onPhotos={() =>
                router.push({
                  pathname: '/attachments/[kind]/[id]',
                  params: { kind: entry.kind, id: entry.data.id },
                })
              }
              onDelete={() => setDeleting(entry)}
            />
          ))}
          {entries.length > limit && (
            <Button
              label={`${t('more')} (${entries.length - limit})`}
              variant="secondary"
              onPress={() => setLimit((n) => n + 20)}
            />
          )}
        </>
      )}
      {failed && <Notice tone="error">{t('saveFailed')}</Notice>}
      <Confirm
        visible={Boolean(deleting)}
        title={t('deleteEntry')}
        body={`${deleting?.data.date ?? ''} · ${formatNumber(deleting?.data.total ?? 0, locale, 2, 2)} ₴. ${t('deleteEntryBody')}`}
        action={t('delete')}
        busy={state.busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}
