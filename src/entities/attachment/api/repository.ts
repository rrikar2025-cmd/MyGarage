import { latestVehiclePhotos } from '../model/vehicle-covers';
import { requireCloud } from '@/shared/api';
import {
  PRIVATE_MEDIA_BUCKET,
  targetColumns,
  validPreparedPhoto,
  type Attachment,
  type AttachmentTarget,
} from '../model/types';
async function ownerGuard(owner: string) {
  const { data } = await requireCloud().auth.getSession();
  if (data.session?.user.id !== owner) throw new Error('Attachment session changed');
}
export async function listAttachments(owner: string, target: AttachmentTarget) {
  await ownerGuard(owner);
  let query = requireCloud()
    .from('garage_attachments')
    .select('*')
    .eq('owner_id', owner)
    .eq('vehicle_id', target.vehicleId)
    .eq('kind', target.kind);
  if (target.kind !== 'vehicle')
    query = query.eq(
      (
        {
          fuel: 'fuel_id',
          service: 'service_id',
        } as const
      )[target.kind],
      target.id,
    );
  const { data, error } = await query.order('created_at').limit(10).returns<Attachment[]>();
  if (error) throw error;
  await ownerGuard(owner);
  return data;
}
export async function signedPhotoURLs(owner: string, items: Attachment[]) {
  await ownerGuard(owner);
  const paths = items.filter((i) => i.state === 'ready').map((i) => i.path);
  if (!paths.length) return {} as Record<string, string>;
  const { data, error } = await requireCloud()
    .storage.from(PRIVATE_MEDIA_BUCKET)
    .createSignedUrls(paths, 60);
  if (error) throw error;
  await ownerGuard(owner);
  return Object.fromEntries(
    (data ?? []).filter((i) => !i.error && i.signedUrl).map((i) => [i.path, i.signedUrl]),
  );
}
export async function uploadAttachment(
  owner: string,
  target: AttachmentTarget,
  id: string,
  bytes: ArrayBuffer,
  caption: string,
) {
  if (!validPreparedPhoto(bytes) || caption.length > 160) throw new Error('Invalid prepared photo');
  await ownerGuard(owner);
  const db = requireCloud();
  const existing = await db
    .from('garage_attachments')
    .select('*')
    .eq('id', id)
    .eq('owner_id', owner)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const expected = targetColumns(target);
    for (const key of Object.keys(expected) as (keyof typeof expected)[])
      if (existing.data[key] !== expected[key]) throw new Error('Photo target changed');
  }
  let path = existing.data?.path as string | undefined;
  if (!path) {
    const reserved = await db
      .from('garage_attachments')
      .insert({ id, owner_id: owner, ...targetColumns(target), caption: caption.trim() })
      .select('path')
      .single();
    if (reserved.error) throw reserved.error;
    path = reserved.data.path;
  }
  await ownerGuard(owner);
  const uploaded = await db.storage
    .from(PRIVATE_MEDIA_BUCKET)
    .upload(path!, bytes, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
  if (uploaded.error && String(uploaded.error.statusCode) !== '409') throw uploaded.error;
  await ownerGuard(owner);
  const finalized = await db.rpc('finalize_attachment', { p_id: id });
  if (finalized.error) throw finalized.error;
  await ownerGuard(owner);
}
export async function removeAttachment(owner: string, item: Pick<Attachment, 'id' | 'path'>) {
  await ownerGuard(owner);
  if (!item.path.startsWith(`${owner}/`)) throw new Error('Invalid photo owner');
  const db = requireCloud();
  const removed = await db.storage.from(PRIVATE_MEDIA_BUCKET).remove([item.path]);
  if (removed.error) throw removed.error;
  await ownerGuard(owner);
  const result = await db
    .from('garage_attachments')
    .delete()
    .eq('id', item.id)
    .eq('owner_id', owner);
  if (result.error) throw result.error;
}

export async function loadCloudVehicleCovers(owner: string, vehicleIds: string[]) {
  await ownerGuard(owner);
  if (!vehicleIds.length) return {} as Record<string, string>;
  const { data, error } = await requireCloud()
    .from('garage_attachments')
    .select('*')
    .eq('owner_id', owner)
    .eq('kind', 'vehicle')
    .eq('state', 'ready')
    .in('vehicle_id', vehicleIds)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(200)
    .returns<Attachment[]>();
  if (error) throw error;
  await ownerGuard(owner);
  const covers = latestVehiclePhotos(owner, vehicleIds, data);
  const urls = await signedPhotoURLs(owner, covers);
  return Object.fromEntries(
    covers.filter((row) => urls[row.path]).map((row) => [row.vehicle_id, urls[row.path]!]),
  );
}
