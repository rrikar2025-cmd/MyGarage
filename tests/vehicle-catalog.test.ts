import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { vehicleMakes, vehicleModels, vehicleYears } from '../src/entities/garage/catalog';

test('vehicle catalogue offers year range and models for selected make', () => {
  assert.equal(vehicleYears.length, 37);
  assert.equal(vehicleYears[0], '2026');
  assert.equal(vehicleYears.at(-1), '1990');
  assert.ok(vehicleMakes.includes('Volkswagen'));
  assert.ok(vehicleModels(' volkswagen ').includes('Golf'));
  assert.ok(vehicleModels('BMW').length > 0);
  assert.deepEqual(vehicleModels('custom make'), []);
});
