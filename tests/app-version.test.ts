import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppVersion } from '../src/pages/settings/app-version';

test('uses native version when available and safely handles an absent or failing module', () => {
  assert.equal(
    resolveAppVersion(() => '1.0.1', 'unavailable'),
    '1.0.1',
  );
  assert.equal(
    resolveAppVersion(() => null, 'unavailable'),
    'unavailable',
  );
  assert.equal(
    resolveAppVersion(() => '', 'unavailable'),
    'unavailable',
  );
  assert.equal(
    resolveAppVersion(() => {
      throw new Error('native module missing');
    }, 'unavailable'),
    'unavailable',
  );
});
