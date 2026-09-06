import {
  cpSync,
  mkdirSync,
  readFileSync,
  existsSync,
  copyFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const root = resolve('.');
const target = resolve('dist/standalone/oj-worker');
mkdirSync(target, { recursive: true });
copyFileSync('dist/oj-worker/index.mjs', join(target, 'index.mjs'));
// Reviewed language drivers are runtime assets, never executable imports from the library.
cpSync('scripts/leetcode-mode', 'dist/standalone/scripts/leetcode-mode', {
  recursive: true,
});
cpSync('deploy/oj/cpp-json-v1', 'dist/standalone/deploy/oj/cpp-json-v1', {
  recursive: true,
});
// Bundle JavaScript with Vite; preserve BullMQ's Lua files and its exact locked dependency tree.
function copyPackage(name, from, destination, ancestors = new Set()) {
  const require = createRequire(join(from, 'package.json'));
  let location;
  try {
    location = dirname(require.resolve(`${name}/package.json`));
  } catch {
    location = dirname(require.resolve(name));
    while (
      !existsSync(join(location, 'package.json')) ||
      JSON.parse(readFileSync(join(location, 'package.json'), 'utf8')).name !==
        name
    ) {
      const parent = dirname(location);
      if (parent === location) throw new Error(`Cannot locate ${name}`);
      location = parent;
    }
  }
  const manifest = JSON.parse(
    readFileSync(join(location, 'package.json'), 'utf8'),
  );
  const key = `${name}@${manifest.version}`;
  if (ancestors.has(key)) return;
  const output = join(destination, 'node_modules', name);
  mkdirSync(dirname(output), { recursive: true });
  cpSync(location, output, {
    recursive: true,
    filter: (source) =>
      source === location ||
      !source
        .slice(location.length + 1)
        .split('/')
        .includes('node_modules'),
  });
  const next = new Set(ancestors).add(key);
  for (const dependency of Object.keys(manifest.dependencies || {}))
    copyPackage(dependency, location, output, next);
}
copyPackage('bullmq', root, target);
// BullMQ 6 treats Redis as an optional peer because it also supports other stores.
// This deployment explicitly uses Redis; include its driver in the worker artifact.
copyPackage('ioredis', root, target);
if (!existsSync('dist/standalone/node_modules/better-sqlite3'))
  throw new Error('Native SQLite missing from standalone');
console.log(
  'Packaged OJ worker with locked BullMQ dependencies and Lua scripts.',
);
