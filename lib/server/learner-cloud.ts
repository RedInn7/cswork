import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { achievements, longestStreak } from '@/lib/achievements';
import { classicListProgress } from '@/lib/classic-lists';
import { REPORT_CLEARED, REPORTS_HIDE } from '@/lib/community';
import { curatedByNumber, curatedEntries } from '@/lib/ling-curated';
import { reportWindow, slotOf, SLOTS, type MockSession, type Slot } from '@/lib/mock-oa';
import { LINE_MAX, parseListImport } from '@/lib/list-import';
import { LANGUAGE_IDS } from '@/lib/problems';
import { canonicalCompany, employerSlug, OTHER_COMPANY } from '@/lib/oa-company-brands';
import type { Person } from './auth';
import { companyDirectory, hasHub } from './company-hub';
import { myCertificates } from './certificates';
import { duelRecord, ratingHistory } from './contest-ratings';
import { library } from './content-library';
import { hiddenCompanies, shownOaSql } from './env';
import { MEMBER_ASKED } from './experience-submissions';
import { HttpError, json, limit, limitReader, requirePerson } from './http';
import { mockReport } from './mock-oa';
import { readJson } from './my-practice';
import { canSeeProblem, listProblemSummaries } from './oj-problems';
import { mutualFollow } from './follows';
import { dailyDays } from './points';
import { reputationSql, visibleTarget } from './solution-posts';
import { badgeName, badgeSql, badgeTarget } from './work-verify';

/**
 * Learner data that lives on the server (db/learner-cloud-schema.ts): finished mock OAs,
 * problem lists, the opt-in public profile and "I was asked this" reports. Every write
 * names its owner in the WHERE clause; a list or profile someone else owns reads as missing.
 */
const DAY = 86400000;
const HOUR = 3600000;
// ponytail: flat per-learner caps keep a scripted client from growing the tables forever.
const MOCK_ROWS = 1000;
const LIST_MAX = 100;
const ITEM_MAX = 500;
const REPORTS_PER_DAY = 20;
/** Months a report counts towards "recently asked": this one and the five before. */
export const REPORT_MONTHS = 6;

const problemId = z.string().regex(/^(?:oa-[a-z0-9-]{1,180}|lc-\d{1,6})$/);
/** What a learner can say they were asked: a judge problem, or a library interview question (q:<slug>). */
const reported = z.union([problemId, z.string().regex(/^q:[\w-]{1,300}$/)]);
const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const month = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);

/** A judge problem id of a hidden company (HIDDEN_COMPANIES) reads as missing everywhere. */
function hiddenProblem(id: string, hidden = hiddenCompanies()) {
  const company = /^oa-(.+)-\d+$/.exec(id)?.[1];
  return !!company && (hidden.has(company) || hidden.has(canonicalCompany(company)));
}
/** Published OA or Line 500 problems only: course exercises never enter lists or reports. */
export async function publicProblem(p: Person, id: string) {
  return problemId.safeParse(id).success && !hiddenProblem(id) && (await canSeeProblem(p, id));
}
/** Reports and public pages need a verified address (teachers excepted), or they are a spam inlet. */
export function requireVerified(p: Person) {
  if (!p.verified && p.role !== 'teacher') throw new HttpError(403, '请先验证邮箱');
}
export const monthKey = (time: number) => new Date(time).toISOString().slice(0, 7);
/** The first month (YYYY-MM, UTC) still inside the "recent" window at `now`. */
export function recentSince(now: number, months = REPORT_MONTHS) {
  const d = new Date(now);
  return monthKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (months - 1), 1));
}

// ---------------------------------------------------------------- mock OA history

const mockInput = z
  .object({
    id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
    company: slug.nullable(),
    name: z.string().max(120).nullable(),
    platform: z.string().max(60).nullable(),
    preset: z.boolean(),
    scoring: z.enum(['tests', 'gca', 'codility']),
    source: z.enum(['mixed', 'oa', 'lc']),
    slots: z.array(z.enum(['easy', 'medium', 'hard'])).min(1).max(4),
    ids: z.array(problemId).min(1).max(4),
    minutes: z.number().int().min(1).max(240),
    skew: z.number().min(-DAY).max(DAY),
    createdAt: z.number().int().positive(),
    startedAt: z.number().int().positive(),
    finishedAt: z.number().int().positive(),
    reason: z.enum(['manual', 'timeout']).default('manual'),
  })
  .refine((s) => s.slots.length === s.ids.length && s.finishedAt >= s.startedAt);

type MockRow = {
  id: string;
  company: string | null;
  name: string | null;
  platform: string | null;
  preset: number;
  scoring: MockSession['scoring'];
  source: MockSession['source'];
  ids_json: string;
  slots_json: string;
  minutes: number;
  skew: number;
  created_at: number;
  started_at: number;
  finished_at: number;
  reason: 'manual' | 'timeout';
  score: number | null;
  max: number | null;
  solved: number | null;
  estimate: number | null;
};
function mockSession(r: MockRow): MockSession {
  return {
    id: r.id,
    company: r.company,
    name: r.name,
    platform: r.platform,
    preset: !!r.preset,
    scoring: r.scoring,
    source: r.source,
    ids: JSON.parse(r.ids_json) as string[],
    slots: JSON.parse(r.slots_json) as Slot[],
    minutes: r.minutes,
    skew: r.skew,
    createdAt: r.created_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    reason: r.reason,
    ...(r.score === null
      ? {}
      : { result: { score: r.score, max: r.max ?? 0, solved: r.solved ?? 0, estimate: !!r.estimate } }),
  };
}

/** The learner's finished mocks, newest first; a hidden company's mocks stay out. */
export function mockHistory(userId: string, max = 100) {
  const hidden = hiddenCompanies();
  return (
    sqlite()
      .prepare('SELECT * FROM mock_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT ?')
      .all(userId, max) as MockRow[]
  )
    .map(mockSession)
    .filter((s) => !(s.company && hidden.has(s.company)) && !s.ids.some((id) => hiddenProblem(id, hidden)));
}

/**
 * Saves finished sessions from this browser. The score is the server's report over the
 * exam window, never the client's; a session whose verdicts are still pending is stored
 * without one and fills in on a later upload. Ids another learner owns are skipped.
 */
export async function saveMockSessions(p: Person, input: unknown) {
  const { sessions } = z
    .object({ sessions: z.array(z.unknown()).max(30) })
    .strict()
    .parse(input);
  const db = sqlite();
  const valid = sessions.flatMap((s) => {
    const parsed = mockInput.safeParse(s);
    return parsed.success ? [parsed.data] : [];
  });
  if (!valid.length) return { saved: [] as string[] };
  const known = new Map(
    (
      db
        .prepare(
          `SELECT id,user_id,score FROM mock_sessions WHERE id IN (${valid.map(() => '?').join(',')})`,
        )
        .all(...valid.map((s) => s.id)) as { id: string; user_id: string; score: number | null }[]
    ).map((r) => [r.id, r]),
  );
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM mock_sessions WHERE user_id=?').get(p.id) as {
    n: number;
  };
  let room = MOCK_ROWS - n;
  const saved: string[] = [];
  const upsert = db.prepare(
    `INSERT INTO mock_sessions(id,user_id,company,name,platform,preset,scoring,source,set_hash,ids_json,
      slots_json,minutes,skew,created_at,started_at,finished_at,reason,score,max,solved,estimate,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET score=excluded.score,max=excluded.max,solved=excluded.solved,
      estimate=excluded.estimate,updated_at=excluded.updated_at
    WHERE mock_sessions.user_id=excluded.user_id`,
  );
  for (const s of valid) {
    const row = known.get(s.id);
    if (row && (row.user_id !== p.id || row.score !== null)) {
      if (row.user_id === p.id) saved.push(s.id);
      continue;
    }
    if (!row && room <= 0) break;
    const session = { ...s, skew: Math.round(s.skew) } as MockSession;
    const { from, to } = reportWindow(session);
    const report = await mockReport(
      p,
      new URLSearchParams({
        ids: s.ids.join(','),
        from: String(from),
        to: String(to),
        scoring: s.scoring,
        slots: s.slots.join(','),
      }),
    ).catch((error: unknown) => {
      // An impossible window (over 4 hours, say) is not a mock this server would report.
      if (error instanceof HttpError) return null;
      throw error;
    });
    if (!report) continue;
    const done = !report.pending;
    upsert.run(
      s.id,
      p.id,
      s.company,
      s.name,
      s.platform,
      +s.preset,
      s.scoring,
      s.source,
      createHash('sha256').update(s.ids.join(',')).digest('hex').slice(0, 32),
      JSON.stringify(s.ids),
      JSON.stringify(s.slots),
      s.minutes,
      session.skew,
      s.createdAt,
      s.startedAt,
      s.finishedAt,
      s.reason,
      done ? report.score.value : null,
      done ? report.score.max : null,
      done ? report.items.filter((i) => i.best?.accepted).length : null,
      done ? +report.score.estimate : null,
      Date.now(),
    );
    if (!row) room--;
    saved.push(s.id);
  }
  return { saved };
}

