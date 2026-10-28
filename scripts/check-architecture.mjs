import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory() ? walk(join(dir, x.name)) : /\.tsx?$/.test(x.name) ? [join(dir, x.name)] : [],
  );
}
const errors = [];
for (const file of walk('src')) {
  const segments = relative('src', file).split('/');
  const sourceLayer = segments[0];
  const sourceSlice = segments[1];
  for (const match of readFileSync(file, 'utf8').matchAll(
    /(?:from\s+|import\s*)['"]@\/([^'"]+)['"]/g,
  )) {
    const [targetLayer, targetSlice, ...internal] = match[1].split('/');
    if (layers.indexOf(targetLayer) < layers.indexOf(sourceLayer))
      errors.push(`${file}: upward import ${match[1]}`);
    if (
      sourceLayer === targetLayer &&
      !['app', 'shared'].includes(sourceLayer) &&
      sourceSlice !== targetSlice
    )
      errors.push(`${file}: same-layer slice import ${match[1]}`);
    if (!['app', 'shared'].includes(targetLayer) && internal.length)
      errors.push(`${file}: bypassed public API ${match[1]}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('FSD import boundaries passed');
