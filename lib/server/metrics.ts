import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setImmediate as pause } from 'node:timers/promises';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { setting } from './env';
import { HttpError, boundedText, json, limitReader, requireTeacher } from './http';

/**
 * Owner analytics. The client beacons a few named events (lib/analytics.ts); they live in their
 * own SQLite file so a burst of beacons never writes to or locks the main database. No IP
 * addresses or user agents are stored, and rows older than 120 days are pruned.
 */
const DAY = 86_400_000;
const KEEP_DAYS = 120;
// Percentiles sort at most this many rows, newest days first, so a long range stays cheap.
const SAMPLE = 50_000;
const TOP = 20;
const UNFINISHED = new Set(['queued', 'compiling', 'running', 'cancelled']);

// text: up to 120 chars; tag: a short label (64 chars) grouped case-insensitively.
type Kind = 'text' | 'tag' | readonly [min: number, max: number];
const COUNT = [0, 1_000_000] as const;
const MS = [0, 3_600_000] as const;
const JUDGE = { mode: 'text', problem_id: 'text', language: 'text' } as const;
/** Allowed events and their params; other names and keys are dropped. */
const EVENTS: Record<string, Record<string, Kind>> = {
  // slug is set on content pages and feeds topContent. The first view of a page load also
  // says where the visit came from: an allowlisted referrer host and the UTM tags.
  page_view: {
    view: 'text', type: 'text', slug: 'text',
    ref: 'tag', utm_source: 'tag', utm_medium: 'tag', utm_campaign: 'tag',
  },
  search: { view: 'text', q: 'text', results: COUNT },
  judge_submit: JUDGE,
  judge_result: {
    ...JUDGE, verdict: 'text', passed: COUNT, total: COUNT,
    duration_ms: MS, server_ms: MS, queue_ms: MS,
  },
  judge_error: { mode: 'text', problem_id: 'text', stage: 'text', status: 'text' },
  language_switch: { locale: 'text' },
  // sign_up and login are recorded server-side by the auth hooks (record below), for every
  // sign-in method; the client's copies (email only) still go to GA4 but are dropped here.
};
const VID = /^[A-Za-z0-9-]{8,64}$/;
/** The vid of server-side events: too short for VID, so no beacon can send it. */
const SERVER = 'server';
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

let store: {
  db: Database.Database;
  insert: Database.Statement;
  prune: Database.Statement;
} | null = null;
function metrics() {
  if (!store) {
    const path = resolve(setting('METRICS_DATABASE_PATH') || 'data/metrics.sqlite');
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const db = new Database(path);
    db.pragma('journal_mode = WAL');
    // Losing the last beacons on power loss is fine; an fsync per beacon is not.
    db.pragma('synchronous = NORMAL');
    // A stuck lock should drop beacons rather than stall the (synchronous) server.
    db.pragma('busy_timeout = 200');
    db.exec(`CREATE TABLE IF NOT EXISTS events(
        id INTEGER PRIMARY KEY, at INTEGER NOT NULL, day TEXT NOT NULL, name TEXT NOT NULL,
        vid TEXT NOT NULL, user_id TEXT, params TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_name_day ON events(name, day);
      CREATE INDEX IF NOT EXISTS events_day_vid ON events(day, vid);`);
    store = {
      db,
      insert: db.prepare('INSERT INTO events(at,day,name,vid,user_id,params) VALUES(?,?,?,?,?,?)'),
      prune: db.prepare('DELETE FROM events WHERE id IN (SELECT id FROM events WHERE day<? LIMIT ?)'),
    };
  }
  return store;
}

/** [name, params JSON] with unknown keys dropped and values coerced, or null for unknown events. */
function clean(event: unknown): [string, string] | null {
  const { name, params } = (event ?? {}) as { name?: unknown; params?: unknown };
  if (typeof name !== 'string' || !Object.hasOwn(EVENTS, name)) return null;
  const given = (params && typeof params === 'object' ? params : {}) as Record<string, unknown>;
  const kept: Record<string, string | number> = {};
  for (const [key, kind] of Object.entries(EVENTS[name])) {
    const value = given[key];
    if (kind === 'text' || kind === 'tag') {
      if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) continue;
      const text = String(value).replace(/\s+/g, ' ').trim().slice(0, kind === 'tag' ? 64 : 120);
      // Searches group case-insensitively in the top list.
      if (text) kept[key] = key === 'q' || kind === 'tag' ? text.toLowerCase() : text;
    } else {
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
      if (Number.isFinite(n)) kept[key] = Math.min(kind[1], Math.max(kind[0], Math.round(n)));
    }
  }
  return [name, JSON.stringify(kept)];
}

