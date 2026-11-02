import { Directory, File, Paths } from 'expo-file-system';
import { cloudCoverCacheKey, cloudCoverOwnerPrefix } from './cover-cache-key';
import { validPreparedPhoto } from '../model/types';

type Identity = { owner: string; id: string; path: string };
const directory = () => new Directory(Paths.cache, 'private-vehicle-covers-v1');
const fileFor = (item: Identity) =>
  new File(directory(), `${cloudCoverCacheKey(item.owner, item.id, item.path)}.jpg`);

export async function readCachedCover(item: Identity) {
  const file = fileFor(item);
  if (!file.exists) return null;
  if (!validPreparedPhoto(await file.arrayBuffer())) {
    file.delete();
    return null;
  }
  return { uri: file.uri, release() {} };
}

export async function writeCachedCover(item: Identity, bytes: ArrayBuffer) {
  const dir = directory();
  dir.create({ intermediates: true, idempotent: true });
  const file = fileFor(item);
  file.create({ overwrite: true });
  try {
    file.write(new Uint8Array(bytes));
  } catch (error) {
    try {
      file.delete();
    } catch {}
    throw error;
  }
  return { uri: file.uri, release() {} };
}

export async function removeCachedCover(item: Identity) {
  const file = fileFor(item);
  if (file.exists) file.delete();
}

export async function clearCachedCovers(owner: string) {
  const prefix = cloudCoverOwnerPrefix(owner),
    dir = directory();
  if (!dir.exists) return;
  for (const file of dir.list()) {
    if (file instanceof File && file.name.startsWith(prefix)) file.delete();
  }
}
