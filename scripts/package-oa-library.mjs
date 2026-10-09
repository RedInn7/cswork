import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { resolve } from 'node:path';
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
// English statements are display-only; ship those bound to the current package checksum.
const checksums = new Map(
  registry.items.map((item) => [item.id, item.packageChecksum]),
);
const translationSource = resolve('content/oa-judge/translations');
const translationTarget = resolve(registryTarget, 'translations');
mkdirSync(translationTarget, { recursive: true });
let translations = 0;
for (const file of existsSync(translationSource)
  ? readdirSync(translationSource).filter((f) => f.endsWith('.json'))
  : []) {
  const t = JSON.parse(readFileSync(resolve(translationSource, file), 'utf8'));
  if (t.packageChecksum !== checksums.get(t.id) || `${t.id}.json` !== file)
    throw new Error(`Stale or misnamed OA translation: ${file}`);
  copyFileSync(resolve(translationSource, file), resolve(translationTarget, file));
  translations++;
}
console.log(
  `Packaged ${catalog.items.length} OA reading problems and ${translations} English statements as private server assets.`,
);
