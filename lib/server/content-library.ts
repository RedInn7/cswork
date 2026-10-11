import Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Person } from './auth';
import { setting } from './env';
import { HttpError, json, limitReader } from './http';

/**
 * Read-only interview content library (questions, experiences, guides, concepts,
 * articles, cheatsheets, courses) built offline into its own SQLite file, separate
 * from user data. Replacing the file is picked up without a restart.
 */
const TYPES = [
  'coding_question', 'interview_question', 'experience', 'guide', 'concept',
  'article', 'cheatsheet', 'course', 'lesson',
] as const;
type ItemType = (typeof TYPES)[number];
const GROUPS: Record<string, readonly ItemType[]> = {
  questions: ['coding_question', 'interview_question'],
};
const PAGE = 20;
const SUMMARY = `type,slug,title,summary,company_slug,company_name,role,category,difficulty,round,seniority,tags,published_at,partial`;

let handle: { db: Database.Database; mtime: number; checked: number } | null = null;
function library() {
  const path = setting('CONTENT_DATABASE_PATH') || resolve('data/content.sqlite');
  const now = Date.now();
  if (handle && now - handle.checked < 30_000) return handle.db;
  if (!existsSync(path)) {
    handle?.db.close();
    handle = null;
    return null;
  }
  const mtime = statSync(path).mtimeMs;
  if (handle && handle.mtime === mtime) {
    handle.checked = now;
    return handle.db;
  }
  // A rebuilt file was swapped in: reopen and drop cached facets.
  handle?.db.close();
  handle = { db: new Database(path, { readonly: true, fileMustExist: true }), mtime, checked: now };
  facetCache.clear();
  return handle.db;
}

function typesOf(value: string | null): readonly ItemType[] {
  if (value && GROUPS[value]) return GROUPS[value];
  if (value && (TYPES as readonly string[]).includes(value)) return [value as ItemType];
  throw new HttpError(400, '未知的内容类型');
}
const row = (r: Record<string, unknown>) => ({
  type: r.type,
  slug: r.slug,
  title: r.title,
  summary: r.summary,
  company: r.company_slug ? { slug: r.company_slug, name: r.company_name } : null,
  role: r.role,
  category: r.category,
  difficulty: r.difficulty,
  round: r.round,
  seniority: r.seniority,
  tags: JSON.parse((r.tags as string) || '[]'),
  publishedAt: r.published_at,
  partial: !!r.partial,
});
/** FTS5 query from free text: each word quoted, prefix-matched, AND-ed. */
function ftsQuery(q: string) {
  const words = q.match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) || [];
  return words.map((w) => `"${w}"*`).join(' ');
}

