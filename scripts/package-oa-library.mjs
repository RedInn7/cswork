import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
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
console.log(
  `Packaged ${catalog.items.length} OA reading problems as private server assets.`,
);