/** A server-side event (auth hooks). Never throws: analytics must not fail a sign-in. */
export function record(name: 'sign_up' | 'login', userId: string, params: Record<string, string> = {}) {
  try {
    const now = Date.now();
    metrics().insert.run(now, dayOf(now), name, SERVER, userId, JSON.stringify(params));
  } catch {
    /* Best effort, like the beacons. */
  }
}

let pruneAfter = 0;
async function ingest(request: Request, p: Person | null) {
  await limitReader(request, p, 'metrics', 300);
  let data: { vid?: unknown; events?: unknown } | null = null;
  try {
    data = JSON.parse(await boundedText(request, 8192));
  } catch (e) {
    if (e instanceof HttpError) throw e;
  }
  const vid = data?.vid, events = data?.events;
  if (typeof vid !== 'string' || !VID.test(vid) || !Array.isArray(events) || events.length > 20)
    throw new HttpError(400, '无效的请求内容');
  const rows = events.map(clean).filter((r) => r !== null);
  const now = Date.now(), { db, insert, prune } = metrics();
  if (rows.length)
    db.transaction(() => {
      for (const [name, params] of rows) insert.run(now, dayOf(now), name, vid, p?.id ?? null, params);
    })();
  // Old rows go one small batch per beacon until caught up, then the check rests for an hour,
  // so pruning never holds the write lock for long.
  if (now >= pruneAfter && prune.run(dayOf(now - KEEP_DAYS * DAY), 500).changes < 500)
    pruneAfter = now + 3_600_000;
  return new Response(null, { status: 204 });
}

/** Nearest-rank percentiles; null when there is nothing to measure. */
function spread(values: number[]) {
  values.sort((a, b) => a - b);
  const at = (p: number) => (values.length ? values[Math.ceil((p / 100) * values.length) - 1] : null);
  return {
    count: values.length, p50: at(50), p90: at(90), p99: at(99),
    avg: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
  };
}
const bump = (counts: Map<string, number>, key: unknown[], n = 1) => {
  const k = JSON.stringify(key);
  counts.set(k, (counts.get(k) ?? 0) + n);
};
const top = (counts: Map<string, number>, fields: string[]) =>
  [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([key, count]) => {
      const values = JSON.parse(key) as unknown[];
      return { ...Object.fromEntries(fields.map((f, i) => [f, values[i]])), count };
    });

/**
 * Works one UTC day per step, newest first, and yields between steps: better-sqlite3 is
 * synchronous, and a 90-day range of a busy site would otherwise block every request for seconds.
 */
