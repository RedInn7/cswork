import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { httpsLink } from '@/lib/applications';
import { JOB_SEARCH_NOTE, ROLE_FILTERS, type JobSearch } from '@/lib/job-tags';
import atsBoards from '@/lib/content/ats-boards.json';
import { hiddenCompanies } from './env';
import { recordSeasons } from './job-seasons';

/**
 * New-grad and intern openings from three keyless public ATS job boards (db/job-openings-schema.ts).
 * lib/content/ats-boards.json maps a company page slug to its board, each one checked against the
 * company its postings name. The judge worker syncs about daily
 * (lib/server/oj-worker.ts); only title, location, link, dates and a posted pay range are kept,
 * never the description. Each sync also records the hiring seasons (lib/server/job-seasons.ts).
 * Pages list what a sync saw in the last three days; the daily company digest
 * (lib/server/company-follows.ts) reports the ones first seen since.
 */
export type Ats = 'greenhouse' | 'lever' | 'ashby';
export type Board = { ats: Ats; board: string };
export type OpeningKind = 'intern' | 'new-grad';
export type PayUnit = 'year' | 'hour' | 'month';
/** A posted base pay range, whole units of `currency` (USD or CAD) per `unit`. */
export type Pay = { min: number; max: number; currency: string; unit: PayUnit };
export type Opening = {
  id: string;
  companySlug: string;
  title: string;
  location: string;
  url: string;
  kind: OpeningKind;
  postedAt: number | null;
  pay: Pay | null;
};

const HOUR = 3600000;
export const SYNC_EVERY = 20 * HOUR;
export const FRESH_FOR = 72 * HOUR;
// Long gone openings are dropped; one back after that counts as new again.
const KEEP_FOR = 30 * 24 * HOUR;
const FETCH_TIMEOUT = 10_000;
export const BOARDS = atsBoards as Record<string, Board>;

