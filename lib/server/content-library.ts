import Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { sqlite } from '@/db/sqlite';
import { lcIdBySource } from '@/lib/company-tags';
import { experienceColumns, experienceFacts, experienceFactsOf, MEMBER_FILTERS } from '@/lib/experience';
import type { Person } from './auth';
import { companyPractice } from './company-hub';
import { memberExperiences, memberFacets, memberIdOf, memberItem, mergePage, type MemberSummary } from './experience-submissions';
import { setting } from './env';
import { HttpError, json, limitReader } from './http';
import { recentSince, VERIFIED } from './learner-cloud';
import { mockCompanies, mockPool, mockSet } from './mock-interview';
import { acceptedPeople } from './problem-stats';

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
  // Site search (components/command-palette.tsx): every written page, not the programmatic guides.
  search: TYPES.filter((t) => t !== 'guide'),
};
const PAGE = 20;
const DAY = 86400000;
/** ?sort=popular|hot rank this many of the newest matching rows. */
const RANKED = 3000;
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
  // Experiences: self-reported outcome, rounds and interview date (lib/experience.ts).
  ...(r.type === 'experience' ? experienceFacts(r) : {}),
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
      seniorities: group('seniority'),
      // Self-reported outcomes of experiences; a filter, not a pass rate (most reports have none).
      results: types.includes('experience') ? group(`json_extract(extra,'$.result')`, 10) : [],
      total: (db.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${where}`).get(...types) as { n: number }).n,
      // The company menu is capped; this is the real count.
      companyTotal: (db.prepare(`SELECT COUNT(DISTINCT company_slug) AS n FROM items WHERE ${where}`).get(...types) as { n: number }).n,
    });
  }
  return facetCache.get(key);
}

// ---------------------------------------------------------------- what learners did with items

type Engagement = { stars: number; ups: number; answers: number };
type Reports = Map<string, { n: number; last: string }>;
// ponytail: site-wide aggregates over the user database, kept 10 minutes like problem-stats.
let engaged: { at: number; items: Map<string, Engagement>; reports: Reports } | null = null;
/**
 * Per item (`<type>/<slug>`): stars and upvotes (user_marks on content:<type>/<slug>) by verified
 * accounts only, like list stars, so throwaway accounts cannot lift an item up the popular order, and
 * visible answers or comments (solution_posts on q:<slug>, exp:<slug>); per reported id (q:<slug>, lc-<n>):
 * distinct learners who said they were asked it in the recent months, and the latest month.
 */
function engagement(now = Date.now()) {
  if (engaged && now - engaged.at < 10 * 60_000) return engaged;
  const db = sqlite();
  const items = new Map<string, Engagement>();
  const of = (key: string) => {
    let e = items.get(key);
    if (!e) items.set(key, (e = { stars: 0, ups: 0, answers: 0 }));
    return e;
  };
  const marks = db
    .prepare(
      `SELECT substr(target,9) AS key,SUM(mark='star') AS stars,SUM(mark='up') AS ups FROM user_marks
       WHERE target>='content:' AND target<'content;' AND mark IN ('star','up') AND ${VERIFIED('user_marks.user_id')}
       GROUP BY target`,
    )
    .all() as { key: string; stars: number; ups: number }[];
  for (const m of marks) Object.assign(of(m.key), { stars: m.stars, ups: m.ups });
  const posts = db
    .prepare(
      `SELECT problem_id AS target,COUNT(*) AS n FROM solution_posts
       WHERE hidden=0 AND ((problem_id>='q:' AND problem_id<'q;') OR (problem_id>='exp:' AND problem_id<'exp;'))
       GROUP BY problem_id`,
    )
    .all() as { target: string; n: number }[];
  for (const p of posts)
    of(p.target.startsWith('q:') ? `interview_question/${p.target.slice(2)}` : `experience/${p.target.slice(4)}`).answers = p.n;
  const reports: Reports = new Map(
    (
      db
        .prepare(
          `SELECT problem_id AS id,COUNT(DISTINCT user_id) AS n,MAX(asked_month) AS last FROM problem_reports
           WHERE asked_month>=? AND ((problem_id>='q:' AND problem_id<'q;') OR problem_id LIKE 'lc-%') GROUP BY problem_id`,
        )
        .all(recentSince(now)) as { id: string; n: number; last: string }[]
    ).map((r) => [r.id, { n: r.n, last: r.last }]),
  );
  engaged = { at: now, items, reports };
  return engaged;
}

/**
 * A card's `stats`: answers (comments on an experience), upvotes, recent "I was asked this" reports
 * (an interview question as q:<slug>, a coding question as the judge problem it maps to) and, for
 * a mapped coding question, the people who solved it (above problem-stats' floor). `score` ranks
 * ?sort=popular: stars + 2 × answers + 3 × reporters + upvotes.
 */
function engagementOf(type: string, slug: string, index = engagement()) {
  const e = index.items.get(`${type}/${slug}`) ?? { stars: 0, ups: 0, answers: 0 };
  const lc = type === 'coding_question' ? lcIdBySource.get(slug) : undefined;
  const asked = index.reports.get(type === 'interview_question' ? `q:${slug}` : (lc ?? ''));
  return {
    stats: {
      answers: e.answers,
      ups: e.ups,
      asked: asked ?? null,
      practised: (lc && acceptedPeople().get(lc)) || null,
    },
    score: e.stars + 2 * e.answers + 3 * (asked?.n ?? 0) + e.ups,
  };
}
/** Items a teacher marked curated (only teachers can, lib/server/my-practice.ts), as `<type>/<slug>`. */
function curatedItems() {
  return new Set(
    sqlite()
      .prepare(
        `SELECT DISTINCT substr(target,9) FROM user_marks
         WHERE target>='content:' AND target<'content;' AND mark='curated'`,
      )
      .pluck()
      .all() as string[],
  );
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
    ['seniority', 'seniority'],
    ['kind', 'type'],
  ] as const) {
    const value = params.get(param);
    if (value) {
      where.push(`i.${column} = ?`);
      args.push(value.slice(0, 120));
    }
  }
  const result = params.get('result');
  if (result) {
    where.push(`json_extract(i.extra,'$.result') = ?`);
    args.push(result.slice(0, 40));
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
  // curated=1: what teachers picked.
  const curated = curatedItems();
  const picked = params.get('curated') === '1';
  if (picked) {
    where.push(`(i.type||'/'||i.slug) IN (SELECT value FROM json_each(?))`);
    args.push(JSON.stringify([...curated]));
  }
  const page = Math.min(2000, Math.max(1, Math.floor(Number(params.get('page'))) || 1));
  const offset = (page - 1) * PAGE;
  const columns = `${SUMMARY.split(',').map((c) => `i.${c}`).join(',')},${experienceColumns('i.')}`;
  // Approved member submissions merge into the experiences list (lib/server/experience-submissions.ts).
  const experiences = types.length === 1 && types[0] === 'experience';
  const members = (experiences ? memberExperiences(params) : []).filter(
    (m) => !picked || curated.has(`experience/${m.item.slug}`),
  );
  // Employment, season, channel and a verified author exist on member posts only: such a filter lists those alone.
  const memberOnly = MEMBER_FILTERS.some((key) => params.get(key));
  const index = engagement();
  // Every card says whether it is curated and what learners did with it.
  const decorate = (item: Record<string, unknown>) => ({
    ...item,
    curated: curated.has(`${item.type}/${item.slug}`),
    stats: engagementOf(item.type as string, item.slug as string, index).stats,
  });
  const reply = (items: Record<string, unknown>[], total: number) => ({
    items: items.map(decorate),
    total,
    page,
    pageSize: PAGE,
    facets: facets(db, types),
    memberFacets: experiences ? memberFacets() : null,
    ...(memberOnly && { memberOnly: true }),
  });
  const sort = params.get('sort');
  if (sort === 'popular' || sort === 'hot') {
    // popular: by score; hot: score / (age in days + 2)^1.5, so new activity rises and old fades.
    // ponytail: ranks the newest RANKED matching rows in JS; a stored score if lists outgrow it.
    const rows = memberOnly
      ? []
      : (db
          .prepare(
            `SELECT i.rowid AS id,i.type,i.slug,i.published_at AS at FROM items i WHERE ${where.join(' AND ')}
             ${q ? 'AND i.rowid IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?)' : ''}
             ORDER BY i.published_at DESC, i.rowid DESC LIMIT ${RANKED}`,
          )
          .all(...args, ...(q ? [q] : [])) as { id: number; type: string; slug: string; at: string | null }[]);
    const now = Date.now();
    const heat = (type: string, slug: string, at: string | null) => {
      const score = engagementOf(type, slug, index).score;
      const days = (now - Date.parse(at ?? '')) / DAY;
      return sort === 'popular' ? score : score / ((Number.isFinite(days) ? Math.max(0, days) : 3650) + 2) ** 1.5;
    };
    const ranked: { id?: number; member?: MemberSummary; at: string; heat: number }[] = [
      ...rows.map((r) => ({ id: r.id, at: r.at ?? '', heat: heat(r.type, r.slug, r.at) })),
      ...members.map(({ item }) => ({ member: item, at: item.publishedAt ?? '', heat: heat('experience', item.slug, item.publishedAt) })),
    ].sort((a, b) => b.heat - a.heat || b.at.localeCompare(a.at));
    const shown = ranked.slice(offset, offset + PAGE);
    const byId = new Map(
      (
        db
          .prepare(`SELECT i.rowid AS rid,${columns} FROM items i WHERE i.rowid IN (SELECT value FROM json_each(?))`)
          .all(JSON.stringify(shown.flatMap((c) => (c.id === undefined ? [] : [c.id])))) as Record<string, unknown>[]
      ).map((r) => [r.rid, row(r)]),
    );
    return reply(
      shown.map((c) => (c.member ?? byId.get(c.id!)!) as Record<string, unknown>),
      ranked.length,
    );
  }
  if (memberOnly)
    return reply(
      members.slice(offset, offset + PAGE).map((m) => m.item),
      members.length,
    );
  let total: number;
  let read: (limit: number, skip: number) => Record<string, unknown>[];
  // Every matching row's sort key, for placing member posts; null when ranked by relevance.
  let keys: () => (string | null)[] | null = () => null;
  if (q) {
    // Rank inside the index and keep this list's rows only. `+rowid` stops SQLite from pushing the
    // IN list into FTS (one MATCH per row), and joining after LIMIT reads 20 rows, not every hit:
    // "interview" matches ~20k items and used to block the process for a second or more.
    const hits = `FROM items_fts WHERE items_fts MATCH ? AND +rowid IN (SELECT i.rowid FROM items i WHERE ${where.join(' AND ')})`;
    total = (db.prepare(`SELECT COUNT(*) AS n ${hits}`).get(q, ...args) as { n: number }).n;
    read = (limit, skip) =>
      skip >= total
        ? []
        : (db
            .prepare(
              `SELECT ${columns} FROM (SELECT rowid AS id, rank AS r ${hits} ORDER BY rank LIMIT ${limit} OFFSET ${skip}) f
               JOIN items i ON i.rowid=f.id ORDER BY f.r`,
            )
            .all(q, ...args) as Record<string, unknown>[]);
  } else {
    // Tutorials read as a syllabus (core first, in the order they were written); experiences by
    // when they happened (the interview's date, else the report's) unless ?sort=new; the rest newest first.
    const byDate = types.length === 1 && types[0] === 'experience' && params.get('sort') !== 'new';
    const date = "COALESCE(json_extract(i.extra,'$.date'), substr(i.published_at,1,10))";
    const order = types.includes('algorithm')
      ? "i.level = 'advanced', i.rowid"
      : byDate
        ? `${date} DESC, i.published_at DESC, i.rowid DESC`
        : 'i.published_at DESC, i.rowid DESC';
    total = (db.prepare(`SELECT COUNT(*) AS n FROM items i WHERE ${where.join(' AND ')}`).get(...args) as { n: number }).n;
    read = (limit, skip) =>
      skip >= total
        ? []
        : (db
            .prepare(`SELECT ${columns} FROM items i WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${limit} OFFSET ${skip}`)
            .all(...args) as Record<string, unknown>[]);
    // ponytail: every matching key per request (~4k experiences, a few ms); cache per filter if it shows in profiles.
    keys = () =>
      db
        .prepare(`SELECT ${byDate ? date : 'i.published_at'} FROM items i WHERE ${where.join(' AND ')}`)
        .pluck()
        .all(...args) as (string | null)[];
  }
  const items = members.length
    ? mergePage(members, keys(), offset, PAGE, (limit, skip) => read(limit, skip).map(row))
    : read(PAGE, offset).map(row);
  return reply(items as Record<string, unknown>[], total + members.length);
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
            .prepare(`SELECT type,slug,title,company_name,difficulty,json_extract(dup_of,'$.problem') AS problem FROM items WHERE type IN (${kinds[rel.kind].map(() => '?').join(',')}) AND slug=?`)
            .get(...kinds[rel.kind], rel.slug) as Record<string, unknown> | undefined)
        : undefined;
      // `problem`: the judge problem a related question can be practised on, if any.
      return target
        ? {
            kind: rel.kind,
            ...target,
            problem: target.problem ?? (target.type === 'coding_question' ? lcIdBySource.get(target.slug as string) : null) ?? null,
          }
        : null;
    })
    .filter(Boolean);
  const extra = JSON.parse(found.extra as string);
  return {
    ...row(found),
    curated: curatedItems().has(`${found.type}/${found.slug}`),
    stats: engagementOf(found.type as string, found.slug as string).stats,
    ...(found.type === 'experience' ? experienceFactsOf(extra) : {}),
    body: found.body,
    updatedAt: found.updated_at,
    extra,
    relations,
    dupOf: found.dup_of ? JSON.parse(found.dup_of as string) : null,
    /** The judgeable LeetCode problem this coding question maps to (company-lc-map). */
    practice: (found.type === 'coding_question' && lcIdBySource.get(found.slug as string)) || null,
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
  // A member's own experience (lib/server/experience-submissions.ts), library or not.
  if (action === 'item' && params.get('type') === 'experience' && memberIdOf(params.get('slug'))) {
    const found = await memberItem(db, params.get('slug')!, p);
    return json({
      ...found,
      curated: curatedItems().has(`experience/${found.slug}`),
      stats: engagementOf('experience', found.slug).stats,
    });
  }
  if (!db) {
    if (action === 'stats') return json({ counts: {}, companies: 0, updatedAt: null });
    if (action === 'list') return json({ items: [], total: 0, page: 1, pageSize: PAGE, facets: null });
    throw new HttpError(404, '内容库尚未发布');
  }
  if (action === 'list') return json(list(db, params));
  if (action === 'item') {
    const found = item(db, params);
    // Experiences and interview questions point at practice for their company.
    const practice =
      found.type === 'experience' || found.type === 'interview_question'
        ? await companyPractice(db, found.company?.slug as string | undefined)
        : null;
    return json({ ...found, companyPractice: practice });
  }
  if (action === 'stats') return json(stats(db));
  // Mock interviews: a drawn set, and the companies to draw from.
  if (action === 'mock') return json(mockSet(db, params, p));
  if (action === 'mock-companies') return json({ companies: mockCompanies(db), total: mockPool(db).length });
  throw new HttpError(404, '接口不存在');
}
