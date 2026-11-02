import { cloudCoverCacheKey, cloudCoverOwnerPrefix } from './cover-cache-key';

type Identity = { owner: string; id: string; path: string };
function key(item: Identity) {
  return cloudCoverCacheKey(item.owner, item.id, item.path);
}
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Cache unavailable'));
    const request = indexedDB.open('mygarage-private-cloud-covers-v1', 1);
    let rejected = false;
    request.onupgradeneeded = () => request.result.createObjectStore('covers');
    request.onsuccess = () => {
      if (rejected) request.result.close();
      else resolve(request.result);
    };
    request.onerror = request.onblocked = () => {
      rejected = true;
      reject(new Error('Cache unavailable'));
    };
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('covers', mode),
        request = run(tx.objectStore('covers'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('Cache unavailable'));
    });
  } finally {
    db.close();
  }
}
function reference(blob: Blob) {
  const uri = URL.createObjectURL(blob);
  return { uri, release: () => URL.revokeObjectURL(uri) };
}
export async function readCachedCover(item: Identity) {
  const blob = await transaction('readonly', (store) => store.get(key(item)));
  return blob instanceof Blob ? reference(blob) : null;
}
export async function writeCachedCover(item: Identity, bytes: ArrayBuffer) {
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  await transaction('readwrite', (store) => store.put(blob, key(item)));
  return reference(blob);
}
export async function removeCachedCover(item: Identity) {
  await transaction('readwrite', (store) => store.delete(key(item)));
}
export async function clearCachedCovers(owner: string) {
  const prefix = cloudCoverOwnerPrefix(owner);
  const keys = await transaction('readonly', (store) => store.getAllKeys());
  for (const item of keys) {
    if (typeof item === 'string' && item.startsWith(prefix))
      await transaction('readwrite', (store) => store.delete(item));
  }
}
