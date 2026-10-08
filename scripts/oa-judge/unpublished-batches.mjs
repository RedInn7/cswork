/** Prints, one per line, every verified batch that has a registry item not yet published in DATABASE_PATH. */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const Database = createRequire(import.meta.url)('better-sqlite3');
const db = new Database(process.env.DATABASE_PATH, { readonly: true });
const published = new Set(
  db
    .prepare("SELECT id FROM oj_problems WHERE published=1 AND id LIKE 'oa-%'")
    .all()
    .map((row) => row.id),
);
db.close();
const dir = 'content/oa-judge/batches';
const batches = new Set();
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort())
  for (const item of JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')).items)
    if (!published.has(item.id)) batches.add(file.slice(0, -'.json'.length));
for (const batch of batches) console.log(batch);
