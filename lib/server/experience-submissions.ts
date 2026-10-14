import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { experienceFacts, MEMBER_BODY, RESULTS, ROUND_LABELS } from '@/lib/experience';
import { employerSlug } from '@/lib/oa-company-brands';
import type { Person } from './auth';
import { companyPractice } from './company-hub';
import { auditStatement, HttpError, json, limit, requirePerson, requireTeacher } from './http';
import { monthKey, recentSince, reportCompanies } from './learner-cloud';
import { readJson } from './my-practice';
import { settleExperience } from './points';
import { publicLibraryDescription } from './public-library';
import type Database from 'better-sqlite3';

/**
 * Interview experiences members write themselves (db/experience-submissions-schema.ts). A post
 * is public only after a teacher approves it; until then its author and teachers see it. Public
 * posts merge into the experiences list (content-library.ts) and company pages, marked as member
 * submissions, under the slug `member.<id>`. Authors are named only by an opted-in public handle.
 */
const DAY = 86400000;
// ponytail: flat caps; a reputation system can loosen them for trusted authors later.
const PER_DAY = 3;
const PENDING_MAX = 5;
export const { min: BODY_MIN, max: BODY_MAX } = MEMBER_BODY;
/** Distinct readers' reports that take an approved post down until a teacher looks again. */
export const FLAGS_HIDE = 3;
/** Approved posts a list merges at most. */
const MERGE_MAX = 500;

const ID = /^[A-Za-z0-9_-]{12}$/;
const MEMBER = /^member\.([A-Za-z0-9_-]{12})$/;
export const memberSlug = (id: string) => `member.${id}`;
export const memberIdOf = (slug: string | null | undefined) => MEMBER.exec(slug ?? '')?.[1] ?? null;
/** The post's server-rendered, canonical page. */
export const memberExperiencePath = (id: string) => `/library/experience-ugc/${id}`;

// Control characters other than tabs and newlines never belong in a post.
// oxlint-disable-next-line no-control-regex -- Matching control characters is the point.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
/**
 * Addresses typed into a post are masked: no one's email is published. Bounded parts and the
 * lookbehind keep it linear: an unbounded `[\w.+-]+@` rescans the rest of a long word from
 * every letter (20k letters took 250ms).
 */
export const redactEmails = (s: string) =>
  s.replace(/(?<![\w.+-])[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63})+/g, '[email]');
const field = (min: number, max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => redactEmails(clean(s)).trim())
    .refine((s) => s.length >= min);
/** Nesting a post may reach: thousands of levels overflow the markdown renderer's stack. */
export const DEPTH_MAX = 32;
const loose = (c: string) => /[\s\p{P}\p{S}]/u.test(c);
/** Quote, list item and footnote markers opening a line. */
const CONTAINERS = /^(?:[ \t]*(?:>|[*+-](?=[ \t])|\d{1,9}[.)](?=[ \t])|\[\^[^\]\n]{0,999}\]:))+/;
/**
 * How deeply markdown nests, from above: quote, list and footnote markers opening a line plus
 * emphasis runs (`*`, `_`, `~`) left open in the paragraph, by CommonMark's flanking rules.
 * Linear in the text. Unindented fenced code is skipped (pointers and `*args` would add up).
 * Nesting by indentation alone isn't counted: every level indents each line below it, so the
 * length cap holds it to ~140.
 */
