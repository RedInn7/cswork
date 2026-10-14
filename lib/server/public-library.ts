import Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { experienceFactsOf, type ExperienceFacts } from '@/lib/experience';

export const PUBLIC_LIBRARY_TYPES = {
  algorithm: 'Algorithm tutorials',
  coding_question: 'Coding questions',
  interview_question: 'Interview questions',
  experience: 'Interview experiences',
  guide: 'Interview guides',
  concept: 'Computer science concepts',
  article: 'Articles',
  cheatsheet: 'Cheatsheets',
} as const;
export type PublicLibraryType = keyof typeof PUBLIC_LIBRARY_TYPES;
export const PUBLIC_LIBRARY_PAGE_SIZE = 24;
export const PUBLIC_LIBRARY_SITEMAP_SIZE = 45000;
const typeNames = Object.keys(PUBLIC_LIBRARY_TYPES);
const publicWhere = `listed=1 AND partial=0 AND dup_of IS NULL
  AND type IN (${typeNames.map(() => '?').join(',')})
  AND length(slug) BETWEEN 1 AND 300 AND slug NOT GLOB '*[^a-zA-Z0-9_-]*'
  AND trim(title)<>''`;

function publicSelection(indexable = false) {
  // The import removes taken-down material before publication. Also honor current
  // company visibility when a deployment changes it before rebuilding the library.
  const hidden = (process.env.HIDDEN_COMPANIES || '')
    .split(',')
    .map((slug) => slug.trim().toLowerCase())
    .filter((slug) => /^[a-z0-9-]{1,80}$/.test(slug));
  return {
    where:
      publicWhere +
      (indexable ? " AND type<>'guide'" : '') +
      (hidden.length
        ? ` AND LOWER(COALESCE(company_slug,'')) NOT IN (${hidden.map(() => '?').join(',')})`
        : ''),
    args: [...typeNames, ...hidden],
  };
}

export type PublicLibraryItem = {
  type: PublicLibraryType;
  slug: string;
  title: string;
  summary: string | null;
  company: string | null;
  updatedAt: string | null;
};
export type PublicLibraryDetail = PublicLibraryItem & {
  body: string;
  math: boolean;
  companySlug: string | null;
  /** Experiences: self-reported outcome, rounds and interview date. */
  facts: ExperienceFacts | null;
};
export type PublicLibraryQuery = { type?: PublicLibraryType; page: number };

// Only one database snapshot and at most ten integer counts are retained. A
// rebuilt/replaced library or changed visibility takes effect on the next read.
const COUNT_TTL = 15000;
let countCache: {
  key: string;
  expires: number;
  values: Map<string, number>;
} | null = null;

function refreshCountCache(path: string) {
  const stat = statSync(path);
  const key = JSON.stringify([
    resolve(path),
    stat.mtimeMs,
    stat.size,
    stat.ino,
    process.env.HIDDEN_COMPANIES || '',
  ]);
  const now = Date.now();
  if (!countCache || countCache.key !== key || now >= countCache.expires)
    countCache = { key, expires: now + COUNT_TTL, values: new Map() };
}

