import { coverKey, type LocalVehicleCovers } from './types';
let database: Promise<IDBDatabase> | undefined;
function open() {
  if (typeof indexedDB === 'undefined')
    return Promise.reject<IDBDatabase>(new Error('Local photo storage unavailable'));
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    let rejected = false;
    const request = indexedDB.open('mygarage-private-guest-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('covers');
    request.onsuccess = () => {
      if (rejected) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => {
        request.result.close();
        database = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      rejected = true;
      database = undefined;
      reject(new Error('Local photo storage unavailable'));
    };
    request.onblocked = () => {
      rejected = true;
      database = undefined;
      reject(new Error('Local photo storage blocked'));
    };
  }));
}
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('covers', mode);
    const request = run(tx.objectStore('covers'));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = tx.onerror = () => reject(new Error('Local photo could not be stored'));
  });
}
export async function saveLocalVehicleCover(
  vehicleId: string,
  _photoId: string,
  bytes: ArrayBuffer,
) {
  await transaction('readwrite', (store) =>
    store.put(new Blob([bytes], { type: 'image/jpeg' }), coverKey(vehicleId)),
  );
}
export async function loadLocalVehicleCovers(ids: string[]): Promise<LocalVehicleCovers> {
  if (!ids.length) return { urls: {}, release() {} };
  const keys = ids.map(coverKey),
    db = await open();
  const blobs = await new Promise<(Blob | undefined)[]>((resolve, reject) => {
    const tx = db.transaction('covers', 'readonly'),
      store = tx.objectStore('covers');
    const values: (Blob | undefined)[] = [];
    keys.forEach((key, i) => {
      const request = store.get(key);
      request.onsuccess = () => {
        values[i] = request.result;
      };
    });
    tx.oncomplete = () => resolve(values);
    tx.onabort = tx.onerror = () => reject(new Error('Local photo could not be read'));
  });
  const urls: Record<string, string> = {};
  ids.forEach((id, i) => {
    const blob = blobs[i];
    if (blob instanceof Blob) urls[id] = URL.createObjectURL(blob);
  });
  return { urls, release: () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url)) };
}
export async function removeLocalVehicleCover(vehicleId: string) {
  await transaction('readwrite', (store) => store.delete(coverKey(vehicleId)));
}
export async function pruneLocalVehicleCovers(ids: string[]) {
  const allowed = new Set(ids.map(coverKey));
  const keys = await transaction('readonly', (store) => store.getAllKeys());
  for (const key of keys)
    if (typeof key === 'string' && !allowed.has(key))
      await transaction('readwrite', (store) => store.delete(key));
}