export function markdownDepth(text: string) {
  // An HTML block can swallow a fence line; with one about, fenced code counts like any text.
  const fences = !/^ {0,3}</m.test(text);
  const open: Record<string, number> = { '*': 0, _: 0, '~': 0 };
  let deepest = 0,
    fence = '';
  for (const line of text.split(/\r\n?|\n/)) {
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
      if (close?.[0] === fence[0] && close.length >= fence.length) fence = '';
      continue;
    }
    // Only an unindented fence surely sits at the top, where nothing but its close ends it.
    fence = (fences && /^(?:`{3,}(?=[^`]*$)|~{3,})/.exec(line)?.[0]) || '';
    const markers = fence ? '' : (CONTAINERS.exec(line)?.[0] ?? '');
    const rest = fence ? '' : line.slice(markers.length);
    // A blank line, fence, list item or heading starts a paragraph; a quote marker may continue one.
    if (!rest.trim() || /[*+\-\d^]/.test(markers) || /^\s*#/.test(rest)) open['*'] = open._ = open['~'] = 0;
    const blocks = markers.match(/>|[*+-]|\d{1,9}[.)]|\[\^/g)?.length ?? 0;
    deepest = Math.max(deepest, blocks + open['*'] + open._ + open['~']);
    for (const run of rest.matchAll(/\*+|_+|~+/g)) {
      const before = rest[run.index - 1] ?? ' ',
        after = rest[run.index + run[0].length] ?? ' ';
      const left = !/\s/.test(after) && (!loose(after) || loose(before));
      const right = !/\s/.test(before) && (!loose(before) || loose(after));
      const c = run[0][0];
      if (left && !right) {
        open[c] += run[0].length;
        deepest = Math.max(deepest, blocks + open['*'] + open._ + open['~']);
      } else if (right && !left) open[c] = Math.max(0, open[c] - run[0].length);
    }
  }
  return deepest;
}
const ROUNDS = Object.keys(ROUND_LABELS) as [string, ...string[]];
const OUTCOMES = Object.keys(RESULTS) as [string, ...string[]];
const submission = z
  .object({
    company: z.string().regex(/^[a-z0-9-]{1,80}$/),
    title: field(4, 120),
    role: field(2, 80),
    rounds: z.array(z.enum(ROUNDS)).min(1).max(6),
    result: z.enum(OUTCOMES).nullable().default(null),
    month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
    body: field(BODY_MIN, BODY_MAX),
    questions: z.array(field(3, 300)).max(20).default([]),
    // The author confirms it is their own interview and that it shares nothing under NDA.
    agree: z.literal(true),
  })
  .strict();

type Row = {
  id: string;
  user_id: string;
  company_slug: string;
  title: string;
  role: string;
  rounds: string;
  result: string | null;
  interview_month: string;
  body: string;
  questions: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string;
  reviewed_at: number | null;
  created_at: number;
  handle?: string | null;
  flags?: number;
};
const HANDLE = `(SELECT u.handle FROM user_profiles u WHERE u.user_id=s.user_id AND u.visible=1) AS handle`;
const FLAGS = `(SELECT COUNT(*) FROM experience_flags f WHERE f.submission_id=s.id)`;
const PUBLIC = `s.status='approved' AND ${FLAGS}<${FLAGS_HIDE}`;

/** Employers a post may name and show under: those with a company page, hidden ones left out. */
const companyNames = () => new Map(reportCompanies().map((c) => [c.slug, c.name]));
const strings = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** A post in the content library's summary shape, marked with `member`. */
function summaryOf(r: Row, names: Map<string, string>) {
  const rounds = strings(r.rounds);
  return {
    type: 'experience',
    slug: memberSlug(r.id),
    title: r.title,
    // The opening is all a summary needs, and caps the description's regexes on hostile text.
    summary: publicLibraryDescription({ title: r.title, summary: null, body: r.body.slice(0, 600) }),
    titleZh: null,
    summaryZh: null,
    level: null,
    company: { slug: r.company_slug, name: names.get(r.company_slug) ?? r.company_slug },
    role: r.role,
    category: null,
    difficulty: null,
    round: rounds.at(-1) ?? null,
    seniority: null,
    tags: [] as string[],
    publishedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    partial: false,
    // The month is all a member gives; the 1st only makes it a date (pages show the month).
    ...experienceFacts({ result: r.result, rounds, interview_date: `${r.interview_month}-01` }),
    member: { handle: r.handle ?? null },
  };
}
export type MemberSummary = ReturnType<typeof summaryOf>;

// ---------------------------------------------------------------- merging into lists

/**
 * Approved posts matching an experiences list's filters, in the list's order with its sort key:
 * the interview month (a post sorts first within its month) or, for ?sort=new, approval time.
 * Category, difficulty and kind filters never match a post.
 */
