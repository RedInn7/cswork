import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { curatedByNumber, curatedEntries } from '@/lib/ling-curated';
import { reportWindow, slotOf, type MockSession, type Slot } from '@/lib/mock-oa';
import { canonicalCompany, employerSlug, OTHER_COMPANY } from '@/lib/oa-company-brands';
import type { Person } from './auth';
import { companyDirectory, hasHub } from './company-hub';
import { library } from './content-library';
import { hiddenCompanies } from './env';
import { HttpError, json, limit, limitReader, requirePerson } from './http';
import { mockReport } from './mock-oa';
import { readJson } from './my-practice';
import { canSeeProblem, listProblemSummaries } from './oj-problems';

/**
 * Learner data that lives on the server (db/learner-cloud-schema.ts): finished mock OAs,
 * problem lists, the opt-in public profile and "I was asked this" reports. Every write
 * names its owner in the WHERE clause; a list or profile someone else owns reads as missing.
 */
const DAY = 86400000;
// ponytail: flat per-learner caps keep a scripted client from growing the tables forever.
const MOCK_ROWS = 1000;
const LIST_MAX = 100;
const ITEM_MAX = 500;
const REPORTS_PER_DAY = 20;
/** Months a report counts towards "recently asked": this one and the five before. */
export const REPORT_MONTHS = 6;

const problemId = z.string().regex(/^(?:oa-[a-z0-9-]{1,180}|lc-\d{1,6})$/);
const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const month = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);

