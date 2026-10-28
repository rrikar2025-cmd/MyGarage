import { readFile, mkdir, writeFile } from 'node:fs/promises';
await mkdir('work/edge-deploy', { recursive: true });
const core = await readFile('supabase/functions/_shared/job-protocol.ts', 'utf8');
const worker = await readFile('supabase/functions/garage-jobs/index.ts', 'utf8');
await writeFile(
  'work/edge-deploy/garage-jobs.ts',
  core +
    '\n' +
    worker.replace(/^import\s*\{[^}]*\}\s*from '\.\.\/_shared\/job-protocol\.ts';\n/m, ''),
);
await writeFile(
  'work/edge-deploy/delete-account.ts',
  await readFile('supabase/functions/delete-account/index.ts', 'utf8'),
);