export function memberExperiences(params: URLSearchParams) {
  if (params.get('category') || params.get('difficulty') || params.get('kind')) return [];
  const where = [PUBLIC],
    args: string[] = [];
  const company = params.get('company');
  if (company) {
    where.push('s.company_slug=?');
    args.push(employerSlug(company.slice(0, 120)));
  }
  const role = params.get('role');
  if (role) {
    where.push('s.role=? COLLATE NOCASE');
    args.push(role.slice(0, 120));
  }
  const round = params.get('round');
  if (round) {
    where.push('EXISTS(SELECT 1 FROM json_each(s.rounds) WHERE value=?)');
    args.push(round.slice(0, 120));
  }
  const result = params.get('result');
  if (result) {
    where.push('s.result=?');
    args.push(result.slice(0, 40));
  }
  // Every word has to appear in the title, body or role.
  for (const word of (params.get('q') || '').trim().slice(0, 120).split(/\s+/).filter(Boolean).slice(0, 6)) {
    const like = `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(`(s.title LIKE ? ESCAPE '\\' OR s.body LIKE ? ESCAPE '\\' OR s.role LIKE ? ESCAPE '\\')`);
    args.push(like, like, like);
  }
  const fresh = params.get('sort') === 'new';
  const names = companyNames();
  return (
    sqlite()
      .prepare(
        `SELECT s.id,s.company_slug,s.title,s.role,s.rounds,s.result,s.interview_month,s.reviewed_at,
          substr(s.body,1,600) AS body,${HANDLE}
        FROM experience_submissions s WHERE ${where.join(' AND ')}
        ORDER BY ${fresh ? 's.reviewed_at DESC' : 's.interview_month DESC, s.reviewed_at DESC'}, s.id LIMIT ${MERGE_MAX}`,
      )
      .all(...args) as Row[]
  )
    .filter((r) => names.has(r.company_slug))
    .map((r) => ({
      key: fresh ? new Date(r.reviewed_at ?? 0).toISOString() : `${r.interview_month}-31`,
      // Built only for the posts mergePage puts on the page.
      get item() {
        return summaryOf(r, names);
      },
    }));
}

/**
 * One page of a list that interleaves `members` (in list order, each with its sort key) into
 * library rows sorted descending by the same key. `libraryKeys` holds every matching library
 * row's key; null puts the members first (a search ranks by relevance, which posts lack).
 * `read(limit, offset)` returns library rows in list order.
 */
export function mergePage<T, M>(
  members: readonly { key: string; item: M }[],
  libraryKeys: readonly (string | null)[] | null,
  offset: number,
  size: number,
  read: (limit: number, offset: number) => T[],
): (T | M)[] {
  const keys = libraryKeys?.map((k) => k ?? '').sort().reverse() ?? null;
  // Library rows ahead of a key (strictly: a tie puts the post first), by binary search.
  const ahead = (key: string) => {
    if (!keys) return 0;
    let lo = 0,
      hi = keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid] > key) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const onPage = new Map<number, M>();
  let before = 0;
  members.forEach((m, i) => {
    const position = ahead(m.key) + i;
    if (position < offset) before++;
    else if (position < offset + size) onPage.set(position, m.item);
  });
  const rows = size > onPage.size ? read(size - onPage.size, offset - before) : [];
  const out: (T | M)[] = [];
  let next = 0;
  for (let position = offset; position < offset + size; position++) {
    const member = onPage.get(position);
    if (member) out.push(member);
    else if (next < rows.length) out.push(rows[next++]);
  }
  return out;
}

/** A company page's newest approved posts. */
export function companyMemberExperiences(company: string, max = 6) {
  const names = companyNames();
  if (!names.has(company)) return { items: [] as MemberSummary[], total: 0 };
  const db = sqlite();
  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM experience_submissions s WHERE s.company_slug=? AND ${PUBLIC}`)
    .get(company) as { total: number };
  const items = total
    ? (
        db
          .prepare(
            `SELECT s.*,${HANDLE} FROM experience_submissions s WHERE s.company_slug=? AND ${PUBLIC}
            ORDER BY s.reviewed_at DESC, s.id LIMIT ?`,
          )
          .all(company, max) as Row[]
      ).map((r) => summaryOf(r, names))
    : [];
  return { items, total };
}

// ---------------------------------------------------------------- one post

/**
 * A post as its pages show it, or null. Approved posts (not reported down, company still shown)
 * are public; the author and teachers also see pending and rejected ones, with the review note.
 */
export function readMember(id: string, viewer: Pick<Person, 'id' | 'role'> | null) {
  if (!ID.test(id)) return null;
  const r = sqlite()
    .prepare(`SELECT s.*,${HANDLE},${FLAGS} AS flags FROM experience_submissions s WHERE s.id=?`)
    .get(id) as Row | undefined;
  if (!r) return null;
  const names = companyNames();
  const mine = !!viewer && r.user_id === viewer.id;
  const staff = viewer?.role === 'teacher';
  const open = r.status === 'approved' && (r.flags ?? 0) < FLAGS_HIDE && names.has(r.company_slug);
  if (!open && !mine && !staff) return null;
  return {
    ...summaryOf(r, names),
    body: r.body,
    questions: strings(r.questions),
    member: {
      id: r.id,
      handle: r.handle ?? null,
      status: r.status,
      /** Shown publicly: approved and not reported down. */
      public: open,
      mine,
      note: mine || staff ? r.review_note : '',
    },
  };
}
export type MemberDetail = NonNullable<ReturnType<typeof readMember>>;

