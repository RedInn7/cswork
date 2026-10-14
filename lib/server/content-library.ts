import Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Person } from './auth';
import { setting } from './env';
import { HttpError, json, limitReader } from './http';
import { mockCompanies, mockPool, mockSet } from './mock-interview';

/**
 * Read-only interview content library (questions, experiences, guides, concepts,
 * articles, cheatsheets, algorithm tutorials) built offline into its own SQLite file, separate
 * from user data. Replacing the file is picked up without a restart.
 */
const TYPES = [
  'coding_question', 'interview_question', 'experience', 'guide', 'concept',
  'article', 'cheatsheet', 'algorithm',
] as const;
type ItemType = (typeof TYPES)[number];
const GROUPS: Record<string, readonly ItemType[]> = {
  questions: ['coding_question', 'interview_question'],
};
const PAGE = 20;
const SUMMARY = `type,slug,title,summary,title_zh,summary_zh,level,company_slug,company_name,role,category,difficulty,round,seniority,tags,published_at,partial`;

let handle: { db: Database.Database; mtime: number; checked: number } | null = null;
/** The library's read-only handle (null before it is published); server pages share it. */
export function library() {
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
  if (value && Object.hasOwn(GROUPS, value)) return GROUPS[value];
  if (value && (TYPES as readonly string[]).includes(value)) return [value as ItemType];
  throw new HttpError(400, '未知的内容类型');
}
const row = (r: Record<string, unknown>) => ({
  type: r.type,
  slug: r.slug,
  title: r.title,
  summary: r.summary,
  // Bilingual tutorials carry Chinese too; the client picks by site language.
  titleZh: r.title_zh ?? null,
  summaryZh: r.summary_zh ?? null,
  level: r.level ?? null,
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
/**
 * FTS5 query from free text: each word quoted and AND-ed. Only words of 3+ characters are
 * prefix-matched; a one- or two-letter prefix walks most of the index and blocks the process.
 */
function ftsQuery(q: string) {
  const words = q.match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) || [];
  return words.map((w) => (w.length >= 3 ? `"${w}"*` : `"${w}"`)).join(' ');
}
const CJK = /[\u3400-\u9fff]/;

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
      // The company menu is capped; this is the real count.
      companyTotal: (db.prepare(`SELECT COUNT(DISTINCT company_slug) AS n FROM items WHERE ${where}`).get(...types) as { n: number }).n,
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
  const text = (params.get('q') || '').trim().slice(0, 120);
  // The index does not segment Chinese, so Chinese searches match titles, summaries and the
  // Chinese text of tutorials by substring instead; every word has to appear.
  const cjk = CJK.test(text);
  const q = cjk ? '' : ftsQuery(text);
  if (cjk) {
    const has = `LIKE ? ESCAPE '\\'`;
    for (const word of text.split(/\s+/).slice(0, 6)) {
      const like = `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push(
        `(i.title ${has} OR i.summary ${has} OR i.title_zh ${has} OR i.summary_zh ${has} OR (i.type = 'algorithm' AND i.extra ${has}))`,
      );
      args.push(like, like, like, like, like);
    }
  }
  const page = Math.min(2000, Math.max(1, Math.floor(Number(params.get('page'))) || 1));
  const offset = (page - 1) * PAGE;
  const columns = SUMMARY.split(',').map((c) => `i.${c}`).join(',');
  let total: number;
  let items: Record<string, unknown>[];
  if (q) {
    // Rank inside the index and keep this list's rows only. `+rowid` stops SQLite from pushing the
    // IN list into FTS (one MATCH per row), and joining after LIMIT reads 20 rows, not every hit:
    // "interview" matches ~20k items and used to block the process for a second or more.
    const hits = `FROM items_fts WHERE items_fts MATCH ? AND +rowid IN (SELECT i.rowid FROM items i WHERE ${where.join(' AND ')})`;
    total = (db.prepare(`SELECT COUNT(*) AS n ${hits}`).get(q, ...args) as { n: number }).n;
    items =
      offset >= total
        ? []
        : (db
            .prepare(
              `SELECT ${columns} FROM (SELECT rowid AS id, rank AS r ${hits} ORDER BY rank LIMIT ${PAGE} OFFSET ${offset}) f
               JOIN items i ON i.rowid=f.id ORDER BY f.r`,
            )
            .all(q, ...args) as Record<string, unknown>[]);
  } else {
    // Tutorials read as a syllabus (core first, in the order they were written); the rest newest first.
    const order = types.includes('algorithm') ? "i.level = 'advanced', i.rowid" : 'i.published_at DESC, i.rowid DESC';
    total = (db.prepare(`SELECT COUNT(*) AS n FROM items i WHERE ${where.join(' AND ')}`).get(...args) as { n: number }).n;
    items =
      offset >= total
        ? []
        : (db
            .prepare(`SELECT ${columns} FROM items i WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${PAGE} OFFSET ${offset}`)
            .all(...args) as Record<string, unknown>[]);
  }
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
        algorithm: ['algorithm'],
      };
      const target = Object.hasOwn(kinds, rel.kind)
        ? (db
            // Unlisted duplicates still resolve: their page points at the kept copy.
            .prepare(`SELECT type,slug,title,company_name,difficulty FROM items WHERE type IN (${kinds[rel.kind].map(() => '?').join(',')}) AND slug=?`)
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
  if (facetCache.has('stats')) return facetCache.get('stats');
  const counts = db
    .prepare('SELECT type, COUNT(*) AS n FROM items WHERE listed=1 GROUP BY type')
    .all() as { type: string; n: number }[];
  const companies = (db.prepare('SELECT COUNT(DISTINCT company_slug) AS n FROM items WHERE listed=1').get() as { n: number }).n;
  const built = (db.prepare("SELECT value FROM meta WHERE key='built_at'").get() as { value: string } | undefined)?.value;
  const result = { counts: Object.fromEntries(counts.map((c) => [c.type, c.n])), companies, updatedAt: built ?? null };
  facetCache.set('stats', result);
  return result;
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
  // Mock interviews: a drawn set, and the companies to draw from.
  if (action === 'mock') return json(mockSet(db, params));
  if (action === 'mock-companies') return json({ companies: mockCompanies(db), total: mockPool(db).length });
  throw new HttpError(404, '接口不存在');
}