/** GET/POST /api/oj/mock-oa/history. */
export async function handleMockHistory(request: Request, p: Person | null) {
  requirePerson(p);
  if (request.method === 'GET') {
    await limit(p, 'mock-history-read', 60);
    return json({ items: mockHistory(p.id) });
  }
  if (request.method !== 'POST') throw new HttpError(404, '模拟 OA 接口不存在');
  await limit(p, 'mock-history-write', 20);
  const result = await saveMockSessions(p, await readJson(request, 64000));
  return json({ ...result, items: mockHistory(p.id) });
}

// ---------------------------------------------------------------- problem lists

const listId = z.string().regex(/^[A-Za-z0-9_-]{12}$/);
const listFields = {
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000),
  visibility: z.enum(['private', 'public']),
};
type ListRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  visibility: 'private' | 'public';
  forked_from: string | null;
  created_at: number;
  updated_at: number;
};
export type ListSummary = {
  id: string;
  title: string;
  description: string;
  visibility: 'private' | 'public';
  forkedFrom: string | null;
  count: number;
  updatedAt: number;
};
const summary = (r: ListRow & { count: number }): ListSummary => ({
  id: r.id,
  title: r.title,
  description: r.description,
  visibility: r.visibility,
  forkedFrom: r.forked_from,
  count: r.count,
  updatedAt: r.updated_at,
});
/** Items a list shows: hidden companies' problems count nowhere, as in listItems. */
const count = () =>
  `(SELECT COUNT(*) FROM user_list_items i WHERE i.list_id=l.id${shownOaSql('i.problem_id')}) AS count`;

function myLists(userId: string, problem: string | null) {
  return (
    sqlite()
      .prepare(
        `SELECT l.*,${count()},EXISTS(SELECT 1 FROM user_list_items i WHERE i.list_id=l.id AND i.problem_id=?) AS has
        FROM user_lists l WHERE l.owner_id=? ORDER BY l.updated_at DESC, l.id`,
      )
      .all(problem, userId) as (ListRow & { count: number; has: number })[]
  ).map((r) => ({ ...summary(r), ...(problem ? { has: !!r.has } : {}) }));
}
/** A list the reader may see: the owner's own, or anyone's public one. Others read as missing. */
function readableList(id: string, userId: string | null) {
  const row = listId.safeParse(id).success
    ? (sqlite().prepare('SELECT * FROM user_lists WHERE id=?').get(id) as ListRow | undefined)
    : undefined;
  if (!row || (row.visibility !== 'public' && row.owner_id !== userId))
    throw new HttpError(404, '题单不存在');
  return row;
}
function ownList(id: string, userId: string) {
  const row = readableList(id, userId);
  if (row.owner_id !== userId) throw new HttpError(404, '题单不存在');
  return row;
}
function listItems(id: string) {
  const hidden = hiddenCompanies();
  return (
    sqlite()
      .prepare(
        'SELECT problem_id AS problemId,added_at AS addedAt FROM user_list_items WHERE list_id=? ORDER BY position,added_at',
      )
      .all(id) as { problemId: string; addedAt: number }[]
  ).filter((i) => !hiddenProblem(i.problemId, hidden));
}
/** The owner's handle when their public profile is on; nobody else is ever named. */
export function ownerHandle(ownerId: string) {
  return (
    (
      sqlite()
        .prepare('SELECT handle FROM user_profiles WHERE user_id=? AND visible=1')
        .get(ownerId) as { handle: string } | undefined
    )?.handle ?? null
  );
}
/**
 * Saves (user_marks star on list:<id>) and copies of a list, by verified accounts only, each
 * account once and never the owner: forking needs no verification, so one account forking
 * its own list again and again must not climb the plaza.
 */
export const VERIFIED = (col: string) => `EXISTS(SELECT 1 FROM "user" u WHERE u.id=${col} AND u.email_verified=1)`;
const STARS = (list: string) =>
  `(SELECT COUNT(*) FROM user_marks m WHERE m.target='list:'||${list} AND m.mark='star' AND ${VERIFIED('m.user_id')})`;
const FORKS = (list: string) =>
  `(SELECT COUNT(DISTINCT f.owner_id) FROM user_lists f WHERE f.forked_from=${list} AND ${VERIFIED('f.owner_id')}
    AND f.owner_id<>(SELECT o.owner_id FROM user_lists o WHERE o.id=${list}))`;
