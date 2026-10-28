import test from 'node:test';
import assert from 'node:assert/strict';
import { latestVehiclePhotos } from '../src/entities/attachment/model/vehicle-covers';
import { coverFilename, validCoverFilename, coverKey } from '../src/shared/media/types';
import type { Attachment } from '../src/entities/attachment/model/types';
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
