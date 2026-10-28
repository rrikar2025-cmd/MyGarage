import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGuestGarage } from '../src/entities/garage/lib/guest-data';
import { emptyGarage } from '../src/entities/garage/model/types';
test('older guest snapshots remain readable without retired collections', () => {
  const old = {
    ...emptyGarage(),
    fuel: [{ id: 'fuel', total: 812.75 }],
    selectedId: 'car',
  } as Record<string, unknown>;
  delete old.mods;
  delete old.builds;
  const restored = parseGuestGarage(JSON.stringify(old));
  assert.deepEqual(restored.fuel, old.fuel);
  assert.equal(restored.selectedId, 'car');
  assert.deepEqual(restored.mods, []);
  assert.deepEqual(restored.builds, []);
  assert.throws(() => parseGuestGarage(JSON.stringify({ ...old, mods: {} })));
});
test('ordinary guest round-trips retain retired financial rows and vehicle budget fields', () => {
  const original = {
    ...emptyGarage(),
    vehicles: [{ id: 'car', build_budget: 10000 }],
    mods: [{ id: 'part', vehicle_id: 'car', cost: 700.25 }],
    builds: [{ id: 'plan', vehicle_id: 'car', cost: 1000 }],
    fuel: [{ id: 'fuel', total: 100 }],
  };
  const loaded = parseGuestGarage(JSON.stringify(original));
  const saved = parseGuestGarage(
    JSON.stringify({ ...loaded, fuel: [{ ...loaded.fuel[0], total: 250 }] }),
  );
  assert.deepEqual(saved.mods, original.mods);
  assert.deepEqual(saved.builds, original.builds);
  assert.equal(saved.vehicles[0]?.build_budget, 10000);
  assert.equal(saved.fuel[0]?.total, 250);
});
