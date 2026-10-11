// Builds the read-only content library (content.sqlite) from parsed/*.jsonl.
//   node scripts/content-import/prachub/build-content-db.mjs [out.sqlite]
// Questions we already have (OA problems, library problems, PracHub duplicates) are
// recorded in parsed/question-dupes.json and kept out of the lists.
import Database from 'better-sqlite3';
import { existsSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { DIR, PARSED } from './common.mjs';

const out = process.argv[2] || join(DIR, 'content.sqlite');
const tmp = `${out}.building`;
// PracHub courses/lessons are parsed but not published for now (owner's call).
// algorithms-*.jsonl are the bilingual interview tutorials adapted from OI Wiki.
const FILES = [
  'coding-questions', 'interview-questions', 'experiences', 'guides', 'concepts',
  'articles', 'cheatsheets',
  ...(existsSync(PARSED)
    ? readdirSync(PARSED).filter((f) => /^algorithms-[a-z-]+\.jsonl$/.test(f)).map((f) => f.slice(0, -6)).sort()
    : []),
];
const TYPES = new Set(['coding_question', 'interview_question', 'experience', 'guide', 'concept', 'article', 'cheatsheet', 'algorithm']);

rmSync(tmp, { force: true });
const db = new Database(tmp);
db.pragma('journal_mode = OFF');
db.pragma('synchronous = OFF');
db.exec(`
CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT,
  body TEXT NOT NULL, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX items_type_slug ON items(type, slug);
CREATE INDEX items_list ON items(type, listed, published_at);
CREATE INDEX items_company ON items(type, company_slug);
CREATE VIRTUAL TABLE items_fts USING fts5(title, summary, body, content='items', content_rowid='rowid', tokenize='unicode61');
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const dupes = new Map();
const dupFile = join(PARSED, 'question-dupes.json');
if (existsSync(dupFile))
  for (const d of JSON.parse(readFileSync(dupFile, 'utf8'))) dupes.set(d.id, d.dupOf);

const insert = db.prepare(`INSERT OR REPLACE INTO items(id,type,slug,title,summary,title_zh,summary_zh,body,company_slug,company_name,role,category,difficulty,round,seniority,tags,published_at,updated_at,relations,extra,partial,dup_of,listed)
  VALUES(@id,@type,@slug,@title,@summary,@title_zh,@summary_zh,@body,@company_slug,@company_name,@role,@category,@difficulty,@round,@seniority,@tags,@published_at,@updated_at,@relations,@extra,@partial,@dup_of,@listed)`);
const counts = {};
let rejected = 0;
for (const file of FILES) {
  const path = join(PARSED, `${file}.jsonl`);
  if (!existsSync(path)) continue;
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  const batch = [];
  for await (const line of lines) {
    if (!line.trim()) continue;
    const item = JSON.parse(line);
    if (!TYPES.has(item.type) || !item.id || !item.slug || !item.title || !item.body?.trim()) {
      rejected++;
      continue;
    }
    const dup = dupes.get(item.id) || null;
    batch.push({
      id: item.id, type: item.type, slug: item.slug, title: item.title,
      summary: item.summary ?? null, body: item.body,
      title_zh: item.titleZh ?? null, summary_zh: item.summaryZh ?? null,
      company_slug: item.company?.slug ?? null, company_name: item.company?.name ?? null,
      role: item.role ?? null, category: item.category ?? null,
      difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : null,
      round: item.round ?? null, seniority: item.seniority ?? null,
      tags: JSON.stringify(item.tags || []), published_at: item.publishedAt ?? null,
      updated_at: item.updatedAt ?? null, relations: JSON.stringify(item.relations || []),
      extra: JSON.stringify(item.extra || {}), partial: item.partial ? 1 : 0,
      dup_of: dup ? JSON.stringify(dup) : null,
      // Duplicates of problems we already have are reachable by link but not listed.
      listed: dup ? 0 : 1,
    });
    counts[item.type] = (counts[item.type] || 0) + 1;
  }
  db.transaction((rows) => rows.forEach((r) => insert.run(r)))(batch);
}
db.exec("INSERT INTO items_fts(items_fts) VALUES('rebuild')");
const listed = db.prepare('SELECT type, SUM(listed) AS listed, COUNT(*) AS n FROM items GROUP BY type').all();
db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('built_at', new Date().toISOString());
db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('counts', JSON.stringify(listed));
db.exec('ANALYZE');
db.close();
renameSync(tmp, out);
console.log(JSON.stringify({ out, counts: listed, rejected }, null, 1));
