/** Prints, one per line, every verified batch with an item missing from DATABASE_PATH or published from a different package. */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const Database = createRequire(import.meta.url)('better-sqlite3');
const db = new Database(process.env.DATABASE_PATH, { readonly: true });
// A regenerated package changes its checksum; the old version would stop counting as ready.
const published = new Map(
  db
    .prepare(
      "SELECT p.id,v.checksum FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id WHERE p.published=1 AND p.id LIKE 'oa-%'",
    )
    .all()
    .map((row) => [row.id, row.checksum]),
);
db.close();
const dir = 'content/oa-judge/batches';
const batches = new Set();
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort())
  for (const item of JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')).items)
    if (published.get(item.id) !== item.packageChecksum)
      batches.add(file.slice(0, -'.json'.length));
for (const batch of batches) console.log(batch);