function countItems(
  db: Database.Database,
  type?: PublicLibraryType,
  indexable = false,
) {
  const key = indexable ? 'sitemap' : type || 'all';
  const cached = countCache?.values.get(key);
  if (cached !== undefined) return cached;
  const selection = publicSelection(indexable);
  const where = selection.where + (type ? ' AND type=?' : '');
  const args = type ? [...selection.args, type] : selection.args;
  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM items WHERE ${where}`)
    .get(...args) as { total: number };
  countCache?.values.set(key, total);
  return total;
}

/** No application database import, session lookup, seed, or write is allowed here. */
function readLibrary<T>(missing: T, read: (db: Database.Database) => T): T {
  const path =
    process.env.CONTENT_DATABASE_PATH || resolve('data/content.sqlite');
  if (!existsSync(path)) {
    countCache = null;
    return missing;
  }
  refreshCountCache(path);
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    return read(db);
  } finally {
    db.close();
  }
}

export function isPublicLibraryType(value: string): value is PublicLibraryType {
  return Object.hasOwn(PUBLIC_LIBRARY_TYPES, value);
}

export function publicLibraryPath(type: string, slug: string): string {
  return `/library/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`;
}

export function publicLibraryListPath({
  type,
  page,
}: PublicLibraryQuery): string {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (page > 1) params.set('page', String(page));
  return '/library' + (params.size ? `?${params}` : '');
}

export function parsePublicLibraryQuery(
  params: Record<string, string | string[] | undefined>,
): PublicLibraryQuery | null {
  const { type, page } = params;
  if (
    type !== undefined &&
    (typeof type !== 'string' || !isPublicLibraryType(type))
  )
    return null;
  if (
    page !== undefined &&
    (typeof page !== 'string' || !/^[1-9]\d{0,6}$/.test(page))
  )
    return null;
  return { type, page: page === undefined ? 1 : Number(page) };
}

const columns =
  'type,slug,title,summary,company_name AS company,COALESCE(updated_at,published_at) AS updatedAt';

export function publicLibraryList(query: PublicLibraryQuery) {
  if (
    !Number.isSafeInteger(query.page) ||
    query.page < 1 ||
    query.page > 9999999 ||
    (query.type !== undefined && !isPublicLibraryType(query.type))
  )
    return null;
  return readLibrary(
    query.page === 1
      ? { items: [] as PublicLibraryItem[], total: 0, pages: 1 }
      : null,
    (db) => {
      const selection = publicSelection();
      const where = selection.where + (query.type ? ' AND type=?' : '');
      const args = query.type
        ? [...selection.args, query.type]
        : selection.args;
      const total = countItems(db, query.type);
      const pages = Math.max(1, Math.ceil(total / PUBLIC_LIBRARY_PAGE_SIZE));
      if (query.page > pages) return null;
      const items = db
        .prepare(`SELECT ${columns} FROM items WHERE ${where}
      ORDER BY type,slug LIMIT ? OFFSET ?`)
        .all(
          ...args,
          PUBLIC_LIBRARY_PAGE_SIZE,
          (query.page - 1) * PUBLIC_LIBRARY_PAGE_SIZE,
        ) as PublicLibraryItem[];
      return { items, total, pages };
    },
  );
}

export function publicLibraryItem(
  type: string,
  slug: string,
): PublicLibraryDetail | null {
  if (!isPublicLibraryType(type) || !/^[a-zA-Z0-9_-]{1,300}$/.test(slug))
    return null;
  return readLibrary<PublicLibraryDetail | null>(null, (db) => {
    const { where, args } = publicSelection();
    const item = db
      .prepare(`SELECT ${columns},company_slug AS companySlug,body,extra FROM items WHERE ${where}
      AND type=? AND slug=? LIMIT 1`)
      .get(...args, type, slug) as
      | (PublicLibraryItem & { companySlug: string | null; body: string; extra: string })
      | undefined;
    if (!item || !item.body.trim()) return null;
    const { extra, ...detail } = item;
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(extra);
    } catch {
      /* Plain Markdown remains readable. */
    }
    return {
      ...detail,
      math: parsed?.math === true,
      facts: type === 'experience' ? experienceFactsOf(parsed) : null,
    };
  });
}

export function publicLibraryCount(): number {
  return readLibrary(0, (db) => countItems(db, undefined, true));
}

/** Deterministic bounded batches let the sitemap cover all entries without a giant allocation. */
export function publicLibraryEntries(
  offset = 0,
  limit = PUBLIC_LIBRARY_SITEMAP_SIZE,
) {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50000
  )
    throw new RangeError('Invalid public library sitemap batch');
  return readLibrary(
    [] as Pick<PublicLibraryItem, 'type' | 'slug' | 'updatedAt'>[],
    (db) => {
      const { where, args } = publicSelection(true);
      return db
        .prepare(`SELECT type,slug,COALESCE(updated_at,published_at) AS updatedAt FROM items
      WHERE ${where} ORDER BY type,slug LIMIT ? OFFSET ?`)
        .all(...args, limit, offset) as Pick<
        PublicLibraryItem,
        'type' | 'slug' | 'updatedAt'
      >[];
    },
  );
}

export function publicLibraryDescription(
  item: Pick<PublicLibraryDetail, 'title' | 'summary' | 'body'>,
): string {
  const text = (item.summary || item.body || item.title)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[#*_`~>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 170
    ? text.slice(0, 167).trimEnd() + '…'
    : text || item.title;
}
