import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDiagnosticRead } from '../src/entities/obd/api/read-scan';
import { displayMetric, appendSample, buildSparkline } from '../src/entities/obd/lib/metrics';
import { describeDtc, normalizeVin, vinMismatch } from '../src/entities/obd/lib/codes';
import { normalizeMetricSelection } from '../src/shared/types';
function bridge(failures: string[] = []) {
  const calls: string[] = [];
  const run = async (name: string) => {
    calls.push(name);
    if (failures.includes(name)) throw new Error('unsupported');
  };
  return {
    calls,
    native: {
      readDTCs: () => run('stored'),
      getDTCs: async () => ['p0300', 'P0300'],
      readPendingDTCs: () => run('pending'),
      getPendingDTCs: async () => [],
      readPermanentDTCs: () => run('permanent'),
      getPermanentDTCs: async () => ['P0420'],
      readVIN: () => run('vin'),
      getVIN: async () => '1HGCM82633A004352',
    },
  };
}
test('confirmed-only scan makes only requested calls, deduplicates codes and records fresh snapshot', async () => {
  const { native, calls } = bridge();
  const result = await executeDiagnosticRead(
    native,
    'confirmed',
    false,
    async () => {},
    async () => ({ rpm: 0 }),
  );
  assert.deepEqual(calls, ['stored']);
  assert.deepEqual(result.stored, ['P0300']);
  assert.deepEqual(result.metrics, { rpm: 0 });
  assert.deepEqual(result.context.statuses, {
    stored: 'read',
    pending: 'not_requested',
    permanent: 'not_requested',
  });
  assert.equal(result.context.vin_status, 'not_requested');
  assert.ok(result.context.telemetry_at);
});
test('optional failures remain unavailable instead of becoming clean groups', async () => {
  const { native } = bridge(['pending', 'vin']);
  const result = await executeDiagnosticRead(
    native,
    'all',
    true,
    async () => {},
    async () => {
      throw new Error('no telemetry');
    },
  );
  assert.equal(result.context.statuses?.pending, 'unavailable');
  assert.deepEqual(result.pending, []);
  assert.equal(result.context.statuses?.permanent, 'read');
  assert.equal(result.context.vin_status, 'unavailable');
  assert.equal(result.context.telemetry_at, null);
  assert.deepEqual(result.metrics, {});
});
test('a scan with no readable groups fails; disconnect stops remaining requests', async () => {
  const broken = bridge(['stored', 'pending', 'permanent']);
  await assert.rejects(
    executeDiagnosticRead(
      broken.native,
      'all',
      false,
      async () => {},
      async () => ({}),
    ),
  );
  const good = bridge();
  let checks = 0;
  await assert.rejects(
    executeDiagnosticRead(
      good.native,
      'all',
      false,
      async () => {
        if (++checks > 1) throw new Error('disconnected');
      },
      async () => ({}),
    ),
  );
  assert.deepEqual(good.calls, ['stored']);
});
test('metric conversions preserve absence and zero and keep absolute pressure distinct from boost', () => {
  assert.deepEqual(displayMetric('coolant', 0, 'imperial'), { value: 32, unit: '°F' });
  assert.deepEqual(displayMetric('speed', undefined, 'imperial'), {
    value: undefined,
    unit: 'mph',
  });
  assert.ok(Math.abs(displayMetric('speed', 100, 'imperial').value! - 62.137119) < 0.00001);
  assert.ok(Math.abs(displayMetric('map', 100, 'imperial').value! - 14.50377377) < 0.000001);
  assert.deepEqual(displayMetric('fuelTrim', -10, 'metric'), { value: -10, unit: '%' });
  assert.equal(displayMetric('rpm', NaN, 'metric').value, undefined);
});
test('trend data is bounded and paths never connect through missing readings', () => {
  let samples: Parameters<typeof appendSample>[0] = [];
  for (let i = 0; i < 50; i++)
    samples = appendSample(samples, { at: String(i), metrics: { rpm: i } });
  assert.equal(samples.length, 30);
  assert.equal(samples[0]?.at, '20');
  assert.equal(samples[29]?.metrics.rpm, 49);
  assert.equal((buildSparkline([0, 1, undefined, 2, 3]).match(/M/g) ?? []).length, 2);
  assert.equal(buildSparkline([undefined, 1]), '');
  assert.deepEqual(normalizeMetricSelection(['rpm', 'invalid', 'rpm', 'speed']), ['rpm', 'speed']);
  assert.equal(normalizeMetricSelection([]).length, 4);
});
test('glossary stays explicit and VIN comparison never invents an identity', () => {
  assert.equal(describeDtc('p0300'), 'dtcMisfireRandom');
  assert.equal(describeDtc('P240A'), 'dtcUnknown');
  assert.equal(normalizeVin('INVALID'), null);
  assert.equal(vinMismatch('', '1HGCM82633A004352'), false);
  assert.equal(vinMismatch('1HGCM82633A004352', '1HGCM82633A004353'), true);
});