/** content/item for a `member.<id>` slug: the post plus "practise this company". */
export async function memberItem(db: Database.Database | null, slug: string, viewer: Person | null) {
  const found = readMember(memberIdOf(slug) ?? '', viewer);
  if (!found) throw new HttpError(404, '内容不存在');
  return {
    ...found,
    updatedAt: null,
    extra: {},
    relations: [],
    dupOf: null,
    practice: null,
    companyPractice: await companyPractice(db, found.company.slug),
  };
}

// ---------------------------------------------------------------- writes

function requireVerified(p: Person) {
  if (!p.verified && p.role !== 'teacher') throw new HttpError(403, '请先验证邮箱');
}

/** The author's own posts, newest first, with status and the review note. */
export function mySubmissions(userId: string) {
  const names = new Map(reportCompanies().map((c) => [c.slug, c.name]));
  return (
    sqlite()
      .prepare(
        `SELECT id,company_slug,title,status,review_note,interview_month,created_at,reviewed_at
        FROM experience_submissions WHERE user_id=? ORDER BY created_at DESC LIMIT 100`,
      )
      .all(userId) as Row[]
  ).map((r) => ({
    id: r.id,
    slug: memberSlug(r.id),
    title: r.title,
    company: { slug: r.company_slug, name: names.get(r.company_slug) ?? r.company_slug },
    status: r.status,
    note: r.review_note,
    month: r.interview_month,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  }));
}