/** A list as its page shows it; null when missing or private to someone else. */
export function readList(id: string, userId: string | null) {
  try {
    const row = readableList(id, userId);
    const items = listItems(id);
    const counts = sqlite()
      .prepare(
        `SELECT ${STARS('@id')} AS stars,${FORKS('@id')} AS forks,
        EXISTS(SELECT 1 FROM user_marks WHERE user_id=@me AND target='list:'||@id AND mark='star') AS starred`,
      )
      .get({ id, me: userId ?? '' }) as { stars: number; forks: number; starred: number };
    return {
      ...summary({ ...row, count: items.length }),
      items,
      mine: row.owner_id === userId,
      owner: ownerHandle(row.owner_id),
      forkedFrom: row.forked_from,
      stars: counts.stars,
      forks: counts.forks,
      starred: !!counts.starred,
    };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
function newList(
  p: Person,
  fields: { title: string; description: string; visibility: 'private' | 'public' },
  forkedFrom: string | null = null,
) {
  const db = sqlite();
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM user_lists WHERE owner_id=?').get(p.id) as {
    n: number;
  };
  if (n >= LIST_MAX) throw new HttpError(409, '题单数量已达上限');
  const id = randomBytes(9).toString('base64url'),
    now = Date.now();
  db.prepare(
    `INSERT INTO user_lists(id,owner_id,title,description,visibility,forked_from,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)`,
  ).run(id, p.id, fields.title, fields.description, fields.visibility, forkedFrom, now, now);
  return id;
}
function addItems(id: string, problems: readonly string[]) {
  const db = sqlite();
  const insert = db.prepare(
    `INSERT INTO user_list_items(list_id,problem_id,position,added_at)
    VALUES(?,?,(SELECT COALESCE(MAX(position),0)+1 FROM user_list_items WHERE list_id=?),?)
    ON CONFLICT DO NOTHING`,
  );
  const now = Date.now();
  db.transaction(() => {
    let { n } = db.prepare('SELECT COUNT(*) AS n FROM user_list_items WHERE list_id=?').get(id) as {
      n: number;
    };
    for (const problem of problems) {
      if (n >= ITEM_MAX) throw new HttpError(409, '题单最多 500 道题');
      n += insert.run(id, problem, id, now).changes;
    }
    db.prepare('UPDATE user_lists SET updated_at=? WHERE id=?').run(now, id);
  })();
}

/** Lists the learner saved: public ones (or their own), newest save first. */
export function starredLists(userId: string) {
  return (
    sqlite()
      .prepare(
        `SELECT l.*,${count()},pr.handle AS owner FROM user_marks m JOIN user_lists l ON l.id=substr(m.target,6)
        LEFT JOIN user_profiles pr ON pr.user_id=l.owner_id AND pr.visible=1
        WHERE m.user_id=? AND m.mark='star' AND m.target LIKE 'list:%' AND (l.visibility='public' OR l.owner_id=?)
        ORDER BY m.created_at DESC LIMIT ${LIST_MAX}`,
      )
      .all(userId, userId) as (ListRow & { count: number; owner: string | null })[]
  ).map((r) => ({ ...summary(r), owner: r.owner }));
}

const PLAZA_PAGE = 30;
export type PlazaList = {
  id: string;
  title: string;
  description: string;
  owner: string | null;
  count: number;
  stars: number;
  forks: number;
  updatedAt: number;
};
/**
 * /lists/community: public lists with at least one problem anyone can open, hot first (saves
 * plus twice the copies, over the list's age in days plus two) or newest, searched by title.
 * ponytail: scores every public list per request; cache the order if the plaza grows large.
 */
export function communityLists(input: { sort?: string; q?: string; page?: number }, now = Date.now()) {
  const q = (input.q ?? '').trim().slice(0, 80);
  const page = Math.min(Math.max(1, Math.floor(input.page ?? 1) || 1), 200);
  const order =
    input.sort === 'new'
      ? 'updatedAt DESC'
      : `(stars + 2 * forks) * 1.0 / ((@now - createdAt) / ${DAY}.0 + 2) DESC, updatedAt DESC`;
  const rows = sqlite()
    .prepare(
      `SELECT id,title,description,owner,count,stars,forks,updatedAt FROM (
        SELECT l.id,l.title,substr(l.description,1,200) AS description,l.created_at AS createdAt,
          l.updated_at AS updatedAt,pr.handle AS owner,${count()},${STARS('l.id')} AS stars,${FORKS('l.id')} AS forks
        FROM user_lists l LEFT JOIN user_profiles pr ON pr.user_id=l.owner_id AND pr.visible=1
        WHERE l.visibility='public'${q ? " AND l.title LIKE @like ESCAPE '\\'" : ''}
      ) WHERE count>0 ORDER BY ${order}, id LIMIT ${PLAZA_PAGE + 1} OFFSET @offset`,
    )
    .all({ now, like: `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, offset: (page - 1) * PLAZA_PAGE }) as PlazaList[];
  return {
    q,
    sort: input.sort === 'new' ? 'new' : 'hot',
    page,
    items: rows.slice(0, PLAZA_PAGE),
    more: rows.length > PLAZA_PAGE,
  };
}

async function handleLists(request: Request, p: Person | null, id?: string, action?: string) {
  const db = sqlite();
  const params = new URL(request.url).searchParams;
  if (request.method === 'GET') {
    if (id === 'starred' && !action) {
      requirePerson(p);
      await limit(p, 'lists-read', 120);
      return json({ items: starredLists(p.id) });
    }
    // A public list reads signed out; the learner's own index needs the account.
    if (id) {
      await limitReader(request, p, 'lists-read', 120);
      const list = readList(id, p?.id ?? null);
      if (!list) throw new HttpError(404, '题单不存在');
      return json(list);
    }
    requirePerson(p);
    await limit(p, 'lists-read', 120);
    const problem = params.has('problem') ? problemId.parse(params.get('problem')) : null;
    return json({ items: myLists(p.id, problem) });
  }
  requirePerson(p);
  if (request.method !== 'POST') throw new HttpError(404, '题单接口不存在');
  await limit(p, 'list-write', 60);
  if (!id) {
    const d = z
      .object({
        title: listFields.title,
        description: listFields.description.default(''),
        visibility: listFields.visibility.default('private'),
        problemIds: z.array(z.string().max(200)).max(ITEM_MAX).default([]),
      })
      .strict()
      .parse(await readJson(request, 64000));
    if (d.visibility === 'public') requireVerified(p);
    const keep: string[] = [];
    for (const problem of new Set(d.problemIds)) if (await publicProblem(p, problem)) keep.push(problem);
    const created = newList(p, d);
    if (keep.length) addItems(created, keep);
    return json(readList(created, p.id), 201);
  }
  if (action === 'star') {
    const { on } = z.object({ on: z.boolean() }).strict().parse(await readJson(request, 200));
    const list = readableList(id, p.id);
    if (list.owner_id === p.id) throw new HttpError(400, '不能收藏自己的题单');
    if (on)
      db.prepare(
        "INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,'star',?) ON CONFLICT DO NOTHING",
      ).run(p.id, `list:${list.id}`, Date.now());
    else db.prepare("DELETE FROM user_marks WHERE user_id=? AND target=? AND mark='star'").run(p.id, `list:${list.id}`);
    return json(readList(list.id, p.id));
  }
  if (action === 'fork') {
    const source = readableList(id, p.id);
    const created = newList(
      p,
      { title: source.title, description: source.description, visibility: 'private' },
      source.id,
    );
    const items = listItems(source.id).map((i) => i.problemId);
    if (items.length) addItems(created, items);
    return json(readList(created, p.id), 201);
  }
  const list = ownList(id, p.id);
  if (action === 'delete') {
    db.transaction(() => {
      db.prepare('DELETE FROM user_list_items WHERE list_id=?').run(list.id);
      db.prepare('DELETE FROM user_lists WHERE id=? AND owner_id=?').run(list.id, p.id);
    })();
    return json({ id: list.id, deleted: true });
  }
  if (action === 'items') {
    const d = z
      .object({ problemId, on: z.boolean() })
      .strict()
      .parse(await readJson(request, 1000));
    if (!d.on)
      db.transaction(() => {
        db.prepare('DELETE FROM user_list_items WHERE list_id=? AND problem_id=?').run(list.id, d.problemId);
        db.prepare('UPDATE user_lists SET updated_at=? WHERE id=?').run(Date.now(), list.id);
      })();
    else if (await publicProblem(p, d.problemId)) addItems(list.id, [d.problemId]);
    else throw new HttpError(404, '题目不存在或尚未发布');
    return json(readList(list.id, p.id));
  }
  if (action === 'bulk') {
    await limit(p, 'list-bulk-write', 20);
    const { lines } = z
      .object({ lines: z.array(z.string().max(LINE_MAX)).min(1).max(ITEM_MAX) })
      .strict()
      .parse(await readJson(request, 200000));
    // Parsed again here: the editor's preview is only a preview.
    const parsed = parseListImport(lines.join('\n'));
    const byNumber = new Map<string, string>(),
      bySlug = new Map<string, string>();
    const rows = db
      .prepare(
        `SELECT number,slug,judge_problem_id AS id FROM study_library WHERE judge_problem_id IS NOT NULL
        AND (number IN (SELECT value FROM json_each(?)) OR slug IN (SELECT value FROM json_each(?)))`,
      )
      .all(
        JSON.stringify(parsed.flatMap((l) => (l.kind === 'number' ? [Number(l.value)] : []))),
        JSON.stringify(parsed.flatMap((l) => (l.kind === 'slug' ? [l.value] : []))),
      ) as { number: number; slug: string; id: string }[];
    for (const r of rows) {
      if (!byNumber.has(String(r.number))) byNumber.set(String(r.number), r.id);
      bySlug.set(r.slug, r.id);
    }
    const seen = new Set(db.prepare('SELECT problem_id FROM user_list_items WHERE list_id=?').pluck().all(list.id) as string[]);
    const room = ITEM_MAX - seen.size;
    const keep: string[] = [],
      unknown: string[] = [];
    let duplicate = 0,
      overflow = 0;
    for (const l of parsed) {
      const problem =
        l.kind === 'id' ? l.value : l.kind === 'number' ? byNumber.get(l.value) : l.kind === 'slug' ? bySlug.get(l.value) : '';
      if (!problem) unknown.push(l.raw);
      // Already in the list, or pasted earlier: each problem is looked up once.
      else if (seen.has(problem)) duplicate++;
      else {
        seen.add(problem);
        // Cut before addItems, which refuses the whole batch once the list is full.
        if (keep.length >= room) overflow++;
        else if (await publicProblem(p, problem)) keep.push(problem);
        else unknown.push(l.raw);
      }
    }
    if (keep.length) addItems(list.id, keep);
    return json({ added: keep.length, duplicate, unknown, overflow, list: readList(list.id, p.id) });
  }
  if (action === 'reorder') {
    const { problemIds } = z
      .object({ problemIds: z.array(problemId).max(ITEM_MAX) })
      .strict()
      .parse(await readJson(request, 100000));
    db.transaction(() => {
      // The order covers exactly what the list shows; problems of companies hidden since go last.
      const shown = listItems(list.id).map((i) => i.problemId);
      const order = new Set(problemIds);
      if (order.size !== problemIds.length || shown.length !== order.size || shown.some((i) => !order.has(i)))
        throw new HttpError(409, '题单内容已变化，请刷新后再排序');
      const all = db
        .prepare('SELECT problem_id FROM user_list_items WHERE list_id=? ORDER BY position,added_at')
        .pluck()
        .all(list.id) as string[];
      const set = db.prepare('UPDATE user_list_items SET position=? WHERE list_id=? AND problem_id=?');
      [...problemIds, ...all.filter((i) => !order.has(i))].forEach((i, at) => set.run(at + 1, list.id, i));
      db.prepare('UPDATE user_lists SET updated_at=? WHERE id=?').run(Date.now(), list.id);
    })();
    return json(readList(list.id, p.id));
  }
  if (action) throw new HttpError(404, '题单接口不存在');
  const d = z
    .object({
      title: listFields.title.optional(),
      description: listFields.description.optional(),
      visibility: listFields.visibility.optional(),
    })
    .strict()
    .parse(await readJson(request, 8000));
  if (d.visibility === 'public') requireVerified(p);
  db.prepare(
    `UPDATE user_lists SET title=COALESCE(?,title),description=COALESCE(?,description),
      visibility=COALESCE(?,visibility),updated_at=? WHERE id=? AND owner_id=?`,
  ).run(d.title ?? null, d.description ?? null, d.visibility ?? null, Date.now(), list.id, p.id);
  return json(readList(list.id, p.id));
}

// ---------------------------------------------------------------- public profile

const RESERVED = new Set([
  'admin', 'api', 'compare', 'cswork', 'help', 'lists', 'me', 'owner', 'privacy', 'profile',
  'root', 'settings', 'support', 'teacher', 'u', 'user', 'users',
]);
export const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;
/** Each link kind but a personal website must point at its own site (or a subdomain of it). */
const LINK_HOSTS: Record<string, readonly string[]> = {
  github: ['github.com'],
  linkedin: ['linkedin.com'],
  x: ['x.com', 'twitter.com'],
};
/**
 * https only, no credentials, and the right site; javascript: and plain http: never reach a page.
 * The 200 cap is on the stored (percent-encoded) href, so a saved link always fits when sent back.
 */
function linkAllowed({ kind, url }: { kind: string; url: string }) {
  if (!URL.canParse(url)) return false;
  const { protocol, username, password, hostname, href } = new URL(url);
  const hosts = LINK_HOSTS[kind];
  return (
    href.length <= 200 &&
    protocol === 'https:' &&
    !username &&
    !password &&
    (hosts ? hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`)) : hostname.includes('.'))
  );
}
const profileLink = z
  .object({ kind: z.enum(['website', 'github', 'linkedin', 'x']), url: z.string().trim().max(200) })
  .strict()
  .refine(linkAllowed)
  .transform((link) => ({ kind: link.kind, url: new URL(link.url).href }));