async function summarize(days: number) {
  const generatedAt = Date.now();
  const first = Math.floor(generatedAt / DAY) - days + 1; // epoch day the range starts on
  const last = first + days - 1;
  const daily = Array.from({ length: days }, (_, i) => ({
    day: dayOf((first + i) * DAY), pageViews: 0, visitors: 0, signups: 0, submissions: 0, runs: 0, accepted: 0,
  }));
  const db = sqlite(), m = metrics().db;
  // Submissions are only inserted, stamped inside the write transaction, so created_at grows with
  // rowid: a binary search finds each day's rowid window (created_at alone is not indexed), and
  // reading a day never touches the rest of the table.
  const probe = db.prepare('SELECT created_at FROM submissions WHERE rowid>=? ORDER BY rowid LIMIT 1').pluck();
  const firstRowid = (ms: number, hi: number) => {
    let lo = 0;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2), at = probe.get(mid) as number | undefined;
      if (at === undefined || at >= ms) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
  const submissions = db
    .prepare('SELECT created_at,mode,status,language,finished_at,user_id FROM submissions WHERE rowid>=? AND rowid<?')
    .raw();
  const pages = m
    .prepare(
      `SELECT json_extract(params,'$.view'),json_extract(params,'$.type'),json_extract(params,'$.slug'),COUNT(*)
       FROM events WHERE name='page_view' AND day=? GROUP BY 1,2,3`,
    )
    .raw();
  const visitors = m.prepare(`SELECT DISTINCT vid FROM events WHERE day=? AND vid<>'${SERVER}'`).pluck();
  // Funnel steps: page views count visitors; the last three count the accounts that signed up in
  // range, so a run or an AC is that account's first.
  const steps = m
    .prepare(
      `SELECT DISTINCT json_extract(params,'$.view'),vid FROM events
       WHERE name='page_view' AND day=? AND json_extract(params,'$.view') IN ('problems','problem')`,
    )
    .raw();
  const accounts = m.prepare('SELECT DISTINCT user_id FROM events WHERE day=? AND user_id IS NOT NULL').pluck();
  // Signups in range: daily counts and the cohorts for D1/D7 return. The user table is small and
  // created_at is not indexed: a plain scan.
  const cohort = new Map(
    (db.prepare('SELECT id,created_at FROM user WHERE created_at>=?').raw().all(first * DAY) as [string, number][])
      .map(([id, at]): [string, number] => [id, Math.floor(at / DAY)]),
  );
  for (const day of cohort.values()) if (daily[day - first]) daily[day - first].signups++;
  const others = m
    .prepare(`SELECT name,params FROM events WHERE name IN ('search','judge_result','judge_error','language_switch') AND day=?`)
    .raw();

  const verdicts = new Map<string, number>(), views = new Map<string, number>(), content = new Map<string, number>();
  const searches = new Map<string, number>(), errors = new Map<string, number>(), locales = new Map<string, number>();
  const vids = new Set<string>(), server: [string, number][] = [];
  const bank = new Set<string>(), opened = new Set<string>();
  const ran = new Set<string>(), solved = new Set<string>(), d1 = new Set<string>(), d7 = new Set<string>();
  const client: number[] = [], run: number[] = [], queue: number[] = [];
  let next = ((db.prepare('SELECT MAX(rowid) FROM submissions').pluck().get() as number | null) ?? 0) + 1;
  let judgeErrors = 0, timed = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = daily[i], lo = firstRowid((first + i) * DAY, next), present = new Set<string>();
    // Main database: formal submissions are mode 'judge'; times are ms.
    for (const [at, mode, status, language, finished, user] of submissions.all(lo, next) as
      [number, string, string, string, number | null, string][]) {
      if (cohort.has(user)) ran.add(user);
      present.add(user);
      if (mode === 'run') d.runs++;
      if (mode !== 'judge') continue;
      d.submissions++;
      if (status === 'accepted') {
        d.accepted++;
        if (cohort.has(user)) solved.add(user);
      }
      bump(verdicts, [status]);
      // Created -> finished; cancelled submissions never finished judging.
      if (finished !== null && !UNFINISHED.has(status) && server.length < SAMPLE) server.push([language, finished - at]);
    }
    next = lo;
    // Metrics database: page views group in SQL; the rarer events are tallied here.
    for (const [view, type, slug, n] of pages.all(d.day) as [string | null, string | null, string | null, number][]) {
      d.pageViews += n;
      if (view !== null) bump(views, [view, type], n);
      if (slug !== null) bump(content, [type, slug], n);
    }
    const seen = visitors.all(d.day) as string[];
    d.visitors = seen.length;
    for (const vid of seen) vids.add(vid);
    for (const [view, vid] of steps.all(d.day) as [string, string][]) (view === 'problems' ? bank : opened).add(vid);
    for (const user of accounts.all(d.day) as string[]) present.add(user);
    // Returned: active (signed-in events or submissions) one or seven days after signing up.
    for (const user of present) {
      const joined = cohort.get(user);
      if (joined === first + i - 1) d1.add(user);
      else if (joined === first + i - 7) d7.add(user);
    }
    for (const [name, params] of others.all(d.day) as [string, string][]) {
      const e = JSON.parse(params) as Record<string, string | number | undefined>;
      if (name === 'search' && e.q !== undefined) bump(searches, [e.q]);
      else if (name === 'language_switch' && e.locale !== undefined) bump(locales, [e.locale]);
      else if (name === 'judge_error') {
        judgeErrors++;
        bump(errors, [e.stage ?? null, e.status ?? null]);
      } else if (name === 'judge_result' && timed++ < SAMPLE) {
        const ms = e.duration_ms;
        if (typeof ms === 'number' && e.mode === 'run') run.push(ms);
        else if (typeof ms === 'number' && (e.mode === 'submit' || e.mode === 'judge')) client.push(ms);
        if (typeof e.queue_ms === 'number') queue.push(e.queue_ms);
      }
    }
    await pause();
  }
  const active = db
    .prepare(`SELECT status,COUNT(*) FROM submissions WHERE status IN ('queued','compiling','running') GROUP BY status`)
    .raw()
    .all() as [string, number][];

  const sum = (key: 'pageViews' | 'signups' | 'submissions' | 'runs' | 'accepted') =>
    daily.reduce((total, d) => total + d[key], 0);
  const c = spread(client), r = spread(run), q = spread(queue);
  return {
    range: { days, from: daily[0].day, to: daily[days - 1].day },
    generatedAt,
    totals: {
      pageViews: sum('pageViews'), visitors: vids.size, signups: sum('signups'),
      submissions: sum('submissions'), runs: sum('runs'), accepted: sum('accepted'), judgeErrors,
    },
    daily,
    judge: {
      server: spread(server.map(([, ms]) => ms)),
      client: { count: c.count, p50: c.p50, p90: c.p90, p99: c.p99 },
      run: { count: r.count, p50: r.p50, p90: r.p90 },
      queue: { count: q.count, p50: q.p50, p90: q.p90 },
      byLanguage: [...Map.groupBy(server, ([language]) => language)]
        .map(([language, rows]) => ({ language, count: rows.length, p50: spread(rows.map(([, ms]) => ms)).p50 }))
        .sort((a, b) => b.count - a.count),
      verdicts: top(verdicts, ['verdict']),
      queuedNow: active.find(([status]) => status === 'queued')?.[1] ?? 0,
      runningNow: active.reduce((total, [status, n]) => total + (status === 'queued' ? 0 : n), 0),
    },
    // ponytail: returning accounts' first run or AC is left out; count it if old accounts matter.
    funnel: {
      visitors: vids.size, problemBank: bank.size, problem: opened.size, signedUp: cohort.size,
      ran: ran.size, accepted: solved.size,
    },
    // Newest cohort first; a return count is null until its (UTC) day is over.
    retention: [...Map.groupBy(cohort, ([, day]) => day)]
      .sort((a, b) => b[0] - a[0])
      .map(([day, users]) => ({
        day: dayOf(day * DAY),
        users: users.length,
        d1: day + 1 >= last ? null : users.filter(([id]) => d1.has(id)).length,
        d7: day + 7 >= last ? null : users.filter(([id]) => d7.has(id)).length,
      })),
    topViews: top(views, ['view', 'type']),
    topContent: top(content, ['type', 'slug']),
    topSearches: top(searches, ['q']),
    errors: top(errors, ['stage', 'status']),
    locales: top(locales, ['locale']),
  };
}

const cache = new Map<number, { at: number; value: ReturnType<typeof summarize> }>();
/** The dashboard summary for the last `days` UTC days, cached a minute per range. */
export function summary(days: number) {
  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = summarize(days);
  cache.set(days, { at: Date.now(), value });
  // A failed computation is not cached.
  value.catch(() => cache.delete(days));
  return value;
}

export async function handleMetrics(request: Request, p: Person | null, path: string[]) {
  const [action] = path;
  if (request.method === 'POST' && !action) return ingest(request, p);
  if (request.method === 'GET' && action === 'summary') {
    requireTeacher(p);
    const days = Math.floor(Number(new URL(request.url).searchParams.get('days'))) || 14;
    return json(await summary(Math.min(90, Math.max(1, days))));
  }
  throw new HttpError(404, '接口不存在');
}
