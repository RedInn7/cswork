import { sqlite } from '@/db/sqlite';
import { httpsLink } from '@/lib/applications';
import atsBoards from '@/lib/content/ats-boards.json';
import { hiddenCompanies } from './env';

/**
 * New-grad and intern openings from three keyless public ATS job boards (db/job-openings-schema.ts).
 * lib/content/ats-boards.json maps a company page slug to its board, each one checked against the
 * company its postings name. The judge worker syncs about daily
 * (lib/server/oj-worker.ts); only title, location, link and dates are kept, never the description.
 * Pages list what a sync saw in the last three days; the daily company digest
 * (lib/server/company-follows.ts) reports the ones first seen since.
 */
export type Ats = 'greenhouse' | 'lever' | 'ashby';
export type Board = { ats: Ats; board: string };
export type OpeningKind = 'intern' | 'new-grad';
export type Opening = {
  id: string;
  companySlug: string;
  title: string;
  location: string;
  url: string;
  kind: OpeningKind;
  postedAt: number | null;
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
  ashby: (b) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b)}`,
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

/** id, title, location, url, posting time. */
type Posting = [string, string, string, string, unknown];
/** A board's postings from its API's JSON. */
function postings(ats: Ats, body: unknown): Posting[] {
  if (ats === 'greenhouse')
    return list(obj(body).jobs).map((j): Posting => [str(j.id), str(j.title), str(obj(j.location).name), str(j.absolute_url), j.first_published ?? j.updated_at]);
  if (ats === 'lever')
    return list(body).map((j): Posting => [str(j.id), str(j.text), str(obj(j.categories).location), str(j.hostedUrl), j.createdAt]);
  return list(obj(body).jobs)
    .filter((j) => j.isListed !== false)
    .map((j): Posting => [str(j.id), str(j.title), str(j.location), str(j.jobUrl), j.publishedAt]);
}

/** The early-career openings on one board; links must be https and fit the tracker's link field. */
export function boardOpenings(companySlug: string, { ats, board }: Board, body: unknown): Opening[] {
  return postings(ats, body).flatMap(([id, title, location, url, posted]) => {
    const kind = openingKind(title);
    if (!kind || !id || url.length > 500 || !httpsLink(url)) return [];
    return [{ id: `${ats}:${board}:${id}`, companySlug, title: title.slice(0, 200), location: location.slice(0, 200), url, kind, postedAt: time(posted) }];
  });
}

// ponytail: an in-process clock, not MAX(last_seen_at): a round where every board failed still
// waits its 20 hours, and a worker restart costs at most one extra round.
let lastAttempt = 0;
/**
 * Fetches every board one after another (10 s each, a failed board is skipped until the next
 * round) at most once per 20 hours; returns the openings seen, or null when it is not yet time.
 */
export async function syncJobOpenings(now = Date.now(), boards: Record<string, Board> = BOARDS) {
  if (now - lastAttempt < SYNC_EVERY) return null;
  lastAttempt = now;
  const db = sqlite();
  const upsert = db.prepare(
    `INSERT INTO job_openings(id,company_slug,title,location,url,kind,posted_at,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET company_slug=excluded.company_slug,title=excluded.title,location=excluded.location,url=excluded.url,
    kind=excluded.kind,posted_at=excluded.posted_at,last_seen_at=excluded.last_seen_at`,
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
      upsert.run(`${board.ats}:${board.board}:`, slug, '', '', '', 'board', null, now, now);
      for (const o of found) upsert.run(o.id, o.companySlug, o.title, o.location, o.url, o.kind, o.postedAt, now, now);
    })();
    seen += found.length;
  }
  db.prepare('DELETE FROM job_openings WHERE last_seen_at<?').run(now - KEEP_FOR);
  return seen;
}

/** Openings a sync saw in the last three days (one company's, or all), newest first; hidden companies left out. */
export function freshOpenings(now = Date.now(), company?: string): Opening[] {
  const hidden = hiddenCompanies();
  const rows = sqlite()
    .prepare(
      `SELECT id,company_slug AS companySlug,title,location,url,kind,posted_at AS postedAt FROM job_openings
      WHERE last_seen_at>=? AND kind<>'board'${company ? ' AND company_slug=?' : ''} ORDER BY COALESCE(posted_at,first_seen_at) DESC,id`,
    )
    .all(...(company ? [now - FRESH_FOR, company] : [now - FRESH_FOR])) as Opening[];
  return rows.filter((o) => !hidden.has(o.companySlug));
}