/** The school board key: NFKC, lowercase, no punctuation, symbols or spaces ("M.I.T.", "ＭＩＴ" and "mit" meet). */
export const schoolKey = (school: string) => school.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu, '');
const profileInput = z
  .object({
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .regex(HANDLE)
      .refine((h) => !RESERVED.has(h) && !h.includes('--')),
    visible: z.boolean(),
    indexable: z.boolean().default(false),
    showContest: z.boolean().default(false),
    showPractice: z.boolean().default(false),
    bio: z.string().trim().max(160).default(''),
    // Absent keeps the current one; null takes it down.
    featuredBadge: z.string().max(200).nullable().optional(),
    // Card fields: absent keeps what is saved, so an older settings page never clears them.
    links: z.array(profileLink).max(4).optional(),
    school: z.string().trim().max(80).optional(),
    gradYear: z.number().int().min(1990).max(2040).nullable().optional(),
    targetRole: z.string().trim().max(60).optional(),
  })
  .strict();
type ProfileRow = {
  user_id: string;
  handle: string;
  visible: number;
  indexable: number;
  show_contest: number;
  show_practice: number;
  bio: string;
  featured_badge: string | null;
  links_json: string;
  school: string;
  grad_year: number | null;
  target_role: string;
};
type ProfileLink = { kind: 'website' | 'github' | 'linkedin' | 'x'; url: string };
/** The self-reported card: links, school, graduation year and target role. */
const card = (r: ProfileRow) => ({
  links: JSON.parse(r.links_json) as ProfileLink[],
  school: r.school,
  gradYear: r.grad_year,
  targetRole: r.target_role,
});
function myProfile(userId: string) {
  const r = sqlite()
    .prepare('SELECT * FROM user_profiles WHERE user_id=?')
    .get(userId) as ProfileRow | undefined;
  return r
    ? {
        handle: r.handle,
        visible: !!r.visible,
        indexable: !!r.indexable,
        showContest: !!r.show_contest,
        showPractice: !!r.show_practice,
        bio: r.bio,
        featuredBadge: r.featured_badge,
        ...card(r),
      }
    : null;
}
/** The badges this learner may feature: those their public page would show (contest ones when shown). */
async function featurable(userId: string, showContest: boolean) {
  return profileBadges(userId, await publicCatalogue(), showContest ? ratingHistory(userId) : []);
}
async function handleProfile(request: Request, p: Person) {
  if (request.method === 'GET') {
    await limit(p, 'profile-read', 60);
    const profile = myProfile(p.id);
    return json({
      profile,
      badges: profile ? await featurable(p.id, profile.showContest) : [],
      // The years /u/<handle>/recap/<year> serves (UTC, public problems only): My progress links only these.
      recapYears: profile?.visible ? activeYears(p.id, shownIn(await publicCatalogue())) : [],
    });
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'profile-write', 20);
  const d = profileInput.parse(await readJson(request, 4000));
  if (d.visible) requireVerified(p);
  const saved = myProfile(p.id);
  const featured = d.featuredBadge === undefined ? (saved?.featuredBadge ?? null) : d.featuredBadge;
  const school = d.school ?? saved?.school ?? '';
  // Checked on every save: a badge given up since (or a contest one with the curve hidden) is refused.
  // Sent back too, so a first save or a shown curve fills the picker without a reload.
  const badges = await featurable(p.id, d.visible && d.showContest);
  if (featured && !badges.some((b) => b.id === featured))
    throw new HttpError(400, '这枚徽章还没有获得');
  const now = Date.now();
  try {
    sqlite()
      .prepare(
        `INSERT INTO user_profiles(user_id,handle,visible,indexable,show_contest,show_practice,bio,featured_badge,links_json,
          school,school_key,grad_year,target_role,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,visible=excluded.visible,
          indexable=excluded.indexable,show_contest=excluded.show_contest,show_practice=excluded.show_practice,bio=excluded.bio,
          featured_badge=excluded.featured_badge,links_json=excluded.links_json,school=excluded.school,
          school_key=excluded.school_key,grad_year=excluded.grad_year,target_role=excluded.target_role,
          updated_at=excluded.updated_at`,
      )
      .run(
        p.id,
        d.handle,
        +d.visible,
        +(d.visible && d.indexable),
        +(d.visible && d.showContest),
        +(d.visible && d.showPractice),
        d.bio,
        featured,
        JSON.stringify(d.links ?? saved?.links ?? []),
        school,
        schoolKey(school),
        d.gradYear === undefined ? (saved?.gradYear ?? null) : d.gradYear,
        d.targetRole ?? saved?.targetRole ?? '',
        now,
        now,
      );
  } catch (error) {
    if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE')
      throw new HttpError(409, '这个主页名已被占用');
    throw error;
  }
  return json({ profile: myProfile(p.id), badges });
}

