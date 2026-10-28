import { Directory, File, Paths } from 'expo-file-system';
import { storage } from '../lib/storage';
import {
  COVER_PREFIX,
  coverKey,
  coverFilename,
  validCoverFilename,
  type LocalVehicleCovers,
} from './types';
const folder = () => new Directory(Paths.document, 'vehicle-covers');
function removeFile(name: string | null, vehicleId: string) {
  if (!name || !validCoverFilename(name, vehicleId)) return;
  try {
    const file = new File(folder(), name);
    if (file.exists) file.delete();
  } catch {}
}
export async function saveLocalVehicleCover(
  vehicleId: string,
  photoId: string,
  bytes: ArrayBuffer,
) {
  const key = coverKey(vehicleId),
    name = coverFilename(vehicleId, photoId);
  const previous = await storage.getItem(key);
  if (previous === name && new File(folder(), name).exists) return;
  const directory = folder();
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, name);
  try {
    file.create({ overwrite: true });
    file.write(new Uint8Array(bytes));
    await storage.setItem(key, name);
  } catch (error) {
    removeFile(name, vehicleId);
    throw error;
  }
  if (previous !== name) removeFile(previous, vehicleId);
}
export async function loadLocalVehicleCovers(ids: string[]): Promise<LocalVehicleCovers> {
  const values = await storage.multiGet(ids.map(coverKey));
  const urls: Record<string, string> = {};
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!,
      name = values[i]?.[1];
    if (name && validCoverFilename(name, id)) {
      const file = new File(folder(), name);
      if (file.exists) urls[id] = file.uri;
    }
  }
  return { urls, release() {} };
}
export async function removeLocalVehicleCover(vehicleId: string) {
  const key = coverKey(vehicleId),
    previous = await storage.getItem(key);
  await storage.removeItem(key);
  removeFile(previous, vehicleId);
}
export async function pruneLocalVehicleCovers(ids: string[]) {
  const allowed = new Set(ids.map(coverKey));
  const keys = (await storage.getAllKeys()).filter(
    (key) => key.startsWith(COVER_PREFIX) && !allowed.has(key),
  );
  await Promise.all(keys.map((key) => removeLocalVehicleCover(key.slice(COVER_PREFIX.length))));
}
