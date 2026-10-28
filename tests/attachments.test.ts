import test from 'node:test';
import assert from 'node:assert/strict';
import {
  targetColumns,
  photoPath,
  validPreparedPhoto,
  MAX_PHOTO_BYTES,
} from '../src/entities/attachment/model/types';
test('attachment targets preserve their saved car and exactly one typed parent', () => {
  assert.deepEqual(targetColumns({ kind: 'service', id: 'receipt', vehicleId: 'car' }), {
    kind: 'service',
    vehicle_id: 'car',
    modification_id: null,
    build_id: null,
    fuel_id: null,
    service_id: 'receipt',
  });
  assert.equal(targetColumns({ kind: 'vehicle', id: 'car', vehicleId: 'car' }).service_id, null);
  assert.equal(photoPath('owner', 'opaque-id'), 'owner/opaque-id.jpg');
});
test('prepared uploads require JPEG bytes and a bounded payload', () => {
  assert.equal(validPreparedPhoto(new Uint8Array([255, 216, 255, 0]).buffer), true);
  assert.equal(validPreparedPhoto(new Uint8Array([60, 115, 118, 103]).buffer), false);
  assert.equal(validPreparedPhoto(new ArrayBuffer(0)), false);
  const large = new Uint8Array(MAX_PHOTO_BYTES + 1);
  large.set([255, 216, 255]);
  assert.equal(validPreparedPhoto(large.buffer), false);
});