/** What /u/<handle> needs from the catalogue: the published problems anyone can open. */
export type PublicCatalogue = ReadonlyMap<string, { difficulty?: string }>;
type Summaries = Map<string, Awaited<ReturnType<typeof listProblemSummaries>>[number]>;
// ponytail: one snapshot for 5 minutes, like the mock OA pools; publishes show up after that.
let catalogueCache: { at: number; value: Promise<Summaries> } | null = null;
/** Published problems a signed-out reader may open (no course exercises, no hidden companies). */
export function publicCatalogue() {
  if (!catalogueCache || Date.now() - catalogueCache.at > 300000) {
    const value = listProblemSummaries(null).then((all) => new Map(all.map((p) => [p.id, p])));
    catalogueCache = { at: Date.now(), value };
    value.catch(() => {
      if (catalogueCache?.value === value) catalogueCache = null;
    });
  }
  return catalogueCache.value;
}
const STOP_TOTALS = curatedEntries.reduce(
  (m, e) => m.set(e.sectionSlug, (m.get(e.sectionSlug) ?? 0) + 1),
  new Map<string, number>(),
);
const stopOf = (id: string) => curatedByNumber.get(Number(/^lc-(\d+)$/.exec(id)?.[1]))?.sectionSlug;
/** Only published OA and LeetCode problems a guest can open count on public pages. */
export const shownIn = (catalogue: PublicCatalogue) => (id: string) => problemId.safeParse(id).success && catalogue.has(id);
const visibleProfile = (handle: string) =>
  HANDLE.test(handle)
    ? (sqlite().prepare('SELECT * FROM user_profiles WHERE handle=? AND visible=1').get(handle) as ProfileRow | undefined)
    : undefined;
/** Solved counts by difficulty and by Line 500 stop. */
function tally(ids: Iterable<string>, catalogue: PublicCatalogue) {
  const levels: Record<Slot, number> = { easy: 0, medium: 0, hard: 0 };
  const stops = new Map<string, number>();
  let total = 0;
  for (const id of ids) {
    total++;
    const level = slotOf(catalogue.get(id)?.difficulty);
    if (level) levels[level]++;
    const stop = stopOf(id);
    if (stop) stops.set(stop, (stops.get(stop) ?? 0) + 1);
  }
  return { solved: { total, ...levels }, stops };
}
const WEEK = 7 * DAY;
const utcDay = (time: number) => time - (time % DAY);
const utcMonday = (time: number) => utcDay(time) - ((new Date(time).getUTCDay() + 6) % 7) * DAY;
/** Days in the profile's daily effort chart: the last 12 weeks. */
export const EFFORT_DAYS = 84;
/**
 * The profile's two practice charts from each shown problem's first AC (oldest first): `climb`,
 * distinct problems solved by the end of each UTC week since the first one, and `effort`, first
 * solves per UTC day of the last 12 weeks as [easy, medium, hard].
 * ponytail: UTC days, so a reader far from UTC sees a late-night AC on the next day.
 */
function practiceCurves(firsts: readonly { id: string; at: number }[], catalogue: PublicCatalogue, now: number) {
  const start = utcMonday(firsts[0]?.at ?? now);
  const weeks = Array.from({ length: Math.floor((utcMonday(now) - start) / WEEK) + 1 }, () => 0);
  const from = utcDay(now) - (EFFORT_DAYS - 1) * DAY;
  const days = Array.from({ length: EFFORT_DAYS }, () => [0, 0, 0]);
  for (const f of firsts) {
    if (f.at > now) continue;
    weeks[Math.floor((f.at - start) / WEEK)]++;
    const level = slotOf(catalogue.get(f.id)?.difficulty);
    if (f.at >= from && level) days[Math.floor((f.at - from) / DAY)][SLOTS.indexOf(level)]++;
  }
  for (let i = 1; i < weeks.length; i++) weeks[i] += weeks[i - 1];
  return { climb: firsts.length ? { start, weeks } : null, effort: { start: from, days } };
}
/** Every shown problem with an AC, latest AC first. */
function solvedList(userId: string, shown: (id: string) => boolean) {
  return (
    sqlite()
      .prepare(
        `SELECT problem_id AS id,MAX(created_at) AS at FROM submissions
        WHERE user_id=? AND mode='judge' AND status='accepted' GROUP BY problem_id ORDER BY at DESC,problem_id`,
      )
      .all(userId) as { id: string; at: number }[]
  ).filter((s) => shown(s.id));
}
/** UTC years with an AC on a shown problem, newest first: the profile's year picker. */
function activeYears(userId: string, shown: (id: string) => boolean) {
  const years = new Set<number>();
  for (const r of sqlite()
    .prepare(
      `SELECT DISTINCT problem_id AS id,CAST(strftime('%Y',created_at/1000,'unixepoch') AS INTEGER) AS y FROM submissions
      WHERE user_id=? AND mode='judge' AND status='accepted'`,
    )
    .all(userId) as { id: string; y: number }[])
    if (shown(r.id)) years.add(r.y);
  return [...years].sort((a, b) => b - a);
}
/**
 * Heatmap buckets as the profile sends them: distinct problems per whole UTC hour, numbered
 * opaquely in this response (no problem ids or exact times for guests).
 */
function activityBuckets(userId: string, shown: (id: string) => boolean, from: number, to: number, max: number) {
  const ordinal = new Map<string, string>();
  return (
    sqlite()
      .prepare(
        `SELECT problem_id,created_at/${HOUR} AS hour FROM submissions WHERE user_id=? AND mode='judge'
        AND status='accepted' AND created_at>=? AND created_at<? GROUP BY problem_id,hour ORDER BY hour DESC LIMIT ?`,
      )
      .all(userId, from, to, max) as { problem_id: string; hour: number }[]
  ).flatMap((a) => {
    if (!shown(a.problem_id)) return [];
    if (!ordinal.has(a.problem_id)) ordinal.set(a.problem_id, String(ordinal.size));
    return [{ problem_id: ordinal.get(a.problem_id)!, created_at: a.hour * HOUR }];
  });
}
/**
 * A visible profile's page data, or null (hidden, missing and switched off look the same).
 * Only published OA and LeetCode problems in `catalogue` count: course exercises (maybe paid)
 * and hidden companies never show.
 */
