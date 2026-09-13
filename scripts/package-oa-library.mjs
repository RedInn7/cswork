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
const registrySource = resolve('content/oa-judge/registry.json');
if (statSync(registrySource).size > 64 * 1024 * 1024)
  throw new Error('OA judge registry exceeds size budget');
const registry = JSON.parse(readFileSync(registrySource, 'utf8'));
if (registry.schemaVersion !== 1 || !Array.isArray(registry.items))
  throw new Error('Invalid OA judge registry');
const registryTarget = resolve('dist/standalone/content/oa-judge');
mkdirSync(registryTarget, { recursive: true });
copyFileSync(registrySource, resolve(registryTarget, 'registry.json'));
console.log(
  `Packaged ${catalog.items.length} OA reading problems as private server assets.`,
);
