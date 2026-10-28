import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { storage, createSerialQueue } from '@/shared/lib';
const run = createSerialQueue();
type Manifest = { id: string; count: number };
async function readManifest(key: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(`${key}.manifest`);
  if (!raw) return null;
  const value = JSON.parse(raw) as Manifest;
  if (
    !/^[a-zA-Z0-9-]+$/.test(value.id) ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 500
  )
    throw new Error('Invalid session storage');
  return value;
}
async function removeChunks(key: string, manifest: Manifest | null) {
  if (manifest)
    await Promise.all(
      Array.from({ length: manifest.count }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}.${manifest.id}.${i}`),
      ),
    );
}
const nativeStorage = {
  getItem: (key: string) =>
    run(async () => {
      const manifest = await readManifest(key);
      if (!manifest) return null;
      const chunks = await Promise.all(
        Array.from({ length: manifest.count }, (_, i) =>
          SecureStore.getItemAsync(`${key}.${manifest.id}.${i}`),
        ),
      );
      if (chunks.some((x) => x === null)) throw new Error('Incomplete session');
      return chunks.join('');
    }),
  setItem: (key: string, value: string) =>
    run(async () => {
      const previous = await readManifest(key);
      const id = randomUUID();
      const chunks = value.match(/[\s\S]{1,450}/g) ?? [''];
      if (chunks.length > 500) throw new Error('Session is too large');
      const next = { id, count: chunks.length };
      try {
        await Promise.all(
          chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${id}.${i}`, chunk)),
        );
        await SecureStore.setItemAsync(`${key}.manifest`, JSON.stringify(next));
      } catch (error) {
        await removeChunks(key, next).catch(() => {});
        throw error;
      }
      await removeChunks(key, previous).catch(() => {});
    }),
  removeItem: (key: string) =>
    run(async () => {
      const previous = await readManifest(key);
      await SecureStore.deleteItemAsync(`${key}.manifest`);
      await removeChunks(key, previous).catch(() => {});
    }),
};
export const authStorage = Platform.OS === 'web' ? storage : nativeStorage;
