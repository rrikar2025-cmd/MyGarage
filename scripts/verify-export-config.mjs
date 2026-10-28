import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
// A newly added .env can otherwise reuse Metro transforms with empty, inlined client settings.
if (existsSync('.env')) process.loadEnvFile('.env');
const directory = resolve(process.argv[2] ?? 'dist');
const bundleDirectory = join(directory, '_expo/static/js/web');
const bundle = readdirSync(bundleDirectory)
  .filter((name) => name.endsWith('.js'))
  .map((name) => readFileSync(join(bundleDirectory, name), 'utf8'))
  .join('\n');
const variables = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
const configured = variables.filter((name) => Boolean(process.env[name]));
if (configured.length !== 0 && configured.length !== variables.length)
  throw new Error('Incomplete Supabase client configuration. Set both public variables.');
const missing = configured.filter((name) => !bundle.includes(process.env[name]));
if (missing.length)
  throw new Error(
    `Export used stale client configuration (${missing.join(', ')}). Rebuild with npm run export:web -- --clear. Values are intentionally not printed.`,
  );
console.log(
  configured.length
    ? 'Export configuration verified: both public Supabase values are bundled.'
    : 'Export configuration verified: local-only build.',
);
