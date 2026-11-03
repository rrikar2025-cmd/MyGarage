import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  useGarage,
  validateVehicle,
  vehicleMakes,
  vehicleModels,
  vehicleYears,
  type VehicleInput,
  type Vehicle,
} from '@/entities/garage';
import { VehicleAutocomplete } from './VehicleAutocomplete';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { useUnsavedChanges } from '@/shared/navigation';
import { ReadVin } from '@/features/read-vin';
import {
  VehiclePhotoField,
  useVehiclePhotoDraft,
  useVehicleCovers,
  saveVehiclePhoto,
} from '@/features/manage-attachments';
import { Button, Card, Field, Notice, Screen, Loading, Text } from '@/shared/ui';
export function VehicleEditorPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useGarage((s) => s.vehicles.find((v) => v.id === id));
  const loading = useGarage((s) => s.loading);
  const owner = useGarage((s) => s.owner);
  const { t } = useTranslation();
  if (loading)
    return (
      <Screen title={t('garage')}>
        <Loading />
      </Screen>
    );
  if (id !== 'new' && !existing)
    return (
      <Screen title={t('garage')}>
        <Text>{t('noVehicleFound')}</Text>
        <Button label={t('garage')} onPress={() => router.replace('/garage')} />
      </Screen>
    );
  return <VehicleForm key={`${owner ?? 'guest'}:${id}`} existing={existing} />;
}
function VehicleForm({ existing }: { existing?: Vehicle }) {
  const { t } = useTranslation();
  const owner = useGarage((s) => s.owner);
  const photo = useVehiclePhotoDraft();
  const covers = useVehicleCovers(owner, existing ? [existing.id] : []);
  const saveLock = useRef(false);
  const first = useRef<TextInput>(null);
  const modelRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const mileageRef = useRef<TextInput>(null);
  const plateRef = useRef<TextInput>(null);
  const vinRef = useRef<TextInput>(null);
  const [draftId] = useState(randomUUID);
  const initial = {
    make: existing?.make ?? '',
    model: existing?.model ?? '',
    year: String(existing?.year ?? ''),
    mileage: String(existing?.mileage ?? ''),
    plate: existing?.plate ?? '',
    vin: existing?.vin ?? '',
  };
  const [form, setForm] = useState(initial);
  const [baseline] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [openOptions, setOpenOptions] = useState<'make' | 'model' | 'year' | null>(null);
  const guard = useUnsavedChanges(
    !saved && (JSON.stringify(form) !== baseline || Boolean(photo.photo)),
    busy || photo.busy,
  );
  useEffect(() => {
    if (saved) router.replace('/garage');
  }, [saved]);
  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChangeText: (value: string) => setForm((s) => ({ ...s, [name]: value })),
    editable: !busy && !photo.busy,
  });
  async function save() {
    if (saveLock.current || photo.busy) return;
    const input: VehicleInput = {
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year || NaN),
      mileage: Number(form.mileage || NaN),
      plate: form.plate.trim().toUpperCase(),
      vin: form.vin.trim().toUpperCase(),
    };
    const validation =
      validateVehicle(input) ?? (!/^\d{4}$/.test(form.year) ? 'validationYear' : null);
    if (validation) {
      setError(validation);
      const target =
        validation === 'validationYear'
          ? yearRef
          : validation === 'validationMileage'
            ? mileageRef
            : validation === 'validationVin'
              ? vinRef
              : validation === 'validationPlate'
                ? plateRef
                : !form.make.trim()
                  ? first
                  : modelRef;
      target.current?.focus();
      return;
    }
    saveLock.current = true;
    setBusy(true);
    setError(null);
    let vehicleSaved = false;
    try {
      await useGarage.getState().saveVehicle(input, existing?.id, draftId);
      vehicleSaved = true;
      if (photo.photo) await saveVehiclePhoto(owner, existing?.id ?? draftId, photo.photo);
      setSaved(true);
    } catch {
      setError(vehicleSaved && photo.photo ? 'vehiclePhotoSaveFailed' : 'saveFailed');
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen
      title={t(existing ? 'editVehicle' : 'addVehicle')}
      action={
        <Button
          label={t('back')}
          variant="ghost"
          onPress={() => router.back()}
          disabled={busy || photo.busy}
        />
      }
    >
      <VehiclePhotoField
        draft={photo}
        currentURI={existing ? covers[existing.id] : undefined}
        disabled={busy}
        cloud={Boolean(owner)}
      />
      {
        <Card>
          <VehicleAutocomplete
            ref={first}
            label={t('make')}
            placeholder={t('makePlaceholder')}
            maxLength={60}
            value={form.make}
            options={vehicleMakes}
            open={openOptions === 'make'}
            disabled={busy || photo.busy}
            onOpenChange={(open) => setOpenOptions(open ? 'make' : null)}
            onChange={(value) => setForm((s) => ({ ...s, make: value }))}
          />
          <VehicleAutocomplete
            ref={modelRef}
            label={t('model')}
            placeholder={t('modelPlaceholder')}
            maxLength={60}
            value={form.model}
            options={vehicleModels(form.make)}
            open={openOptions === 'model'}
            disabled={busy || photo.busy}
            onOpenChange={(open) => setOpenOptions(open ? 'model' : null)}
            onChange={(value) => setForm((s) => ({ ...s, model: value }))}
          />
          <VehicleAutocomplete
            ref={yearRef}
            label={t('year')}
            placeholder={t('yearPlaceholder')}
            keyboardType="number-pad"
            maxLength={4}
            value={form.year}
            options={vehicleYears}
            open={openOptions === 'year'}
            disabled={busy || photo.busy}
            onOpenChange={(open) => setOpenOptions(open ? 'year' : null)}
            onChange={(value) => setForm((s) => ({ ...s, year: value }))}
          />
          <Field
            ref={mileageRef}
            onFocus={() => setOpenOptions(null)}
            label={t('mileage')}
            placeholder={t('mileagePlaceholder')}
            keyboardType="number-pad"
            maxLength={8}
            {...field('mileage')}
          />
          <Field
            ref={plateRef}
            onFocus={() => setOpenOptions(null)}
            label={t('plate')}
            placeholder={t('platePlaceholder')}
            autoCapitalize="characters"
            maxLength={16}
            {...field('plate')}
          />
          <Field
            ref={vinRef}
            onFocus={() => setOpenOptions(null)}
            label={t('vin')}
            autoCapitalize="characters"
            maxLength={17}
            {...field('vin')}
          />
          <ReadVin
            disabled={busy || photo.busy}
            onApply={(vin) => setForm((current) => ({ ...current, vin }))}
          />
          {error && <Notice tone="error">{t(error)}</Notice>}
          <Button
            label={t('saveVehicle')}
            busy={busy}
            disabled={photo.busy}
            onPress={() => void save()}
          />
        </Card>
      }
      {guard}
    </Screen>
  );
}