/** A judge problem id of a hidden company (HIDDEN_COMPANIES) reads as missing everywhere. */
function hiddenProblem(id: string, hidden = hiddenCompanies()) {
  const company = /^oa-(.+)-\d+$/.exec(id)?.[1];
  return !!company && (hidden.has(company) || hidden.has(canonicalCompany(company)));
}
/** Published OA or Line 500 problems only: course exercises never enter lists or reports. */
async function publicProblem(p: Person, id: string) {
  return problemId.safeParse(id).success && !hiddenProblem(id) && (await canSeeProblem(p, id));
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
    scoring: z.enum(['tests', 'gca']),
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
    let report: Awaited<ReturnType<typeof mockReport>> | null = null;
    try {
      report = await mockReport(
        p,
        new URLSearchParams({
          ids: s.ids.join(','),
          from: String(from),
          to: String(to),
          scoring: s.scoring,
          slots: s.slots.join(','),
        }),
      );
    } catch (error) {
      // An impossible window (over 4 hours, say) is not a mock this server would report.
      if (error instanceof HttpError) continue;
      throw error;
    }
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
const COUNT = '(SELECT COUNT(*) FROM user_list_items i WHERE i.list_id=l.id) AS count';

function myLists(userId: string, problem: string | null) {
  return (
    sqlite()
      .prepare(
        `SELECT l.*,${COUNT},EXISTS(SELECT 1 FROM user_list_items i WHERE i.list_id=l.id AND i.problem_id=?) AS has
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
function ownerHandle(ownerId: string) {
  return (
    (
      sqlite()
        .prepare('SELECT handle FROM user_profiles WHERE user_id=? AND visible=1')
        .get(ownerId) as { handle: string } | undefined
    )?.handle ?? null
  );
}
/** A list as its page shows it; null when missing or private to someone else. */
export function readList(id: string, userId: string | null) {
  try {
    const row = readableList(id, userId);
    return {
      ...summary({ ...row, count: 0 }),
      items: listItems(id),
      mine: row.owner_id === userId,
      owner: ownerHandle(row.owner_id),
      forkedFrom: row.forked_from,
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

async function handleLists(request: Request, p: Person | null, id?: string, action?: string) {
  const db = sqlite();
  const params = new URL(request.url).searchParams;
  if (request.method === 'GET') {
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
    const keep: string[] = [];
    for (const problem of new Set(d.problemIds)) if (await publicProblem(p, problem)) keep.push(problem);
    const created = newList(p, d);
    if (keep.length) addItems(created, keep);
    return json(readList(created, p.id), 201);
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
  if (action) throw new HttpError(404, '题单接口不存在');
  const d = z
    .object({
      title: listFields.title.optional(),
      description: listFields.description.optional(),
      visibility: listFields.visibility.optional(),
    })
    .strict()
    .parse(await readJson(request, 8000));
  db.prepare(
    `UPDATE user_lists SET title=COALESCE(?,title),description=COALESCE(?,description),
      visibility=COALESCE(?,visibility),updated_at=? WHERE id=? AND owner_id=?`,
  ).run(d.title ?? null, d.description ?? null, d.visibility ?? null, Date.now(), list.id, p.id);
  return json(readList(list.id, p.id));
}

// ---------------------------------------------------------------- public profile

const RESERVED = new Set([
  'admin', 'api', 'cswork', 'help', 'lists', 'me', 'owner', 'privacy', 'profile',
  'root', 'settings', 'support', 'teacher', 'u', 'user', 'users',
]);
export const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;
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
    bio: z.string().trim().max(160).default(''),
  })
  .strict();
type ProfileRow = {
  user_id: string;
  handle: string;
  visible: number;
  indexable: number;
  bio: string;
};
function myProfile(userId: string) {
  const r = sqlite()
    .prepare('SELECT * FROM user_profiles WHERE user_id=?')
    .get(userId) as ProfileRow | undefined;
  return r
    ? { handle: r.handle, visible: !!r.visible, indexable: !!r.indexable, bio: r.bio }
    : null;
}
async function handleProfile(request: Request, p: Person) {
  if (request.method === 'GET') {
    await limit(p, 'profile-read', 60);
    return json({ profile: myProfile(p.id) });
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'profile-write', 20);
  const d = profileInput.parse(await readJson(request, 2000));
  const now = Date.now();
  try {
    sqlite()
      .prepare(
        `INSERT INTO user_profiles(user_id,handle,visible,indexable,bio,created_at,updated_at) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,visible=excluded.visible,
          indexable=excluded.indexable,bio=excluded.bio,updated_at=excluded.updated_at`,
      )
      .run(p.id, d.handle, +d.visible, +(d.visible && d.indexable), d.bio, now, now);
  } catch (error) {
    if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE')
      throw new HttpError(409, '这个主页名已被占用');
    throw error;
  }
  return json({ profile: myProfile(p.id) });
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
/**
 * A visible profile's page data, or null (hidden, missing and switched off look the same).
 * Only published OA and LeetCode problems in `catalogue` count: course exercises (maybe paid)
 * and hidden companies never show.
 */
export function publicProfile(handle: string, catalogue: PublicCatalogue, now = Date.now()) {
  if (!HANDLE.test(handle)) return null;
  const shown = (id: string) => problemId.safeParse(id).success && catalogue.has(id);
  const db = sqlite();
  const profile = db
    .prepare('SELECT * FROM user_profiles WHERE handle=? AND visible=1')
    .get(handle) as ProfileRow | undefined;
  if (!profile) return null;
  const solved = (
    db
      .prepare(
        `SELECT problem_id AS id,MAX(created_at) AS at FROM submissions
        WHERE user_id=? AND mode='judge' AND status='accepted' GROUP BY problem_id ORDER BY at DESC,problem_id`,
      )
      .all(profile.user_id) as { id: string; at: number }[]
  ).filter((s) => shown(s.id));
  const levels: Record<Slot, number> = { easy: 0, medium: 0, hard: 0 };
  const stops = new Map<string, number>();
  for (const s of solved) {
    const level = slotOf(catalogue.get(s.id)?.difficulty);
    if (level) levels[level]++;
    const stop = curatedByNumber.get(Number(/^lc-(\d+)$/.exec(s.id)?.[1]))?.sectionSlug;
    if (stop) stops.set(stop, (stops.get(stop) ?? 0) + 1);
  }
  const activity = (
    db
      .prepare(
        `SELECT problem_id,created_at FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'
        AND created_at>? ORDER BY created_at DESC LIMIT 5000`,
      )
      .all(profile.user_id, now - 183 * DAY) as { problem_id: string; created_at: number }[]
  ).filter((a) => shown(a.problem_id));
  const lists = db
    .prepare(
      `SELECT l.id,l.title,${COUNT} FROM user_lists l WHERE l.owner_id=? AND l.visibility='public'
      ORDER BY l.updated_at DESC LIMIT 20`,
    )
    .all(profile.user_id) as { id: string; title: string; count: number }[];
  return {
    handle: profile.handle,
    bio: profile.bio,
    indexable: !!profile.indexable,
    solved: { total: solved.length, ...levels },
    // Line order, only the stops reached.
    stops: [...STOP_TOTALS]
      .filter(([stop]) => stops.has(stop))
      .map(([stop, total]) => ({ slug: stop, solved: stops.get(stop)!, total })),
    activity,
    recent: solved.slice(0, 10),
    lists,
  };
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

/** Distinct reporters over the recent months, the latest month and the companies named. */
export function problemReportSummary(problem: string, userId: string | null, now = Date.now()) {
  const db = sqlite(),
    since = recentSince(now),
    hidden = hiddenCompanies();
  const { total, last } = db
    .prepare(
      'SELECT COUNT(DISTINCT user_id) AS total,MAX(asked_month) AS last FROM problem_reports WHERE problem_id=? AND asked_month>=?',
    )
    .get(problem, since) as { total: number; last: string | null };
  const names = new Map(reportCompanies().map((c) => [c.slug, c.name]));
  const companies = (
    db
      .prepare(
        `SELECT company AS slug,COUNT(DISTINCT user_id) AS n FROM problem_reports
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
        FROM problem_reports WHERE company=? AND asked_month>=? GROUP BY problem_id
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
    const problem = problemId.parse(params.get('problem'));
    if (hiddenProblem(problem)) throw new HttpError(404, '题目不存在或尚未发布');
    return json(problemReportSummary(problem, p?.id ?? null));
  }
  requirePerson(p);
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  if (!p.verified && p.role !== 'teacher') throw new HttpError(403, '请先验证邮箱');
  await limit(p, 'report-write', 10);
  const db = sqlite(),
    now = Date.now();
  if (action === 'withdraw') {
    const d = z.object({ problemId, month }).strict().parse(await readJson(request, 1000));
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
      problemId,
      company: slug.nullable().default(null),
      round: z.enum(ROUNDS).nullable().default(null),
      month,
    })
    .strict()
    .parse(await readJson(request, 1000));
  // This month (a day ahead for time zones) back to two years ago.
  if (d.month > monthKey(now + DAY) || d.month < recentSince(now, 24))
    throw new HttpError(400, '面试月份无效');
  if (!(await publicProblem(p, d.problemId))) throw new HttpError(404, '题目不存在或尚未发布');
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

/** /api/oj/{lists,profile,reports}/…: public list and report reads work signed out. */
export async function handleLearnerCloud(request: Request, p: Person | null, path: string[]) {
  const [resource, id, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  if (resource === 'lists') return handleLists(request, p, id, action);
  if (resource === 'reports' && !action) return handleReports(request, p, id);
  requirePerson(p);
  if (resource === 'profile' && !id) return handleProfile(request, p);
  throw new HttpError(404, '接口不存在');
}