export function publicProfile(handle: string, catalogue: PublicCatalogue, now = Date.now()) {
  const shown = shownIn(catalogue);
  const db = sqlite();
  const profile = visibleProfile(handle);
  if (!profile) return null;
  const solved = solvedList(profile.user_id, shown);
  const firsts = (
    db
      .prepare(
        `SELECT problem_id AS id,MIN(created_at) AS at FROM submissions WHERE user_id=? AND mode='judge'
        AND status='accepted' GROUP BY problem_id ORDER BY at`,
      )
      .all(profile.user_id) as { id: string; at: number }[]
  ).filter((s) => shown(s.id));
  const { solved: counts, stops } = tally(
    solved.map((s) => s.id),
    catalogue,
  );
  // The heatmap needs only "distinct problems per local day": whole UTC hours (a :30 time zone
  // may shift an AC near midnight by a day) and opaque problem numbers, nothing finer.
  const activity = activityBuckets(profile.user_id, shown, now - 183 * DAY, Number.MAX_SAFE_INTEGER, 5000);
  // Counted like /u/lists/<id> shows them: only problems a guest can open.
  const lists = (
    db
      .prepare(
        `SELECT id,title,${STARS('user_lists.id')} AS stars FROM user_lists WHERE owner_id=? AND visibility='public'
        ORDER BY updated_at DESC LIMIT 20`,
      )
      .all(profile.user_id) as { id: string; title: string; stars: number }[]
  ).map((l) => ({ ...l, count: listItems(l.id).filter((i) => catalogue.has(i.problemId)).length }));
  const listStars = db
    .prepare(`SELECT COUNT(*) FROM user_marks m WHERE m.mark='star' AND ${VERIFIED('m.user_id')} AND m.target IN
      (SELECT 'list:'||id FROM user_lists WHERE owner_id=? AND visibility='public')`)
    .pluck()
    .get(profile.user_id) as number;
  // Distinct problems accepted per language.
  const byLanguage = new Map<string, number>();
  for (const r of db
    .prepare(
      `SELECT DISTINCT problem_id AS id,language FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'`,
    )
    .all(profile.user_id) as { id: string; language: string }[])
    if (shown(r.id)) byLanguage.set(r.language, (byLanguage.get(r.language) ?? 0) + 1);
  // The verified employee badge, only if its owner switched it on for the profile.
  const employer = badgeName(db.prepare(`SELECT ${badgeSql('?', 'profile')}`).pluck().get(profile.user_id) as string | null);
  // Posts anyone can open: solutions on public problems; reported-down and anonymous ones stay
  // out. Beside the badge only posts that could carry it, never OA solutions.
  const posts = (
    db
      .prepare(
        `SELECT sp.id,sp.problem_id AS target,sp.title,sp.created_at AS createdAt,
          (SELECT COUNT(*) FROM post_votes v WHERE v.post_id=sp.id) AS votes
        FROM solution_posts sp WHERE sp.user_id=? AND sp.hidden=0 AND sp.anonymous=0
          AND (SELECT COUNT(*) FROM post_reports r WHERE r.target='post:'||sp.id AND r.reason<>'${REPORT_CLEARED}')<${REPORTS_HIDE}
        ORDER BY sp.created_at DESC LIMIT 500`,
      )
      .all(profile.user_id) as { id: string; target: string; title: string; createdAt: number; votes: number }[]
  ).filter((post) => shown(post.target) && (!employer || badgeTarget(post.target)));
  const follows = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM user_follows f JOIN user_profiles p ON p.user_id=f.follower_id AND p.visible=1
          WHERE f.followee_id=@me) AS followers,
        (SELECT COUNT(*) FROM user_follows f JOIN user_profiles p ON p.user_id=f.followee_id AND p.visible=1
          WHERE f.follower_id=@me) AS following`,
    )
    .get({ me: profile.user_id }) as { followers: number; following: number };
  // Opt-in: each weekly's rank and rating match one row of that weekly's public scoreboard.
  const contest = profile.show_contest ? ratingHistory(profile.user_id) : [];
  const duel = profile.show_contest ? duelRecord(profile.user_id) : null;
  const badges = profileBadges(profile.user_id, catalogue, contest);
  return {
    handle: profile.handle,
    bio: profile.bio,
    ...card(profile),
    indexable: !!profile.indexable,
    solved: counts,
    // Line order, only the stops reached.
    stops: [...STOP_TOTALS]
      .filter(([stop]) => stops.has(stop))
      .map(([stop, total]) => ({ slug: stop, solved: stops.get(stop)!, total })),
    activity,
    ...practiceCurves(firsts, catalogue, now),
    years: activeYears(profile.user_id, shown),
    recent: solved.slice(0, 10).map((s) => ({ id: s.id, at: s.at - (s.at % HOUR) })),
    lists,
    listStars,
    // Answer reputation (solution-posts reputationSql): upvotes on posts and approved interview reports.
    reputation: db.prepare(`SELECT ${reputationSql('@u')}`).pluck().get({ u: profile.user_id }) as number,
    languages: [...byLanguage].map(([language, n]) => ({ language, n })).sort((a, b) => b.n - a.n),
    // Rated weeklies and starters, oldest first (lib/server/contests.ts): the curve and the contest badges.
    contest: contest.map(({ week, kind, after, rank, entrants }) => ({ week, kind, after, rank, entrants })),
    // Ranked duels (lib/server/duels.ts), under the same opt-in; null before the first.
    duel: duel?.played ? duel : null,
    badges,
    // Shown while still earned: a badge lost since (a hidden contest curve) just disappears.
    featured: badges.find((b) => b.id === profile.featured_badge) ?? null,
    employer,
    posts: {
      items: posts.slice(0, 10).map((post) => ({
        id: post.id,
        target: post.target,
        title: post.title,
        votes: post.votes,
        createdAt: post.createdAt - (post.createdAt % HOUR),
      })),
      total: posts.length,
      votes: posts.reduce((sum, post) => sum + post.votes, 0),
    },
    followers: follows.followers,
    following: follows.following,
  };
}

/**
 * The share card's numbers (app/u/[handle]/opengraph-image), or null when the page would 404:
 * solved by difficulty, the longest streak of AC days and, with contests shown, the latest rating.
 */
export function profileCard(handle: string, catalogue: PublicCatalogue) {
  const profile = visibleProfile(handle);
  if (!profile) return null;
  const shown = shownIn(catalogue);
  const ac = (
    sqlite()
      .prepare(`SELECT problem_id AS id,created_at AS at FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'`)
      .all(profile.user_id) as { id: string; at: number }[]
  ).filter((s) => shown(s.id));
  return {
    handle: profile.handle,
    solved: tally(new Set(ac.map((s) => s.id)), catalogue).solved,
    streak: longestStreak(ac.map((s) => s.at)),
    rating: profile.show_contest ? (ratingHistory(profile.user_id).at(-1)?.after ?? null) : null,
  };
}

/** Widest time zone offsets (UTC−12 to UTC+14): a reader's local year lies inside the padded UTC one. */
const YEAR_PAD = 14 * HOUR;
/**
 * One year of a visible profile, or null: the heatmap buckets (padded so the reader's browser can
 * cut its own local year out of them), distinct problems solved that UTC year by difficulty, the
 * five Line 500 stops with most of them, and with contests shown the year's rated contests and the
 * rating before the first and after the last.
 */
export function publicYear(handle: string, year: number, catalogue: PublicCatalogue, now = Date.now()) {
  if (!Number.isInteger(year) || year < 2000 || year > new Date(now + YEAR_PAD).getUTCFullYear()) return null;
  const profile = visibleProfile(handle);
  if (!profile) return null;
  const shown = shownIn(catalogue);
  const from = Date.UTC(year, 0, 1);
  const to = Date.UTC(year + 1, 0, 1);
  const ids = (
    sqlite()
      .prepare(
        `SELECT DISTINCT problem_id FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'
        AND created_at>=? AND created_at<?`,
      )
      .pluck()
      .all(profile.user_id, from, to) as string[]
  ).filter(shown);
  const { solved, stops } = tally(ids, catalogue);
  const races = profile.show_contest ? ratingHistory(profile.user_id).filter((c) => c.at >= from && c.at < to) : [];
  return {
    handle: profile.handle,
    indexable: !!profile.indexable,
    year,
    years: activeYears(profile.user_id, shown),
    // ponytail: 20000 hour buckets is ~55 a day; a busier year loses its oldest cells.
    activity: activityBuckets(profile.user_id, shown, from - YEAR_PAD, to + YEAR_PAD, 20000),
    solved,
    stops: [...stops]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([slug, n]) => ({ slug, solved: n, total: STOP_TOTALS.get(slug)! })),
    contest: races.length ? { contests: races.length, start: races[0].before, end: races.at(-1)!.after } : null,
  };
}

