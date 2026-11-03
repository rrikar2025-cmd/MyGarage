import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getResolvedLocalesAsync } = require('@expo/config-plugins/build/utils/locales') as {
  getResolvedLocalesAsync: (
    root: string,
    locales: Record<string, string>,
    platform: 'android' | 'ios',
  ) => Promise<Record<string, Record<string, string>>>;
};

test('iOS usage descriptions do not become Android translation resources', async () => {
  const locales = { uk: './locales/uk.json', en: './locales/en.json' };
  const android = await getResolvedLocalesAsync(process.cwd(), locales, 'android');
  const ios = await getResolvedLocalesAsync(process.cwd(), locales, 'ios');
  for (const language of ['uk', 'en']) {
    assert.deepEqual(android[language], {});
    for (const key of [
      'CFBundleDisplayName',
      'NSBluetoothAlwaysUsageDescription',
      'NSPhotoLibraryUsageDescription',
      'NSCameraUsageDescription',
    ]) {
      assert.ok(ios[language]?.[key]);
    }
  }
});
