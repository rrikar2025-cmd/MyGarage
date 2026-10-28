import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AttachmentButton, useVehicleCovers } from '@/features/manage-attachments';
import { useGarage, VehicleCard } from '@/entities/garage';
import { useTranslation } from '@/shared/i18n';
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
} from '@/shared/ui';
export function GaragePage() {
  const { t } = useTranslation();
  const state = useGarage();
  const covers = useVehicleCovers(
    state.owner,
    state.vehicles.map((v) => v.id),
  );
  const [deleting, setDeleting] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const vehicle = state.vehicles.find((v) => v.id === deleting);
  async function remove() {
    if (!deleting) return;
    setFailed(false);
    try {
      await state.deleteVehicle(deleting);
      setDeleting(null);
    } catch {
      setFailed(true);
    }
  }
  return (
    <Screen title={t('garage')} subtitle={t(state.owner ? 'cloudMode' : 'localMode')}>
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorState onRetry={() => void state.load(state.owner)} />
      ) : (
        <>
          <Button label={t('addVehicle')} icon="plus" onPress={() => router.push('/vehicle/new')} />
          {!state.vehicles.length && (
            <EmptyState title={t('noVehicles')} description={t('noVehiclesBody')} icon="truck" />
          )}
          {state.vehicles.map((v) => (
            <View key={v.id} style={{ gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('select')}: ${v.make} ${v.model}`}
                accessibilityState={{ selected: v.id === state.selectedId }}
                onPress={() => state.select(v.id)}
              >
                <VehicleCard
                  vehicle={v}
                  selected={v.id === state.selectedId}
                  photoURI={covers[v.id]}
                />
              </Pressable>
              <Card style={{ padding: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('edit')}
                      variant="ghost"
                      icon="edit-2"
                      onPress={() =>
                        router.push({ pathname: '/vehicle/[id]', params: { id: v.id } })
                      }
                    />
                  </View>
                  <Button label={t('delete')} variant="danger" onPress={() => setDeleting(v.id)} />
                </View>

                <AttachmentButton kind="vehicle" id={v.id} />
                {v.id === state.selectedId && (
                  <Text variant="caption" style={{ textAlign: 'center' }}>
                    {t('activeVehicle')}
                  </Text>
                )}
              </Card>
            </View>
          ))}
        </>
      )}
      {failed && <Notice tone="error">{t('saveFailed')}</Notice>}
      <Confirm
        visible={Boolean(deleting)}
        title={t('deleteVehicle')}
        body={`${vehicle?.make ?? ''} ${vehicle?.model ?? ''}. ${t('deleteVehicleBody')} ${t('deleteScanScope')}`}
        action={t('deleteVehicleAction')}
        busy={state.busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </Screen>
  );
}