/**
 * Two or three visible profiles side by side, or null when any is hidden or missing: the solved
 * counts and Line 500 stops each page already shows, plus how many problems all of them solved.
 * Never which problems: a profile lists only its ten latest.
 *
 * That shared count is null unless the viewer is one of them and follows each of the others both
 * ways: otherwise a throwaway account that accepts one problem and compares itself with someone
 * learns whether they solved it.
 */
export function publicCompare(handles: readonly string[], catalogue: PublicCatalogue, viewerId: string | null = null) {
  const unique = [...new Set(handles)];
  if (unique.length < 2 || unique.length > 3) return null;
  const shown = shownIn(catalogue);
  const people: {
    userId: string;
    handle: string;
    solved: ReturnType<typeof tally>['solved'];
    stops: Record<string, number>;
    ids: Set<string>;
  }[] = [];
  for (const handle of unique) {
    const profile = visibleProfile(handle);
    if (!profile) return null;
    const ids = new Set(solvedList(profile.user_id, shown).map((s) => s.id));
    const { solved, stops } = tally(ids, catalogue);
    people.push({ userId: profile.user_id, handle: profile.handle, solved, stops: Object.fromEntries(stops), ids });
  }
  const [first, ...rest] = people;
  const friends =
    !!viewerId &&
    people.some((p) => p.userId === viewerId) &&
    people.every((p) => p.userId === viewerId || mutualFollow(viewerId, p.userId));
  return {
    people: people.map((p) => ({ handle: p.handle, solved: p.solved, stops: p.stops })),
    common: friends ? [...first.ids].filter((id) => rest.every((p) => p.ids.has(id))).length : null,
    // Line order, every stop anyone reached.
    stops: [...STOP_TOTALS]
      .filter(([slug]) => people.some((p) => p.stops[slug]))
      .map(([slug, total]) => ({ slug, total })),
  };
}

/**
 * The badges a profile has earned, from the same inputs as My progress: Line 500 stops, every AC
 * (shown problems only), OA companies of the public catalogue, the stored mock OAs, the daily
 * problems in the points ledger, classic lists and solved counts per domain. Days and streaks fall
 * on the server's local dates, which may differ from the learner's by one near midnight.
 */
function profileBadges(userId: string, catalogue: PublicCatalogue, contest: ReturnType<typeof ratingHistory> = []) {
  const ac = (
    sqlite()
      .prepare(`SELECT problem_id AS id,created_at AS at FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'`)
      .all(userId) as { id: string; at: number }[]
  ).filter((s) => catalogue.has(s.id));
  const solved = new Set(ac.map((s) => s.id));
  const stops = new Map<string, number>();
  for (const id of solved) {
    const stop = stopOf(id);
    if (stop) stops.set(stop, (stops.get(stop) ?? 0) + 1);
  }
  const count = (prefix: string) => [...solved].filter((id) => id.startsWith(prefix)).length;
  const names = new Map(reportCompanies().map((c) => [c.slug, c.name]));
  const companies = new Map<string, { slug: string; name: string; solved: number; total: number }>();
  for (const id of catalogue.keys()) {
    const raw = /^oa-(.+)-\d+$/.exec(id)?.[1];
    if (!raw) continue;
    const slug = canonicalCompany(raw);
    const entry = companies.get(slug) ?? { slug, name: names.get(slug) ?? slug, solved: 0, total: 0 };
    entry.total++;
    if (solved.has(id)) entry.solved++;
    companies.set(slug, entry);
  }
  return achievements({
    stops: [...STOP_TOTALS].map(([slug, total]) => ({ slug, total, solved: stops.get(slug) ?? 0 })),
    bestStreak: longestStreak(ac.map((s) => s.at)),
    acTimes: ac.map((s) => s.at),
    companies: [...companies.values()],
    perfectMock: mockHistory(userId, 1000).some((m) => !!m.result && m.result.score >= m.result.max),
    // The contest badges are the weekly's (lib/achievements.ts): starters don't count toward them.
    contests: contest.filter((c) => c.kind === 'weekly'),
    dailyDays: dailyDays(userId),
    lists: classicListProgress(solved, (id) => catalogue.has(id)),
    domains: { line: [...stops.values()].reduce((a, b) => a + b, 0), sql: count('sql-'), oa: count('oa-') },
  }).flatMap((b) => (b.earned ? [{ id: b.id, group: b.group, zh: b.zh, en: b.en }] : []));
}

// ---------------------------------------------------------------- "I was asked this"