const facetCache = new Map<string, unknown>();
function facets(db: Database.Database, types: readonly ItemType[]) {
  const key = types.join(',');
  if (!facetCache.has(key)) {
    const where = `type IN (${types.map(() => '?').join(',')}) AND listed=1`;
    const group = (column: string, limit = 40) =>
      db
        .prepare(
          `SELECT ${column} AS value,${column === 'company_slug' ? 'MAX(company_name)' : `${column}`} AS label,COUNT(*) AS n
           FROM items WHERE ${where} AND ${column} IS NOT NULL GROUP BY ${column} ORDER BY n DESC LIMIT ${limit}`,
        )
        .all(...types);
    facetCache.set(key, {
      companies: group('company_slug', 120),
      roles: group('role'),
      categories: group('category'),
      difficulties: group('difficulty'),
      rounds: group('round'),
      total: (db.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${where}`).get(...types) as { n: number }).n,
    });
  }
  return facetCache.get(key);
}

function list(db: Database.Database, params: URLSearchParams) {
  const types = typesOf(params.get('type'));
  const where = [`i.type IN (${types.map(() => '?').join(',')})`, 'i.listed=1'],
    args: (string | number)[] = [...types];
  for (const [param, column] of [
    ['company', 'company_slug'],
    ['role', 'role'],
    ['category', 'category'],
    ['difficulty', 'difficulty'],
    ['round', 'round'],
    ['kind', 'type'],
  ] as const) {
    const value = params.get(param);
    if (value) {
      where.push(`i.${column} = ?`);
      args.push(value.slice(0, 120));
    }
  }
  const q = ftsQuery((params.get('q') || '').slice(0, 120));
  const from = q
    ? `items_fts f JOIN items i ON i.rowid=f.rowid`
    : 'items i';
  if (q) {
    where.push('items_fts MATCH ?');
    args.push(q);
  }
  const order = q && params.get('sort') !== 'new' ? 'f.rank' : 'i.published_at DESC, i.rowid DESC';
  const page = Math.min(2000, Math.max(1, Number(params.get('page')) || 1));
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM ${from} WHERE ${where.join(' AND ')}`).get(...args) as { n: number }).n;
  const items = db
    .prepare(
      `SELECT ${SUMMARY.split(',').map((c) => `i.${c}`).join(',')} FROM ${from}
       WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
    )
    .all(...args) as Record<string, unknown>[];
  return { items: items.map(row), total, page, pageSize: PAGE, facets: facets(db, types) };
}

function item(db: Database.Database, params: URLSearchParams) {
  const types = typesOf(params.get('type'));
  const slug = (params.get('slug') || '').slice(0, 300);
  const found = db
    .prepare(`SELECT * FROM items WHERE type IN (${types.map(() => '?').join(',')}) AND slug=? LIMIT 1`)
    .get(...types, slug) as Record<string, unknown> | undefined;
  if (!found) throw new HttpError(404, '内容不存在');
  // Resolve related items we actually have, keeping their titles current.
  const relations = (JSON.parse(found.relations as string) as { kind: string; slug: string; title?: string }[])
    .slice(0, 40)
    .map((rel) => {
      const kinds: Record<string, readonly ItemType[]> = {
        question: GROUPS.questions,
        experience: ['experience'],
        guide: ['guide'],
        concept: ['concept'],
        course: ['course'],
        lesson: ['lesson'],
      };
      const target = kinds[rel.kind]
        ? (db
            .prepare(`SELECT type,slug,title,company_name,difficulty FROM items WHERE type IN (${kinds[rel.kind].map(() => '?').join(',')}) AND slug=? AND listed=1`)
            .get(...kinds[rel.kind], rel.slug) as Record<string, unknown> | undefined)
        : undefined;
      return target ? { kind: rel.kind, ...target } : null;
    })
    .filter(Boolean);
  return {
    ...row(found),
    body: found.body,
    updatedAt: found.updated_at,
    extra: JSON.parse(found.extra as string),
    relations,
    dupOf: found.dup_of ? JSON.parse(found.dup_of as string) : null,
  };
}

function stats(db: Database.Database) {
  const counts = db
    .prepare('SELECT type, COUNT(*) AS n FROM items WHERE listed=1 GROUP BY type')
    .all() as { type: string; n: number }[];
  const companies = (db.prepare('SELECT COUNT(DISTINCT company_slug) AS n FROM items WHERE listed=1').get() as { n: number }).n;
  const built = (db.prepare("SELECT value FROM meta WHERE key='built_at'").get() as { value: string } | undefined)?.value;
  return { counts: Object.fromEntries(counts.map((c) => [c.type, c.n])), companies, updatedAt: built ?? null };
}

export async function handleContent(request: Request, p: Person | null, path: string[]) {
  if (request.method !== 'GET') throw new HttpError(405, '只支持读取');
  await limitReader(request, p, 'content-read', 240);
  const db = library();
  const params = new URL(request.url).searchParams;
  const [action] = path;
  if (!db) {
    if (action === 'stats') return json({ counts: {}, companies: 0, updatedAt: null });
    if (action === 'list') return json({ items: [], total: 0, page: 1, pageSize: PAGE, facets: null });
    throw new HttpError(404, '内容库尚未发布');
  }
  if (action === 'list') return json(list(db, params));
  if (action === 'item') return json(item(db, params));
  if (action === 'stats') return json(stats(db));
  throw new HttpError(404, '接口不存在');
}