const BOARD_API: Record<Ats, (board: string) => string> = {
  greenhouse: (b) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b)}/jobs`,
  lever: (b) => `https://api.lever.co/v0/postings/${encodeURIComponent(b)}?mode=json`,
  ashby: (b) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b)}?includeCompensation=true`,
};

const WANTED = /\b(new[ -]?grads?|university|graduates?|intern(ship)?s?|entry[ -]level|early[ -]career)\b|校招/i;
const SENIOR = /\b(senior|sr|staff|principal|manager|director|lead|head|recruit(er|ing)?)\b/i;
/** 'intern' or 'new-grad' for an early-career title, null for anything else. */
export function openingKind(title: string): OpeningKind | null {
  if (!WANTED.test(title) || SENIOR.test(title)) return null;
  return /\bintern(ship)?s?\b/i.test(title) ? 'intern' : 'new-grad';
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const list = (v: unknown) => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : typeof v === 'number' ? String(v) : '');
const time = (v: unknown) => {
  const at = typeof v === 'number' ? v : Date.parse(str(v));
  return Number.isFinite(at) && at > 0 ? at : null;
};

// ponytail: bounds in US dollars, so only USD and CAD (close enough) ranges are kept; a figure
// outside them is a typo or a total, not a rate.
const PAY_BOUNDS: Record<PayUnit, [number, number]> = { hour: [10, 300], year: [20_000, 1_000_000], month: [2_000, 60_000] };
/** A plausible pay range, or null. */
function payOf(min: unknown, max: unknown, currency: unknown, unit: PayUnit | undefined): Pay | null {
  if (!unit || typeof min !== 'number' || typeof max !== 'number' || (currency !== 'USD' && currency !== 'CAD')) return null;
  const [low, high] = PAY_BOUNDS[unit];
  return min <= max && min >= low && max <= high ? { min: Math.round(min), max: Math.round(max), currency, unit } : null;
}
// Lever: per-year-salary, per-hour-wage, per-month-salary (one-time and the rest are no rate).
const leverPay = (j: Json) => {
  const r = obj(j.salaryRange);
  return payOf(r.min, r.max, r.currency, /^per-(year|hour|month)-/.exec(str(r.interval))?.[1] as PayUnit | undefined);
};
// Ashby, when the company publishes it: the summary's Salary component.
const ASHBY_UNIT: Record<string, PayUnit> = { '1 YEAR': 'year', '1 HOUR': 'hour', '1 MONTH': 'month' };
const ashbyPay = (j: Json) => {
  const c = list(obj(j.compensation).summaryComponents).find((s) => s.compensationType === 'Salary');
  return c ? payOf(c.minValue, c.maxValue, c.currencyCode, ASHBY_UNIT[str(c.interval)]) : null;
};

/** id, title, location, url, posting time, pay (Greenhouse's list has none). */
type Posting = [string, string, string, string, unknown, Pay | null];
/** A board's postings from its API's JSON. */
function postings(ats: Ats, body: unknown): Posting[] {
  if (ats === 'greenhouse')
    return list(obj(body).jobs).map((j): Posting => [str(j.id), str(j.title), str(obj(j.location).name), str(j.absolute_url), j.first_published ?? j.updated_at, null]);
  if (ats === 'lever')
    return list(body).map((j): Posting => [str(j.id), str(j.text), str(obj(j.categories).location), str(j.hostedUrl), j.createdAt, leverPay(j)]);
  return list(obj(body).jobs)
    .filter((j) => j.isListed !== false)
    .map((j): Posting => [str(j.id), str(j.title), str(j.location), str(j.jobUrl), j.publishedAt, ashbyPay(j)]);
}

/** The early-career openings on one board; links must be https and fit the tracker's link field. */
export function boardOpenings(companySlug: string, { ats, board }: Board, body: unknown): Opening[] {
  return postings(ats, body).flatMap(([id, title, location, url, posted, pay]) => {
    const kind = openingKind(title);
    if (!kind || !id || url.length > 500 || !httpsLink(url)) return [];
    return [{ id: `${ats}:${board}:${id}`, companySlug, title: title.slice(0, 200), location: location.slice(0, 200), url, kind, postedAt: time(posted), pay }];
  });
}

// ponytail: an in-process clock, not MAX(last_seen_at): a round where every board failed still
// waits its 20 hours, and a worker restart costs at most one extra round.
let lastAttempt = 0;
let syncing = false;
/**
 * Whether a round is running. Its rows all carry the round's start time but commit board by board,
 * so the daily digest (lib/server/company-follows.ts) waits for the round to end.
 */
export const jobSyncRunning = () => syncing;
/**
 * Fetches every board one after another (10 s each, a failed board is skipped until the next
 * round) at most once per 20 hours; returns the openings seen, or null when it is not yet time.
 */
export async function syncJobOpenings(now = Date.now(), boards: Record<string, Board> = BOARDS) {
  if (now - lastAttempt < SYNC_EVERY) return null;
  lastAttempt = now;
  syncing = true;
  try {
    return await syncBoards(now, boards);
  } finally {
    syncing = false;
  }
}
async function syncBoards(now: number, boards: Record<string, Board>) {
  const db = sqlite();
  const upsert = db.prepare(
    `INSERT INTO job_openings(id,company_slug,title,location,url,kind,posted_at,first_seen_at,last_seen_at,pay_min,pay_max,pay_currency,pay_unit)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET company_slug=excluded.company_slug,title=excluded.title,location=excluded.location,url=excluded.url,
    kind=excluded.kind,posted_at=excluded.posted_at,last_seen_at=excluded.last_seen_at,pay_min=excluded.pay_min,pay_max=excluded.pay_max,
    pay_currency=excluded.pay_currency,pay_unit=excluded.pay_unit`,
  );
  let seen = 0;
  for (const [slug, board] of Object.entries(boards)) {
    const found = await fetch(BOARD_API[board.ats](board.board), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    })
      .then(async (response) => (response.ok ? boardOpenings(slug, board, await response.json()) : null))
      .catch(() => null);
    if (!found) continue;
    db.transaction(() => {
      // The board's own row (kind 'board', id without a job id), refreshed on every fetch so it
      // outlives KEEP_FOR: its first_seen_at is the board's first sync, which the digest skips.
      upsert.run(`${board.ats}:${board.board}:`, slug, '', '', '', 'board', null, now, now, null, null, '', '');
      for (const o of found)
        upsert.run(o.id, o.companySlug, o.title, o.location, o.url, o.kind, o.postedAt, now, now, o.pay?.min ?? null, o.pay?.max ?? null, o.pay?.currency ?? '', o.pay?.unit ?? '');
      recordSeasons(slug, now);
    })();
    seen += found.length;
  }
  db.prepare('DELETE FROM job_openings WHERE last_seen_at<?').run(now - KEEP_FOR);
  return seen;
}

/** Openings a sync saw in the last three days (one company's, or all), newest first; hidden companies left out. */
export function freshOpenings(now = Date.now(), company?: string): (Opening & { firstSeenAt: number })[] {
  const hidden = hiddenCompanies();
  const rows = sqlite()
    .prepare(
      `SELECT id,company_slug AS companySlug,title,location,url,kind,posted_at AS postedAt,first_seen_at AS firstSeenAt,pay_min AS min,pay_max AS max,
      pay_currency AS currency,pay_unit AS unit FROM job_openings
      WHERE last_seen_at>=? AND kind<>'board'${company ? ' AND company_slug=?' : ''} ORDER BY COALESCE(posted_at,first_seen_at) DESC,id`,
    )
    .all(...(company ? [now - FRESH_FOR, company] : [now - FRESH_FOR])) as (Omit<Opening, 'pay'> & Pay & { firstSeenAt: number })[];
  return rows.flatMap(({ min, max, currency, unit, ...o }) =>
    hidden.has(o.companySlug) ? [] : [{ ...o, pay: unit ? { min, max, currency, unit } : null }],
  );
}

// A saved search is learner-written note text (lib/server/my-practice.ts): anything off-shape is none.
const savedSearch = z.object({
  kind: z.enum(['', 'intern', 'new-grad']),
  role: z.enum(ROLE_FILTERS),
  term: z.string().regex(/^[a-z0-9-]{0,20}$/),
  q: z.string().max(60),
  company: z.string().regex(/^[a-z0-9-]{0,80}$/),
  paid: z.boolean(),
});
export function parseJobSearch(body: string): JobSearch | null {
  try {
    const parsed = savedSearch.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
/** The learner's saved /career/jobs search (note career:jobs-search) and their profile's target role. */
export function viewerJobSearch(userId: string) {
  const db = sqlite();
  const body = db.prepare('SELECT body FROM user_notes WHERE user_id=? AND target=?').pluck().get(userId, JOB_SEARCH_NOTE);
  const role = db.prepare('SELECT target_role FROM user_profiles WHERE user_id=?').pluck().get(userId);
  return { saved: typeof body === 'string' ? parseJobSearch(body) : null, targetRole: typeof role === 'string' ? role : '' };
}