const ROUNDS = ['oa', 'phone', 'onsite'] as const;
// ponytail: the directory reads the content library; 10 minutes is fresh enough for a picker.
let companiesCache: { at: number; value: { slug: string; name: string }[] } | null = null;
/** Employers a report may name: those with a company page, hidden ones left out. */
export function reportCompanies() {
  if (!companiesCache || Date.now() - companiesCache.at > 600000)
    companiesCache = {
      at: Date.now(),
      value: [...companyDirectory(library()).values()]
        .filter(hasHub)
        .map((c) => ({ slug: c.slug, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  return companiesCache.value;
}

/**
 * Learners' reports and public member experiences' linked questions, in problem_reports' columns.
 * A function: experience-submissions.ts imports this module back, so MEMBER_ASKED is unset while it loads.
 */
export const ASKED = () => `(SELECT user_id,problem_id,company,asked_month,round FROM problem_reports UNION ALL ${MEMBER_ASKED})`;
/** Distinct reporters over the recent months, the latest month and the companies named. */
export function problemReportSummary(problem: string, userId: string | null, now = Date.now()) {
  const db = sqlite(),
    since = recentSince(now),
    hidden = hiddenCompanies();
  const { total, last } = db
    .prepare(
      `SELECT COUNT(DISTINCT user_id) AS total,MAX(asked_month) AS last FROM ${ASKED()} WHERE problem_id=? AND asked_month>=?`,
    )
    .get(problem, since) as { total: number; last: string | null };
  const names = new Map(reportCompanies().map((c) => [c.slug, c.name]));
  const companies = (
    db
      .prepare(
        `SELECT company AS slug,COUNT(DISTINCT user_id) AS n FROM ${ASKED()}
        WHERE problem_id=? AND asked_month>=? AND company<>'' GROUP BY company ORDER BY n DESC,company LIMIT 20`,
      )
      .all(problem, since) as { slug: string; n: number }[]
  )
    .filter((c) => !hidden.has(c.slug) && names.has(c.slug))
    .map((c) => ({ ...c, name: names.get(c.slug)! }));
  const mine = userId
    ? (db
        .prepare(
          `SELECT asked_month AS month,company,round FROM problem_reports WHERE user_id=? AND problem_id=?
          ORDER BY asked_month DESC LIMIT 12`,
        )
        .all(userId, problem) as { month: string; company: string; round: string }[])
    : [];
  return { problemId: problem, months: REPORT_MONTHS, total, last, companies, mine };
}

/** A company page's most reported problems over the recent months (ids only; the page titles them). */
export function companyReports(company: string, now = Date.now(), max = 50) {
  if (hiddenCompanies().has(company)) return [];
  return (
    sqlite()
      .prepare(
        `SELECT problem_id AS problemId,COUNT(DISTINCT user_id) AS n,MAX(asked_month) AS last
        FROM ${ASKED()} WHERE company=? AND asked_month>=? AND problem_id NOT LIKE 'q:%' GROUP BY problem_id
        ORDER BY n DESC,last DESC,problem_id LIMIT ?`,
      )
      .all(company, recentSince(now), max) as { problemId: string; n: number; last: string }[]
  ).filter((r) => !hiddenProblem(r.problemId));
}

async function handleReports(request: Request, p: Person | null, action?: string) {
  const params = new URL(request.url).searchParams;
  if (request.method === 'GET') {
    await limitReader(request, p, 'reports-read', 120);
    if (action === 'companies') return json({ items: reportCompanies() });
    if (action) throw new HttpError(404, '接口不存在');
    const problem = reported.parse(params.get('problem'));
    if (hiddenProblem(problem) || (problem.startsWith('q:') && !(await visibleTarget(p, problem))))
      throw new HttpError(404, '题目不存在或尚未发布');
    return json(problemReportSummary(problem, p?.id ?? null));
  }
  requirePerson(p);
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  requireVerified(p);
  await limit(p, 'report-write', 10);
  const db = sqlite(),
    now = Date.now();
  if (action === 'withdraw') {
    const d = z.object({ problemId: reported, month }).strict().parse(await readJson(request, 1000));
    db.prepare('DELETE FROM problem_reports WHERE user_id=? AND problem_id=? AND asked_month=?').run(
      p.id,
      d.problemId,
      d.month,
    );
    return json(problemReportSummary(d.problemId, p.id, now));
  }
  if (action) throw new HttpError(404, '接口不存在');
  const d = z
    .object({
      problemId: reported,
      company: slug.nullable().default(null),
      round: z.enum(ROUNDS).nullable().default(null),
      month,
    })
    .strict()
    .parse(await readJson(request, 1000));
  // This month (a day ahead for time zones) back to two years ago.
  if (d.month > monthKey(now + DAY) || d.month < recentSince(now, 24))
    throw new HttpError(400, '面试月份无效');
  // A library question is visible like its answers are (lib/server/solution-posts.ts).
  if (!(d.problemId.startsWith('q:') ? await visibleTarget(p, d.problemId) : await publicProblem(p, d.problemId)))
    throw new HttpError(404, '题目不存在或尚未发布');
  const company = d.company ? employerSlug(d.company) : '';
  if (company && (company === OTHER_COMPANY || !reportCompanies().some((c) => c.slug === company)))
    throw new HttpError(400, '没有这家公司');
  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM problem_reports WHERE user_id=? AND created_at>?')
    .get(p.id, now - DAY) as { n: number };
  if (n >= REPORTS_PER_DAY) throw new HttpError(429, '今天的报告次数已达上限');
  // One per learner, problem and month: a second report for the month corrects the first.
  db.prepare(
    `INSERT INTO problem_reports(id,user_id,problem_id,company,round,asked_month,created_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(user_id,problem_id,asked_month) DO UPDATE SET company=excluded.company,round=excluded.round`,
  ).run(randomUUID(), p.id, d.problemId, company, d.round ?? '', d.month, now);
  return json(problemReportSummary(d.problemId, p.id, now));
}

// ---------------------------------------------------------------- editor drafts

/** Per learner: past this many drafts the least recently edited ones go. */
export const DRAFT_ROWS = 2000;
const DRAFT_BYTES = 65536;
const draftKey = z
  .object({
    language: z.enum(LANGUAGE_IDS),
    mode: z.enum(['acm', 'leetcode']),
  })
  .strict();
const draftInput = z
  .object({
    code: z.string(),
    updatedAt: z.number().int().positive(),
    // The browser's clock when it sent this: updatedAt is then re-based on the server's.
    sentAt: z.number().int().positive().optional(),
  })
  .strict();

/**
 * GET/PUT /api/oj/cloud/drafts/<problemId>?language=&mode=: the signed-in learner's own
 * draft, keyed by their id from the session (never the request). A PUT older than the
 * stored copy is ignored, so a stale tab can't overwrite a newer device's edit. Times are
 * kept on the server's clock (an edit's age by the browser's clock, taken from the server's
 * now), and a GET returns that now, so a device whose clock is off still compares rightly.
 */
export async function handleDrafts(request: Request, p: Person, problem?: string) {
  if (!problem || !/^[\w-]{1,100}$/.test(problem)) throw new HttpError(404, '接口不存在');
  const url = new URL(request.url);
  const key = draftKey.parse({
    language: url.searchParams.get('language'),
    mode: url.searchParams.get('mode'),
  });
  const db = sqlite();
  if (request.method === 'GET') {
    await limit(p, 'draft-read', 120);
    const row = db
      .prepare(
        'SELECT code,updated_at AS updatedAt FROM user_drafts WHERE user_id=? AND problem_id=? AND language=? AND coding_mode=?',
      )
      .get(p.id, problem, key.language, key.mode) as { code: string; updatedAt: number } | undefined;
    return json({ draft: row ?? null, now: Date.now() });
  }
  if (request.method !== 'PUT') throw new HttpError(404, '接口不存在');
  await limit(p, 'draft-write', 60);
  const d = draftInput.parse(await readJson(request, 400000));
  if (Buffer.byteLength(d.code) > DRAFT_BYTES) throw new HttpError(413, '代码超过 64 KiB');
  if (d.code.includes('\0')) throw new HttpError(400, '内容不能包含空字符');
  const now = Date.now();
  const updatedAt =
    d.sentAt === undefined
      ? // An older tab without sentAt: a clock running ahead could otherwise pin this copy as newest.
        Math.min(d.updatedAt, now)
      : Math.max(1, now - Math.max(0, d.sentAt - d.updatedAt));
  const saved = db.transaction(() => {
    const { changes } = db.prepare(
      `INSERT INTO user_drafts(user_id,problem_id,language,coding_mode,code,updated_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(user_id,problem_id,language,coding_mode) DO UPDATE SET code=excluded.code,updated_at=excluded.updated_at
      WHERE excluded.updated_at>=user_drafts.updated_at`,
    ).run(p.id, problem, key.language, key.mode, d.code, updatedAt);
    db.prepare(
      `DELETE FROM user_drafts WHERE rowid IN (SELECT rowid FROM user_drafts WHERE user_id=?
      ORDER BY updated_at DESC LIMIT -1 OFFSET ?)`,
    ).run(p.id, DRAFT_ROWS);
    return changes > 0;
  })();
  // false: a newer copy from another device is already there and stays.
  return json({ saved });
}

/**
 * GET profile/resume-facts: the learner's own record for the resume builder (/career/resume/builder),
 * in English: certificates (linked from /certificate/<id>), the latest weekly/starter rating and the
 * solved counts the public profile shows, plus the handle when that profile is public. Nothing is
 * written: the resume itself stays in the browser.
 */
async function handleResumeFacts(request: Request, p: Person) {
  if (request.method !== 'GET') throw new HttpError(404, '接口不存在');
  await limit(p, 'profile-read', 60);
  const catalogue = await publicCatalogue();
  const contests = ratingHistory(p.id);
  const profile = myProfile(p.id);
  return json({
    certificates: myCertificates(p.id, false).map(({ id, course, issuedAt, skill }) => ({ id, course, issuedAt, skill })),
    rating: contests.at(-1)?.after ?? null,
    contests: contests.length,
    solved: tally(
      solvedList(p.id, shownIn(catalogue)).map((s) => s.id),
      catalogue,
    ).solved,
    handle: profile?.visible ? profile.handle : null,
  });
}

/** /api/oj/{lists,profile,reports}/…: public list and report reads work signed out. */
export async function handleLearnerCloud(request: Request, p: Person | null, path: string[]) {
  const [resource, id, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  if (resource === 'lists') return handleLists(request, p, id, action);
  if (resource === 'reports' && !action) return handleReports(request, p, id);
  requirePerson(p);
  if (resource === 'profile' && !id) return handleProfile(request, p);
  if (resource === 'profile' && id === 'resume-facts' && !action) return handleResumeFacts(request, p);
  throw new HttpError(404, '接口不存在');
}
