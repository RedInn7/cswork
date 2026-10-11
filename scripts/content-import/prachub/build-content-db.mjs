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
import { imageUrls } from './fetch-images.mjs';

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
  title_zh TEXT, summary_zh TEXT, level TEXT,
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

// Our own copies of images (fetch-images.mjs) and CSWORK routes for PracHub links.
const readJson = (name, empty) =>
  existsSync(join(PARSED, name)) ? JSON.parse(readFileSync(join(PARSED, name), 'utf8')) : empty;
const assets = readJson('assets-map.json', {});
const ROUTES = {
  'coding-questions': 'coding_question', 'interview-questions': 'interview_question',
  'interview-experiences': 'experience', concepts: 'concept', resources: 'article',
  'interview-guide': 'guide', 'interview-prep': 'cheatsheet',
};
const SITE = /^(?:https?:\/\/(?:www\.)?prachub\.com)?(\/[^\s]*)?$/i;
/** CSWORK link for an old-site URL or path, '#' when there is no counterpart, null when not an old-site link. */
function route(url) {
  const m = SITE.exec(url);
  if (!m || (!m[1] && !/prachub\.com/i.test(url))) return null;
  const path = m[1] || '/';
  if (path.startsWith('/content-assets/') || path.startsWith('/?view=')) return null;
  const [, kind, slug] = /^\/([a-z-]+)\/?([^?#]*)/i.exec(path) || [];
  if (kind && Object.hasOwn(ROUTES, kind) && slug)
    return `/?view=content&type=${ROUTES[kind]}&slug=${encodeURIComponent(slug.replace(/\/$/, ''))}`;
  if (kind === 'companies' && slug) return `/?view=questions&company=${encodeURIComponent(slug.split('/')[0])}`;
  // Pricing, sign-in and other site pages have no CSWORK counterpart: keep the text only.
  return '#';
}
/** Points images at our own copies and old-site links at CSWORK; code spans and blocks are left alone. */
export function localize(text) {
  if (!text) return text;
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(/(!\[[^\]]*\]\(\s*<?)([^)\s>]+)/g, (all, head, url) => (assets[url] ? head + assets[url] : all))
            .replace(/(<img\b[^>]*\bsrc=["'])([^"']+)/gi, (all, head, url) => (assets[url] ? head + assets[url] : all))
            // [text](url) and [text](url "title"), not images (already handled above).
            .replace(/(?<!!)(\[[^\]]*\]\(\s*<?)([^)\s>]+)(>?(?:\s+"[^"]*")?\s*\))/g, (all, head, url, tail) => {
              const to = route(url);
              return to === null ? all : head + to + (to === '#' ? ')' : tail);
            })
            // Autolinks and bare URLs to the old site.
            .replace(/<(https?:\/\/(?:www\.)?prachub\.com[^>\s]*)>|\bhttps?:\/\/(?:www\.)?prachub\.com[^\s)\]>"']*/gi, (all, inner) => {
              const to = route(inner || all);
              return to && to !== '#' ? `[link](${to})` : '';
            }),
    )
    .join('');
}
const localizeItem = (item) => {
  item.body = localize(item.body);
  if (item.extra?.bodyZh) item.extra.bodyZh = localize(item.extra.bodyZh);
  for (const f of item.extra?.faq || []) f.a = localize(f.a);
  return item;
};

// Automatic matches, minus the ones a reviewer rejected, plus the ones a reviewer confirmed.
const dupes = new Map(readJson('question-dupes.json', []).map((d) => [d.id, d.dupOf]));
for (const id of readJson('question-dupes-reject.json', [])) dupes.delete(id);
for (const d of readJson('question-dupes-manual.json', [])) dupes.set(d.id, d.dupOf);

const insert = db.prepare(`INSERT OR REPLACE INTO items(id,type,slug,title,summary,title_zh,summary_zh,level,body,company_slug,company_name,role,category,difficulty,round,seniority,tags,published_at,updated_at,relations,extra,partial,dup_of,listed)
  VALUES(@id,@type,@slug,@title,@summary,@title_zh,@summary_zh,@level,@body,@company_slug,@company_name,@role,@category,@difficulty,@round,@seniority,@tags,@published_at,@updated_at,@relations,@extra,@partial,@dup_of,@listed)`);
const counts = {};
let rejected = 0;
for (const file of FILES) {
  const path = join(PARSED, `${file}.jsonl`);
  if (!existsSync(path)) continue;
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  const batch = [];
  for await (const line of lines) {
    if (!line.trim()) continue;
    const item = localizeItem(JSON.parse(line));
    if (!TYPES.has(item.type) || !item.id || !item.slug || !item.title || !item.body?.trim()) {
      rejected++;
      continue;
    }
    const dup = dupes.get(item.id) || null;
    batch.push({
      id: item.id, type: item.type, slug: item.slug, title: item.title,
      summary: item.summary ?? null, body: item.body,
      title_zh: item.titleZh ?? null, summary_zh: item.summaryZh ?? null,
      // Tutorials only: core interview material vs. an extension topic.
      level: ['core', 'advanced'].includes(item.extra?.level) ? item.extra.level : null,
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
