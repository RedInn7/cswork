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
// algorithms-*.jsonl are the bilingual interview tutorials adapted from OI Wiki, inserted in
// syllabus order (the list shows them in insertion order); unknown groups go last.
const SYLLABUS = ['basics', 'datastructures', 'graphs-strings', 'dp-math'];
const rank = (f) => (SYLLABUS.indexOf(f.slice('algorithms-'.length)) + 1 || SYLLABUS.length + 1);
const FILES = [
  'coding-questions', 'interview-questions', 'experiences', 'guides', 'concepts',
  'articles', 'cheatsheets',
  ...(existsSync(PARSED)
    ? readdirSync(PARSED)
        .filter((f) => /^algorithms-[a-z-]+\.jsonl$/.test(f))
        .map((f) => f.slice(0, -6))
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
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
// First pass over everything we publish, so links only point at pages that exist.
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const known = { pages: new Set(), companies: new Set(), roles: new Map(), categories: new Map() };
for (const file of FILES) {
  const path = join(PARSED, `${file}.jsonl`);
  if (!existsSync(path)) continue;
  for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const it = JSON.parse(line);
    known.pages.add(`${it.type}:${it.slug}`);
    if (it.company?.slug) known.companies.add(it.company.slug);
    if (it.role) known.roles.set(slugify(it.role), it.role);
    if (it.category) known.categories.set(slugify(it.category), it.category);
  }
}
// Old-site sections -> our item types (a question may live under either questions path).
const SECTIONS = {
  'coding-questions': ['coding_question', 'interview_question'], 'interview-questions': ['interview_question', 'coding_question'],
  'interview-experiences': ['experience'], concepts: ['concept'], resources: ['article'],
  'interview-guide': ['guide'], 'interview-prep': ['cheatsheet'],
};
const LISTS = {
  questions: 'questions', 'coding-questions': 'questions', 'interview-questions': 'questions', companies: 'questions',
  positions: 'questions', categories: 'questions', 'interview-experiences': 'experiences',
  resources: 'resources&type=article', concepts: 'resources&type=concept', 'interview-guide': 'resources&type=guide',
  'interview-prep': 'resources&type=cheatsheet',
};
const OLD_SITE = /^(?:https?:\/\/(?:www\.)?prachub\.com(?=[/?#]|$)|\/(?!\/))/i;
const questions = (filter, value) => `/?view=questions&${filter}=${encodeURIComponent(value)}`;
/** CSWORK link for an old-site URL or path, '#' when there is no counterpart, null when not an old-site link. */
function route(url) {
  if (!OLD_SITE.test(url) || url.startsWith('/content-assets/') || url.startsWith('/?view=')) return null;
  let u;
  try {
    u = new URL(url, 'https://prachub.com');
  } catch {
    return '#';
  }
  const [kind = '', slug = ''] = u.pathname.split('/').filter(Boolean);
  if (slug && Object.hasOwn(SECTIONS, kind)) {
    const type = SECTIONS[kind].find((t) => known.pages.has(`${t}:${slug}`));
    return type ? `/?view=content&type=${type}&slug=${encodeURIComponent(slug)}` : '#';
  }
  if (slug && kind === 'companies') return known.companies.has(slug) ? questions('company', slug) : '/?view=questions';
  if (slug && kind === 'positions') return known.roles.has(slug) ? questions('role', known.roles.get(slug)) : '/?view=questions';
  if (slug && kind === 'categories')
    return known.categories.has(slug) ? questions('category', known.categories.get(slug)) : '/?view=questions';
  const filtered = () => {
    for (const [param, values] of [['category', known.categories], ['role', known.roles]]) {
      const v = slugify(u.searchParams.get(param) || '');
      if (values.has(v)) return questions(param, values.get(v));
    }
    const company = u.searchParams.get('company');
    return company && known.companies.has(company) ? questions('company', company) : null;
  };
  if (!kind) return filtered() || '#';
  if (Object.hasOwn(LISTS, kind)) return (LISTS[kind] === 'questions' && filtered()) || `/?view=${LISTS[kind]}`;
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
            // Images we publish point at our copy; any other image is left out entirely.
            .replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, (all, alt, url) => (assets[url] ? `![${alt}](${assets[url]})` : ''))
            .replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, (all, url) => (assets[url] ? `![](${assets[url]})` : ''))
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
const flat = (s) => s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
/**
 * A summary that is just the body's opening cut at a fixed length ends cleanly with an
 * ellipsis instead of half a word ("Expect to demons").
 */
export function excerpt(summary, body) {
  const s = summary?.replace(/\s+/g, ' ').trim();
  if (!s || /[.!?…:;)"'”’]$/.test(s)) return s || null;
  const opening = flat(body.slice(0, s.length * 2 + 200));
  const head = flat(s);
  if (!opening.startsWith(head)) return s;
  const cut = /[\p{L}\p{N}]/u.test(opening[head.length] || '') ? s.replace(/\s*\S+$/, '') : s;
  return `${cut.replace(/[\s,;:-]+$/, '')}…`;
}
// Provenance stays in parsed/ for us; the API (and search) must not expose it.
const PRIVATE = ['sourceTitle', 'sources', 'sourceUrl', 'coverImage'];
const localizeItem = (item) => {
  for (const key of PRIVATE) delete item.extra?.[key];
  item.summary = excerpt(item.summary, item.body);
  item.body = localize(item.body);
  if (item.extra?.bodyZh) item.extra.bodyZh = localize(item.extra.bodyZh);
  for (const f of item.extra?.faq || []) f.a = localize(f.a);
  return item;
};

// Automatic matches, minus the ones a reviewer rejected, plus the ones a reviewer confirmed.
const dupes = new Map(readJson('question-dupes.json', []).map((d) => [d.id, d.dupOf]));
for (const id of readJson('question-dupes-reject.json', [])) dupes.delete(id);
for (const d of readJson('question-dupes-manual.json', [])) dupes.set(d.id, d.dupOf);
// A duplicate of a duplicate points at the final copy; an item a cycle leads back to is kept.
for (const [id, dup] of dupes) {
  let end = dup;
  for (let hops = 0; end.kind === 'prachub' && dupes.has(end.id) && end.id !== id && hops < 10; hops++) end = dupes.get(end.id);
  if (end.id === id) dupes.delete(id);
  else dupes.set(id, end);
}

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