export async function submitExperience(p: Person, input: unknown, now = Date.now()) {
  requireVerified(p);
  const d = submission.parse(input);
  if (markdownDepth(d.body) > DEPTH_MAX) throw new HttpError(400, '正文的引用、列表或强调嵌套太深');
  // This month back to 36 months, counting this one (a day either way for time zones).
  if (d.month > monthKey(now + DAY) || d.month < recentSince(now - DAY, 36)) throw new HttpError(400, '面试月份无效');
  const company = employerSlug(d.company);
  if (!companyNames().has(company)) throw new HttpError(400, '没有这家公司');
  const db = sqlite();
  const counts = db
    .prepare(
      `SELECT COALESCE(SUM(created_at>?),0) AS today,COALESCE(SUM(status='pending'),0) AS pending
      FROM experience_submissions WHERE user_id=?`,
    )
    .get(now - DAY, p.id) as { today: number; pending: number };
  if (counts.today >= PER_DAY) throw new HttpError(429, '今天的投稿次数已达上限');
  if (counts.pending >= PENDING_MAX) throw new HttpError(409, '待审核的投稿太多，请等审核后再投');
  // Withdrawing deletes the row, so the count above alone would reset; this one keeps counting.
  await limit(p, 'experience-submit', PER_DAY, 86400);
  const id = randomBytes(9).toString('base64url');
  db.prepare(
    `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,rounds,result,interview_month,body,questions,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    p.id,
    company,
    d.title,
    d.role,
    JSON.stringify([...new Set(d.rounds)]),
    d.result,
    d.month,
    d.body,
    JSON.stringify(d.questions),
    now,
  );
  return readMember(id, p)!;
}

/** The author takes a post down for good, whatever its status. */
function withdraw(p: Person, id: string) {
  const db = sqlite();
  // A withdrawn report takes its points with it (settled while the row still names the author).
  if (db.prepare('SELECT 1 FROM experience_submissions WHERE id=? AND user_id=?').get(id, p.id)) settleExperience(id, false);
  const gone = db.transaction(() => {
    const { changes } = db.prepare('DELETE FROM experience_submissions WHERE id=? AND user_id=?').run(id, p.id);
    if (changes) db.prepare('DELETE FROM experience_flags WHERE submission_id=?').run(id);
    return changes;
  })();
  if (!gone) throw new HttpError(404, '内容不存在');
  return { id, deleted: true };
}

const REASONS = ['nda', 'personal', 'spam', 'inaccurate', 'offensive', 'other'] as const;
/** A reader reports a public post; one report per reader, the latest reason wins. */
function flag(p: Person, id: string, input: unknown) {
  requireVerified(p);
  const d = z
    .object({ reason: z.enum(REASONS), note: field(0, 300).default('') })
    .strict()
    .parse(input);
  const post = readMember(id, p);
  if (!post?.member.public) throw new HttpError(404, '内容不存在');
  if (post.member.mine) throw new HttpError(400, '不能举报自己的投稿');
  sqlite()
    .prepare(
      `INSERT INTO experience_flags(submission_id,user_id,reason,note,created_at) VALUES(?,?,?,?,?)
      ON CONFLICT(submission_id,user_id) DO UPDATE SET reason=excluded.reason,note=excluded.note`,
    )
    .run(id, p.id, d.reason, d.note, Date.now());
  // Reported down (FLAGS_HIDE readers): the author's points for it go back until a teacher re-approves.
  const flags = sqlite().prepare('SELECT COUNT(*) FROM experience_flags WHERE submission_id=?').pluck().get(id) as number;
  if (flags >= FLAGS_HIDE) settleExperience(id, false);
  return { id, flagged: true };
}

/** Teachers: posts waiting for review (oldest first), reported ones and the latest approved. */
export function reviewQueue() {
  const db = sqlite();
  const names = companyNames();
  const pick = (where: string, order: string) =>
    (
      db
        .prepare(
          `SELECT s.*,${HANDLE},${FLAGS} AS flags,
            (SELECT group_concat(f.reason || CASE WHEN f.note<>'' THEN ': ' || f.note ELSE '' END, char(10))
              FROM experience_flags f WHERE f.submission_id=s.id) AS reasons
          FROM experience_submissions s WHERE ${where} ORDER BY ${order} LIMIT 50`,
        )
        .all() as (Row & { reasons: string | null })[]
    ).map((r) => ({
      ...summaryOf(r, names),
      id: r.id,
      body: r.body,
      questions: strings(r.questions),
      status: r.status,
      note: r.review_note,
      createdAt: r.created_at,
      flags: r.flags ?? 0,
      reasons: r.reasons ? r.reasons.split('\n') : [],
      // A company hidden or without a page since: approving would not publish it.
      shown: names.has(r.company_slug),
    }));
  return {
    pending: pick(`s.status='pending'`, 's.created_at, s.id'),
    flagged: pick(`s.status='approved' AND ${FLAGS}>0`, `${FLAGS} DESC, s.reviewed_at DESC`),
    approved: pick(`s.status='approved' AND ${FLAGS}=0`, 's.reviewed_at DESC'),
  };
}
export type ReviewItem = ReturnType<typeof reviewQueue>['pending'][number];

/** Approve (clearing reports) or reject with a note for the author; works on any status. */
function review(p: Person, id: string, input: unknown) {
  requireTeacher(p);
  const d = z
    .object({ status: z.enum(['approved', 'rejected']), note: field(0, 500).default('') })
    .strict()
    .parse(input);
  if (d.status === 'rejected' && !d.note) throw new HttpError(400, '请写明不通过的原因');
  const db = sqlite();
  const done = db.transaction(() => {
    const { changes } = db
      .prepare('UPDATE experience_submissions SET status=?,review_note=?,reviewed_by=?,reviewed_at=? WHERE id=?')
      .run(d.status, d.note, p.id, Date.now(), id);
    if (changes && d.status === 'approved') db.prepare('DELETE FROM experience_flags WHERE submission_id=?').run(id);
    return changes;
  })();
  if (!done) throw new HttpError(404, '内容不存在');
  settleExperience(id, d.status === 'approved');
  auditStatement(p, `experience.${d.status}`, id).run();
  return reviewQueue();
}

/** /api/oj/experiences/…: everything needs an account; reviews need a teacher. */
export async function handleExperienceSubmissions(request: Request, p: Person | null, path: string[]) {
  requirePerson(p);
  const [id, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  if (request.method === 'GET') {
    await limit(p, 'experience-read', 120);
    if (id === 'mine' && !action) return json({ items: mySubmissions(p.id) });
    if (id === 'review' && !action) {
      requireTeacher(p);
      return json(reviewQueue());
    }
    throw new HttpError(404, '接口不存在');
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'experience-write', 20);
  if (!id) return json(await submitExperience(p, await readJson(request, 100000)), 201);
  if (!ID.test(id)) throw new HttpError(404, '内容不存在');
  if (action === 'withdraw') return json(withdraw(p, id));
  if (action === 'flag') return json(flag(p, id, await readJson(request, 4000)));
  if (action === 'review') return json(review(p, id, await readJson(request, 4000)));
  throw new HttpError(404, '接口不存在');
}
