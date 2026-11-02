import test from 'node:test';
import assert from 'node:assert/strict';
import { latestVehiclePhotos } from '../src/entities/attachment/model/vehicle-covers';
import { coverFilename, validCoverFilename, coverKey } from '../src/shared/media/types';
import type { Attachment } from '../src/entities/attachment/model/types';
import {
  cloudCoverCacheKey,
  cloudCoverOwnerPrefix,
} from '../src/entities/attachment/api/cover-cache-key';
const photo = (id: string, overrides: Partial<Attachment> = {}): Attachment => ({
  id,
  owner_id: 'owner',
  vehicle_id: 'car',
  kind: 'vehicle',
  state: 'ready',
  created_at: '2026-10-28T10:00:00Z',
  path: `owner/${id}.jpg`,
  caption: '',
  modification_id: null,
  build_id: null,
  fuel_id: null,
  service_id: null,
  ...overrides,
});
test('vehicle cards never select another owner, receipt, unrelated car or unfinished upload', () => {
  const valid = photo('original');
  const rows = [
    valid,
    photo('foreign', { owner_id: 'other' }),
    photo('receipt', { kind: 'service', service_id: 'service' }),
    photo('other-car', { vehicle_id: 'other' }),
    photo('pending', { state: 'uploading', created_at: '2026-10-28T12:00:00Z' }),
  ];
  assert.deepEqual(latestVehiclePhotos('owner', ['car'], rows), [valid]);
  assert.deepEqual(latestVehiclePhotos('owner', [], rows), []);
});
test('a new completed photo replaces the card cover and removing it restores the earlier photo', () => {
  const original = photo('a');
  const replacement = photo('b', { created_at: '2026-10-28T11:00:00Z' });
  assert.deepEqual(latestVehiclePhotos('owner', ['car'], [replacement, original]), [replacement]);
  assert.deepEqual(latestVehiclePhotos('owner', ['car'], [original]), [original]);
  assert.deepEqual(latestVehiclePhotos('owner', ['car'], []), []);
  const tie = photo('c', { created_at: replacement.created_at });
  assert.deepEqual(latestVehiclePhotos('owner', ['car'], [tie, replacement]), [tie]);
});
test('local file references are scoped to the specific vehicle and reject traversal or foreign filenames', () => {
  const car = '94100000-0000-4000-8000-000000000001';
  const image = '94400000-0000-4000-8000-000000000001';
  const name = coverFilename(car, image);
  assert.equal(validCoverFilename(name, car), true);
  assert.equal(validCoverFilename(name, image), false);
  assert.equal(validCoverFilename(`${car}.../../secret.jpg`, car), false);
  assert.throws(() => coverKey('../secret'));
  assert.throws(() => coverFilename(car, '../secret'));
});
test('private cover cache identities isolate accounts and immutable photo versions', () => {
  const owner = '94100000-0000-4000-8000-000000000001';
  const other = '94100000-0000-4000-8000-000000000002';
  const first = '94400000-0000-4000-8000-000000000001';
  const replacement = '94400000-0000-4000-8000-000000000002';
  const firstKey = cloudCoverCacheKey(owner, first, `${owner}/${first}.jpg`);
  assert.notEqual(firstKey, cloudCoverCacheKey(other, first, `${other}/${first}.jpg`));
  assert.notEqual(firstKey, cloudCoverCacheKey(owner, replacement, `${owner}/${replacement}.jpg`));
  assert.ok(firstKey.startsWith(cloudCoverOwnerPrefix(owner)));
  assert.throws(() => cloudCoverCacheKey(owner, first, `${other}/${first}.jpg`));
  assert.throws(() => cloudCoverCacheKey('../other', first, `../other/${first}.jpg`));
  assert.throws(() => cloudCoverCacheKey(owner, '../secret', `${owner}/../secret.jpg`));
});

test('cloud cover cache downloads once and fetches a replacement only when photo changes', async () => {
  const { resolveCloudCovers } = await import('../src/entities/attachment/api/resolve-covers');
  const cache = new Map<string, string>();
  let signs = 0,
    downloads = 0;
  const deps = {
    async guard() {},
    async sign(_owner: string, rows: Attachment[]) {
      signs++;
      return Object.fromEntries(rows.map((row) => [row.path, `https://signed/${row.id}`]));
    },
    async read(item: { id: string }) {
      const uri = cache.get(item.id);
      return uri ? { uri, release() {} } : null;
    },
    async write(item: { id: string }) {
      const uri = `file:///${item.id}.jpg`;
      cache.set(item.id, uri);
      return { uri, release() {} };
    },
    async remove(item: { id: string }) {
      cache.delete(item.id);
    },
    async download() {
      downloads++;
      return new Uint8Array([255, 216, 255, 217]).buffer;
    },
  };
  const first = photo('first');
  const one = await resolveCloudCovers('owner', [first], deps);
  assert.equal(one.urls.car, 'file:///first.jpg');
  const two = await resolveCloudCovers('owner', [first], deps);
  assert.equal(two.urls.car, 'file:///first.jpg');
  assert.equal(signs, 1);
  assert.equal(downloads, 1);
  const replacement = await resolveCloudCovers('owner', [photo('replacement')], deps);
  assert.equal(replacement.urls.car, 'file:///replacement.jpg');
  assert.equal(signs, 2);
  assert.equal(downloads, 2);
});

test('cache write is removed if the owner signs out while the photo is being saved', async () => {
  const { resolveCloudCovers } = await import('../src/entities/attachment/api/resolve-covers');
  let signedIn = true,
    removed = false,
    released = false;
  const deps = {
    async guard() {
      if (!signedIn) throw new Error('owner changed');
    },
    async sign(_owner: string, rows: Attachment[]) {
      return { [rows[0]!.path]: 'https://signed/photo' };
    },
    async read() {
      return null;
    },
    async write() {
      signedIn = false;
      return {
        uri: 'file:///photo.jpg',
        release() {
          released = true;
        },
      };
    },
    async remove() {
      removed = true;
    },
    async download() {
      return new Uint8Array([255, 216, 255, 217]).buffer;
    },
  };
  await assert.rejects(resolveCloudCovers('owner', [photo('photo')], deps), /owner changed/);
  assert.equal(removed, true);
  assert.equal(released, true);
});
