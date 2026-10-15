import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { solutionReports } from '../lib/oa-solution-evidence.mjs';
const source = resolve('content/oa-master/catalog.json');
if (statSync(source).size > 64 * 1024 * 1024)
  throw new Error('OA catalog exceeds size budget');
const catalog = JSON.parse(readFileSync(source, 'utf8'));
if (catalog.schemaVersion !== 1 || !catalog.items?.length)
  throw new Error('Missing OA catalog');
const target = resolve('dist/standalone/content/oa-master');
mkdirSync(target, { recursive: true });
copyFileSync(source, resolve(target, 'catalog.json'));
copyFileSync(
  'content/oa-master/manifest.json',
  resolve(target, 'manifest.json'),
);
const registrySource = resolve('content/oa-judge/registry.json');
if (statSync(registrySource).size > 64 * 1024 * 1024)
  throw new Error('OA judge registry exceeds size budget');
const registry = JSON.parse(readFileSync(registrySource, 'utf8'));
if (registry.schemaVersion !== 1 || !Array.isArray(registry.items))
  throw new Error('Invalid OA judge registry');
const registryTarget = resolve('dist/standalone/content/oa-judge');
mkdirSync(registryTarget, { recursive: true });
copyFileSync(registrySource, resolve(registryTarget, 'registry.json'));
// Debugging drills are the reference a line or three off: private like the registry.
const drillsSource = resolve('content/oa-judge/drills.json');
if (existsSync(drillsSource)) {
  if (statSync(drillsSource).size > 64 * 1024 * 1024)
    throw new Error('OA drills exceed size budget');
  copyFileSync(drillsSource, resolve(registryTarget, 'drills.json'));
}
// English statements, guides (hint ladder, English editorial) and extra reference programs are
// display-only sidecars: ship those bound to the current package (guides: and catalog source).
const entries = new Map(registry.items.map((item) => [item.id, item]));
const shipped = {};
for (const dir of ['translations', 'guides', 'solutions']) {
  const source = resolve('content/oa-judge', dir);
  const target = resolve(registryTarget, dir);
  mkdirSync(target, { recursive: true });
  shipped[dir] = 0;
  for (const file of existsSync(source)
    ? readdirSync(source).filter((f) => f.endsWith('.json'))
    : []) {
    const t = JSON.parse(readFileSync(resolve(source, file), 'utf8'));
    const entry = entries.get(t.id);
    if (
      t.packageChecksum !== entry?.packageChecksum ||
      `${t.id}.json` !== file ||
      (dir === 'guides' && t.sourceContentHash !== entry.sourceContentHash)
    )
      throw new Error(`Stale or misnamed OA ${dir} file: ${file}`);
    copyFileSync(resolve(source, file), resolve(target, file));
    shipped[dir]++;
  }
}
// The evidence the server checks before showing an extra program (lib/oa-solution-evidence.mjs).
mkdirSync(resolve(registryTarget, 'reports'), { recursive: true });
for (const file of solutionReports('content/oa-judge'))
  copyFileSync(
    resolve('content/oa-judge/reports', file),
    resolve(registryTarget, 'reports', file),
  );
console.log(
  `Packaged ${catalog.items.length} OA reading problems, ${shipped.translations} English statements, ${shipped.guides} guides and ${shipped.solutions} extra solution sets as private server assets.`,
);
