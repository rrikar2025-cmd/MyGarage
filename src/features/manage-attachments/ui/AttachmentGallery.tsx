import { useVehicleCovers } from '../model/use-vehicle-covers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Platform } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useSession } from '@/entities/session';
import {
  listAttachments,
  signedPhotoURLs,
  uploadAttachment,
  removeAttachment,
  photoPath,
  type Attachment,
  type AttachmentTarget,
} from '@/entities/attachment';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import { useUnsavedChanges } from '@/shared/navigation';
import { Button, Card, Confirm, EmptyState, Field, Loading, Notice, Text } from '@/shared/ui';
import { pickPhoto, releasePhoto, type PreparedPhoto } from '../api/pick-photo';
import { AttachmentTile } from './AttachmentTile';
type Pending = PreparedPhoto & { id: string; caption: string };
export function AttachmentGallery({ target }: { target: AttachmentTarget }) {
  const { t } = useTranslation();
  const owner = useSession((s) => s.session?.user.id ?? null);
  const [items, setItems] = useState<Attachment[]>([]),
    [urls, setURLs] = useState<Record<string, string>>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<MessageKey | null>(null);
  const [caption, setCaption] = useState(''),
    [pending, setPending] = useState<Pending | null>(null),
    [removing, setRemoving] = useState<Pick<Attachment, 'id' | 'path' | 'caption'> | null>(null),
    [opened, setOpened] = useState<string | null>(null);
  const lock = useRef(false),
    generation = useRef(0),
    pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;
  const localCovers = useVehicleCovers(
    null,
    !owner && target.kind === 'vehicle' ? [target.id] : [],
  );
  const localCover = localCovers[target.id];
  const guard = useUnsavedChanges(Boolean(pending) || Boolean(caption.trim()), busy);
  const clearPending = () => {
    if (pendingRef.current) releasePhoto(pendingRef.current.uri);
    pendingRef.current = null;
    setPending(null);
  };
  useEffect(
    () => () => {
      if (pendingRef.current) releasePhoto(pendingRef.current.uri);
    },
    [],
  );
  const refresh = useCallback(
    async (gen: number) => {
      if (!owner) return;
      try {
        const rows = await listAttachments(owner, target);
        const links = await signedPhotoURLs(owner, rows);
        if (gen === generation.current) {
          setItems(rows);
          setURLs(links);
          setLoading(false);
          setError(null);
        }
      } catch {
        if (gen === generation.current) {
          setLoading(false);
          setError('photosLoadFailed');
        }
      }
    },
    [owner, target.kind, target.id, target.vehicleId],
  );
  useFocusEffect(
    useCallback(() => {
      const gen = ++generation.current;
      setItems([]);
      setURLs({});
      setOpened(null);
      setLoading(Boolean(owner));
      if (owner) void refresh(gen);
      const timer = setInterval(() => {
        if (owner && AppState.currentState === 'active' && !lock.current) void refresh(gen);
      }, 45000);
      return () => {
        generation.current++;
        clearInterval(timer);
        setURLs({});
        setOpened(null);
      };
    }, [refresh, owner]),
  );
  async function save(photo: Pending) {
    if (!owner) return;
    await uploadAttachment(owner, target, photo.id, photo.bytes, photo.caption);
    clearPending();
    setCaption('');
    await refresh(generation.current);
  }
  async function add(camera: boolean) {
    if (!owner || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const gen = generation.current;
    try {
      const photo = await pickPhoto(camera, target.kind === 'fuel' || target.kind === 'service');
      if (!photo) return;
      if (gen !== generation.current || useSession.getState().session?.user.id !== owner) {
        releasePhoto(photo.uri);
        return;
      }
      const draft = { ...photo, id: randomUUID(), caption: caption.trim() };
      pendingRef.current = draft;
      setPending(draft);
      await save(draft);
    } catch (error) {
      if (gen === generation.current)
        setError(
          error instanceof Error && error.message === 'PHOTO_PERMISSION'
            ? 'photoPermissionDenied'
            : error instanceof Error && error.message === 'PHOTO_TOO_LARGE'
              ? 'photoTooLarge'
              : pendingRef.current
                ? 'photoUploadFailed'
                : 'photoPickFailed',
        );
    } finally {
      lock.current = false;
      if (gen === generation.current) setBusy(false);
    }
  }
  async function retry() {
    if (!pending || !owner || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await save(pending);
    } catch {
      setError('photoUploadFailed');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (!owner || !removing || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await removeAttachment(owner, removing);
      if (pending?.id === removing.id) clearPending();
      setRemoving(null);
      await refresh(generation.current);
    } catch {
      setError('photoRemoveFailed');
      setRemoving(null);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!owner)
    return (
      <Card>
        {localCover && (
          <Image
            source={{ uri: localCover }}
            accessibilityLabel={t('vehiclePhoto')}
            style={{ width: '100%', height: 240 }}
            resizeMode="contain"
            onError={() => setError('photoPreviewFailed')}
          />
        )}
        {target.kind === 'vehicle' && <Notice>{t('photosLocalCoverHint')}</Notice>}
        {localCover && error && <Notice tone="error">{t(error)}</Notice>}
        {target.kind === 'vehicle' && (
          <Button
            label={t('editVehicle')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: target.id } })}
          />
        )}
        {target.kind !== 'vehicle' && <Notice>{t('photosCloudOnly')}</Notice>}
        <Button label={t('signIn')} onPress={() => router.push('/auth')} />
      </Card>
    );
  if (opened && urls[opened])
    return (
      <Card>
        <Image
          source={{ uri: urls[opened] }}
          onError={() => {
            setOpened(null);
            setError('photoPreviewFailed');
          }}
          accessibilityLabel={t('photoPreview')}
          style={{ width: '100%', height: 480 }}
          resizeMode="contain"
        />
        <Button label={t('close')} onPress={() => setOpened(null)} />
        {guard}
      </Card>
    );
  return (
    <>
      <Notice>{t('photosPrivacyHint')}</Notice>
      <Button
        label={t('photoRefresh')}
        icon="refresh-cw"
        variant="ghost"
        disabled={loading || busy}
        onPress={() => void refresh(generation.current)}
      />
      <Card>
        <Field
          label={t('photoCaption')}
          value={caption}
          onChangeText={setCaption}
          maxLength={160}
          editable={!busy && !pending}
        />
        <Button
          label={t('photoChoose')}
          icon="image"
          disabled={busy || loading || Boolean(pending) || items.length >= 10}
          onPress={() => void add(false)}
        />
        {Platform.OS !== 'web' && (
          <Button
            label={t('photoCamera')}
            icon="camera"
            variant="secondary"
            disabled={busy || loading || Boolean(pending) || items.length >= 10}
            onPress={() => void add(true)}
          />
        )}
        <Text muted variant="caption">
          {t('photosLimitHint')}
        </Text>
      </Card>
      {(loading || busy) && <Loading />}
      {error && <Notice tone="error">{t(error)}</Notice>}
      {error === 'photosLoadFailed' && (
        <Button
          label={t('retry')}
          disabled={busy}
          onPress={() => void refresh(generation.current)}
        />
      )}
      {pending && (
        <Card>
          <Image
            source={{ uri: pending.uri }}
            style={{ width: '100%', height: 160 }}
            accessibilityLabel={t('photoPreview')}
            resizeMode="contain"
          />
          <Notice>{t('photoPendingHint')}</Notice>
          <Button label={t('retry')} busy={busy} onPress={() => void retry()} />
          <Button
            label={t('photoDiscard')}
            variant="danger"
            disabled={busy}
            onPress={() =>
              setRemoving({
                id: pending.id,
                path: photoPath(owner, pending.id),
                caption: pending.caption,
              })
            }
          />
        </Card>
      )}
      {!loading && !items.length && !pending && (
        <EmptyState title={t('photosEmpty')} description={t('photosEmptyHint')} icon="image" />
      )}
      {items
        .filter((i) => i.id !== pending?.id)
        .map((item) => (
          <AttachmentTile
            key={item.id}
            item={item}
            url={urls[item.path]}
            busy={busy}
            onOpen={() => setOpened(item.path)}
            onRemove={() => setRemoving(item)}
          />
        ))}
      <Confirm
        visible={Boolean(removing)}
        title={t('photoRemove')}
        body={`${removing?.caption || t('photoPreview')}\n\n${t('photoRemoveBody')}`}
        action={t('photoRemove')}
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={() => void remove()}
      />
      {guard}
    </>
  );
}
