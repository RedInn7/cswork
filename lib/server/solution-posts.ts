import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import {
  anonymousAllowed,
  autoTitle,
  isChannel,
  postHref,
  REPORT_CLEARED,
  REPORTS_HIDE,
  targetKind,
} from '@/lib/community';
import { STOP_NAMES } from '@/lib/route-stops';
import type { Person } from './auth';
import { library } from './content-library';
import { inRunningContest, refuseInContest, runningContestProblems } from './contests';
import { isCourseOwner } from './course-visibility';
import { hiddenCompanies } from './env';
import { memberIdOf, readMember } from './experience-submissions';
import { auditStatement, HttpError, json, limit, limitReader, requirePerson } from './http';
import { maskName } from './judge-feed';
import { publicProblem, reportCompanies, requireVerified } from './learner-cloud';
import { readJson } from './my-practice';
import { notify } from './notify';
import { awardUpvote } from './points';
import { sdChapter } from './system-design-course';
import { badgeName, badgeSql, badgeTarget } from './work-verify';

/**
 * Community posts and their comments (db/solution-posts-schema.ts). A post's problem_id is its
 * target (lib/community.ts): a judge problem's solutions (signed in), a discussion channel's
 * threads, comments under an experience, answers to an interview question or a system design
 * chapter's discussion (those four read signed out). A thread may carry a poll
 * (db/post-polls-schema.ts); a reader saves a post as a star mark on post:<id>. Every read
 * re-checks that the target is still visible (HIDDEN_COMPANIES, course gates, the library,
 * the system design chapters), every author write names its author in the WHERE clause, and authors
 * show by their public handle or a masked name (never the account name, which is often a real
 * one). Bodies are Markdown the client renders without raw HTML. An anonymous post (only where
 * anonymousAllowed) shows other readers no author at all, nor do its author's comments under it;
 * its author and the moderation queue still see who wrote it. Under an anonymous interview report
 * (`exp:member.<id>`) its author writes anonymously throughout: their posts go up anonymous and
 * their comments read as the anonymous OP's. Comments nest one level (parent_id):
 * a reply to a reply goes under the same top-level comment. Replies, @mentions and upvotes leave
 * in-app notices (lib/server/notify.ts).
 */
const DAY = 86400000;
const PAGE = 30;
const POSTS_PER_DAY = 10;
const COMMENTS_PER_DAY = 100;
const REPORTS_PER_DAY = 30;
/** @handles a post or comment may notify; the handle shape is learner-cloud's HANDLE. */
const MENTIONS_MAX = 5;
const MENTION = /(?:^|\s)@([a-z0-9][a-z0-9-]{1,28}[a-z0-9])(?![a-z0-9-])/g;
// hidden: shown, removed by its author (for good), hidden by a moderator (reversible).
const SHOWN = 0;
const REMOVED = 1;
const MODERATED = 2;

const id = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !s.includes('\0'));
const pollInput = z
  .object({
    question: text(200),
    options: z
      .array(text(80))
      .min(2)
      .max(6)
      .refine((o) => new Set(o).size === o.length),
    multi: z.boolean().default(false),
    closesAt: z.number().int().positive().nullable().default(null),
  })
  .strict();
const postInput = z
  .object({
    // Answers and comments may leave it empty: they take their first line.
    title: z
      .string()
      .trim()
      .max(120)
      .refine((s) => !s.includes('\0'))
      .default(''),
    body: text(20000),
    language: z.enum(['', 'python', 'cpp', 'java', 'go']).default(''),
    tag: z.string().max(80).default(''),
    // A thread's poll: null removes it, left out keeps it as it is.
    poll: pollInput.nullable().optional(),
  })
  .strict();
const commentInput = z.object({ body: text(1000), parentId: id.optional() }).strict();
export const reportReason = z.enum(['spam', 'offensive', 'wrong', 'other']);
const reportInput = z.object({ reason: reportReason }).strict();

/**
 * Answer reputation, an SQL expression for the author in `user`: what upvotes on their posts and
 * approved interview reports paid, less what anonymous ones paid, so the number moving never ties
 * an anonymous post to a profile. Upvote refs are `<post id>:<voter>`, report refs `<id>#<n>`.
 */
export const reputationSql = (user: string) => `((SELECT COALESCE(SUM(l.delta),0) FROM point_ledger l
    WHERE l.user_id=${user} AND l.reason IN ('upvote','experience'))
  - (SELECT COALESCE(SUM(l.delta),0) FROM solution_posts a JOIN point_ledger l ON l.user_id=a.user_id
    AND l.reason='upvote' AND l.ref_id>a.id||':' AND l.ref_id<a.id||';' WHERE a.user_id=${user} AND a.anonymous=1)
  - (SELECT COALESCE(SUM(l.delta),0) FROM experience_submissions a JOIN point_ledger l ON l.user_id=a.user_id
    AND l.reason='experience' AND l.ref_id>a.id||'#' AND l.ref_id<a.id||'$' WHERE a.user_id=${user} AND a.anonymous=1))`;

// Saves (stars) count from verified accounts only, like a list's (learner-cloud's VERIFIED; it
// imports this module, so the check is inline).
const POST = `SELECT sp.id,sp.problem_id AS problemId,sp.title,sp.language,sp.tag,sp.hidden,
  sp.created_at AS createdAt,sp.updated_at AS updatedAt,COALESCE(u.name,'') AS author,pr.handle,
  sp.user_id=@me AS mine,
  (SELECT COUNT(*) FROM post_votes v WHERE v.post_id=sp.id) AS votes,
  EXISTS(SELECT 1 FROM post_votes v WHERE v.post_id=sp.id AND v.user_id=@me) AS voted,
  (SELECT COUNT(*) FROM post_comments c WHERE c.post_id=sp.id AND c.hidden=0) AS comments,
  (SELECT COUNT(*) FROM user_marks m JOIN "user" su ON su.id=m.user_id AND su.email_verified=1
    WHERE m.target='post:'||sp.id AND m.mark='star') AS stars,
  EXISTS(SELECT 1 FROM user_marks m WHERE m.target='post:'||sp.id AND m.mark='star' AND m.user_id=@me) AS starred,
  ${badgeSql('sp.user_id', 'posts')} AS employer,${badgeSql('sp.user_id', 'referrals')} AS referrer,
  sp.anonymous,sp.pinned,${reputationSql('sp.user_id')} AS reputation`;
const PROFILE = (col: string) => `LEFT JOIN user_profiles pr ON pr.user_id=${col} AND pr.visible=1`;
const FROM_POST = `FROM solution_posts sp LEFT JOIN "user" u ON u.id=sp.user_id ${PROFILE('sp.user_id')}`;
type PostRow = {
  id: string;
  problemId: string;
  title: string;
  language: string;
  tag: string;
  hidden: number;
  createdAt: number;
  updatedAt: number;
  author: string;
  handle: string | null;
  mine: number;
  votes: number;
  voted: number;
  comments: number;
  stars: number;
  starred: number;
  employer: string | null;
  referrer: string | null;
  anonymous: number;
  pinned: number;
  reputation: number;
  body?: string;
  excerpt?: string;
};
/**
 * Your own name to you; to everyone else the public handle if you chose one, else a masked name,
 * and nothing at all when anonymous. Reputation shows beside a public handle only.
 */
// mine (and voted) leave the rest first: a 0/1 column and a boolean of one name intersect to never.
const byline = <T extends { author: string; handle: string | null; mine: number; anonymous: number; reputation: number }>({
  handle,
  mine,
  anonymous,
  reputation,
  ...row
}: T) => ({
  ...row,
  author: mine ? row.author : anonymous ? '' : handle || (row.author ? maskName(row.author) : ''),
  mine: !!mine,
  anonymous: !!anonymous,
  reputation: handle && !anonymous ? reputation : null,
});
const shape = ({ voted, starred, employer, referrer, pinned, ...r }: PostRow) => ({
  ...byline(r),
  voted: !!voted,
  starred: !!starred,
  pinned: !!pinned,
  // The verified employee badge, where its owner switched it on and the target allows it (work-verify).
  employer: !r.anonymous && badgeTarget(r.problemId) ? badgeName(employer) : null,
  // A referral thread by a verified employee of the company it is tagged with: "request a referral".
  referral:
    !r.anonymous && r.problemId === 'discuss:referral' && !!r.tag && referrer === r.tag && !!badgeName(referrer),
});

/** As posts and notices name people: the public handle if the profile is visible, else a masked name. */
export function nameOf(userId: string) {
  const r = sqlite()
    .prepare(
      `SELECT u.name,pr.handle FROM "user" u LEFT JOIN user_profiles pr ON pr.user_id=u.id AND pr.visible=1 WHERE u.id=?`,
    )
    .get(userId) as { name: string; handle: string | null } | undefined;
  return r?.handle ? `@${r.handle}` : maskName(r?.name ?? '');
}
export const canModerate = (p: Person | null) => !!p && (p.role === 'teacher' || isCourseOwner(p));
const reportedDown = (target: string) =>
  `(SELECT COUNT(*) FROM post_reports r WHERE r.target=${target} AND r.reason<>'${REPORT_CLEARED}')>=${REPORTS_HIDE}`;
/** Posts tagged with a hidden company stay out like the company's own pages. */
const hiddenTags = () => {
  const slugs = [...hiddenCompanies()].filter((s) => /^[a-z0-9-]+$/.test(s));
  return slugs.length ? ` AND sp.tag NOT IN (${slugs.map((s) => `'${s}'`).join(',')})` : '';
};
const ITEM = /^[\w-]{1,300}$/;
/** Who wrote the anonymous interview report a target (`exp:member.<id>`) discusses, else ''. */
function anonymousReporter(target: string) {
  const id = targetKind(target) === 'exp' ? memberIdOf(target.slice(4)) : null;
  if (!id) return '';
  return (
    (sqlite()
      .prepare('SELECT user_id FROM experience_submissions WHERE id=? AND anonymous=1')
      .pluck()
      .get(id) as string | undefined) ?? ''
  );
}
/**
 * Whether a target is open to posts: a published problem the reader may see, a known channel or
 * system design chapter, or an experience or interview question the library (or an approved
 * member post) still shows.
 */
export async function visibleTarget(p: Person | null, target: string) {
  const kind = targetKind(target);
  if (kind === 'problem') return !!p && (await publicProblem(p, target));
  if (!kind) return false;
  const key = target.slice(target.indexOf(':') + 1);
  if (kind === 'discuss') return isChannel(key);
  if (kind === 'sd') return !!sdChapter(key);
  if (kind === 'exp' && memberIdOf(key)) return !!readMember(memberIdOf(key)!, null)?.member.public;
  if (!ITEM.test(key)) return false;
  const row = library()
    ?.prepare('SELECT company_slug AS company FROM items WHERE type=? AND slug=? LIMIT 1')
    .get(kind === 'exp' ? 'experience' : 'interview_question', key) as { company: string | null } | undefined;
  return !!row && !hiddenCompanies().has((row.company ?? '').toLowerCase());
}
/** A solution's tag is a Line 500 stop (its technique); a thread's is a company. */
function validTag(target: string, tag: string) {
  if (!tag) return true;
  const kind = targetKind(target);
  if (kind === 'problem') return Object.hasOwn(STOP_NAMES, tag);
  return kind === 'discuss' && reportCompanies().some((c) => c.slug === tag);
}
/** The title a post is saved with: its own, or for answers and comments the body's first line. */
function titleOf(target: string, d: { title: string; body: string }) {
  const kind = targetKind(target);
  const title = d.title || (kind === 'exp' || kind === 'q' || kind === 'sd' ? autoTitle(d.body) : '');
  if (!title) throw new HttpError(400, '请填写标题');
  return title;
}
/** A judge problem's solutions are closed to a learner while it is in their running contest (403). */
function refuseDuringContest(p: Person | null, target: string) {
  if (targetKind(target) === 'problem') refuseInContest(p, target);
}
function requireModerator(p: Person) {
  if (!canModerate(p)) throw new HttpError(403, '仅老师可以管理题解');
}
function underCap(table: 'solution_posts' | 'post_comments' | 'post_reports', p: Person, max: number, message: string) {
  const { n } = sqlite()
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=? AND created_at>?`)
    .get(p.id, Date.now() - DAY) as { n: number };
  if (n >= max) throw new HttpError(429, message);
}

/** A post's poll as this reader sees it, or null: counts only once they have voted or it has closed. */
function pollOf(postId: string, me: string, now = Date.now()) {
  const db = sqlite();
  const row = db
    .prepare('SELECT question,options_json AS options,multi,closes_at AS closesAt FROM post_polls WHERE post_id=?')
    .get(postId) as { question: string; options: string; multi: number; closesAt: number | null } | undefined;
  if (!row) return null;
  const options = JSON.parse(row.options) as string[];
  const mine = db
    .prepare('SELECT option FROM poll_votes WHERE post_id=? AND user_id=? ORDER BY option')
    .pluck()
    .all(postId, me) as number[];
  const voters = db.prepare('SELECT COUNT(DISTINCT user_id) FROM poll_votes WHERE post_id=?').pluck().get(postId) as number;
  const closed = row.closesAt !== null && row.closesAt <= now;
  // Results wait for the reader's own vote (or the close), so early counts don't steer the rest.
  let counts: number[] | null = null;
  if (mine.length || closed) {
    counts = options.map(() => 0);
    for (const r of db
      .prepare('SELECT option,COUNT(*) AS n FROM poll_votes WHERE post_id=? GROUP BY option')
      .all(postId) as { option: number; n: number }[])
      if (r.option < counts.length) counts[r.option] = r.n;
  }
  return { question: row.question, options, multi: !!row.multi, closesAt: row.closesAt, closed, voters, mine, counts };
}
/** Sets, replaces or (null) removes a thread's poll, inside the post's own write; frozen once anyone votes. */
function savePoll(postId: string, target: string, poll: z.infer<typeof pollInput> | null | undefined, now: number) {
  if (poll === undefined) return;
  if (poll && targetKind(target) !== 'discuss') throw new HttpError(400, '只有讨论帖可以发起投票');
  if (poll?.closesAt && poll.closesAt <= now) throw new HttpError(400, '投票截止时间要晚于现在');
  const db = sqlite();
  if (db.prepare('SELECT 1 FROM poll_votes WHERE post_id=? LIMIT 1').get(postId))
    throw new HttpError(409, '已经有人投票，不能再修改投票');
  if (!poll) db.prepare('DELETE FROM post_polls WHERE post_id=?').run(postId);
  else
    db.prepare(
      `INSERT INTO post_polls(post_id,question,options_json,multi,closes_at,created_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(post_id) DO UPDATE SET question=excluded.question,options_json=excluded.options_json,
        multi=excluded.multi,closes_at=excluded.closes_at`,
    ).run(postId, poll.question, JSON.stringify(poll.options), poll.multi ? 1 : 0, poll.closesAt, now);
}

/** ?sort=hot: votes cooling with age, votes / (hours since posting + 2)^1.5 (`votes` is POST's column). */
const HOT = 'votes/pow(max(@now-sp.created_at,0)/3600000.0+2,1.5) DESC,sp.created_at DESC';
/** ?q=: up to 6 words, each in the title or body, as LIKE patterns escaped as experience-submissions' search. */
const searchWords = (q: string | null) =>
  (q ?? '')
    .trim()
    .slice(0, 120)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((word) => `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

/**
 * A target's posts, best, hottest or newest first, optionally one tag's or matching ?q=, plus
 * whether this learner has an AC on it (posts on anything but a problem are never locked).
 * `discuss:all` lists every channel. A search stays inside one target (or `discuss:all`), never
 * across problems, so the contest gate below holds. `excerpt` is the opening; `body: true` sends
 * whole bodies (answers and comments show inline).
 * ponytail: LIKE scans the target's posts; an FTS index once one target holds tens of thousands.
 */
async function listPosts(p: Person | null, params: URLSearchParams) {
  const problem = params.get('problem') ?? '';
  const all = problem === 'discuss:all';
  if (!all && !(await visibleTarget(p, problem))) throw new HttpError(404, '题目不存在或尚未发布');
  if (!all) refuseDuringContest(p, problem);
  const sort = params.get('sort');
  // Featured (pinned) posts first, any order.
  const order = `sp.pinned DESC,${sort === 'new' ? 'sp.created_at DESC' : sort === 'hot' ? HOT : 'votes DESC,sp.created_at DESC'}`;
  const words = searchWords(params.get('q'));
  const search = words
    .map((_, i) => ` AND (sp.title LIKE @q${i} ESCAPE '\\' OR sp.body LIKE @q${i} ESCAPE '\\')`)
    .join('');
  const offset = Math.min(Math.max(0, Math.floor(Number(params.get('offset')) || 0)), 5000);
  // ?language=: one language's posts (the AC dialog's histogram links here); '' is all.
  const language = postInput.shape.language.parse(params.get('language') ?? '');
  const tag = (params.get('tag') ?? '').slice(0, 80);
  const me = p?.id ?? '';
  const db = sqlite();
  // An author still sees their own moderated or reported-down post (with a notice), nobody else does.
  const rows = db
    .prepare(
      `${POST},${params.get('body') === '1' ? 'sp.body' : 'substr(sp.body,1,300) AS excerpt'} ${FROM_POST}
      WHERE ${all ? "sp.problem_id>='discuss:' AND sp.problem_id<'discuss;'" : 'sp.problem_id=@problem'} ${tag ? 'AND sp.tag=@tag' : ''}
        AND (@language='' OR sp.language=@language)${search}
        AND (sp.user_id=@me OR (sp.hidden=${SHOWN} AND NOT ${reportedDown("'post:'||sp.id")}))
        AND sp.hidden<>${REMOVED}${hiddenTags()}
      ORDER BY ${order},sp.id LIMIT ${PAGE + 1} OFFSET @offset`,
    )
    .all({
      me,
      problem,
      tag,
      offset,
      language,
      now: Date.now(),
      ...Object.fromEntries(words.map((like, i) => [`q${i}`, like])),
    }) as PostRow[];
  const solved =
    targetKind(problem) !== 'problem' ||
    (!!p &&
      !!db
        .prepare(
          "SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND mode='judge' AND status='accepted' LIMIT 1",
        )
        .get(p.id, problem));
  return { solved, items: rows.slice(0, PAGE).map(shape), more: rows.length > PAGE };
}

/**
 * The reader's saved posts across targets, last saved first, on targets they may still see and
 * not in their running contest. `next` is the raw offset, as a dropped row leaves a short page.
 */
async function starredPosts(p: Person, params: URLSearchParams) {
  const offset = Math.min(Math.max(0, Math.floor(Number(params.get('offset')) || 0)), 5000);
  // Driven from the reader's own marks (a primary key range), then each post by its key, so the
  // cost follows their saves, not every post on the site.
  const rows = sqlite()
    .prepare(
      `${POST},substr(sp.body,1,300) AS excerpt FROM user_marks saved
      JOIN solution_posts sp ON sp.id=substr(saved.target,6)
      LEFT JOIN "user" u ON u.id=sp.user_id ${PROFILE('sp.user_id')}
      WHERE saved.user_id=@me AND saved.target>='post:' AND saved.target<'post;' AND saved.mark='star'
        AND (sp.user_id=@me OR (sp.hidden=${SHOWN} AND NOT ${reportedDown("'post:'||sp.id")}))
        AND sp.hidden<>${REMOVED}${hiddenTags()}
      ORDER BY saved.created_at DESC,sp.id LIMIT ${PAGE + 1} OFFSET @offset`,
    )
    .all({ me: p.id, offset }) as PostRow[];
  const running = runningContestProblems(p.id);
  const seen = new Map<string, boolean>();
  const items = [];
  for (const row of rows.slice(0, PAGE)) {
    if (!seen.has(row.problemId))
      seen.set(row.problemId, !running.has(row.problemId) && (await visibleTarget(p, row.problemId)));
    if (seen.get(row.problemId)) items.push(shape(row));
  }
  return { solved: true, items, more: rows.length > PAGE, next: offset + Math.min(rows.length, PAGE) };
}

/**
 * One post with its comments (and a thread's poll); a hidden or reported-down one reads as
 * missing unless it is the author's own (not removed) or a moderator asks.
 */
async function readPost(p: Person | null, postId: string) {
  const db = sqlite();
  const me = p?.id ?? '';
  const row = db.prepare(`${POST},sp.body ${FROM_POST} WHERE sp.id=@id${hiddenTags()}`).get({ me, id: postId }) as
    | PostRow
    | undefined;
  const down = () => !!db.prepare(`SELECT ${reportedDown('?')}`).pluck().get(`post:${postId}`);
  const visible =
    row &&
    ((row.hidden === SHOWN && !down()) || (row.hidden !== REMOVED && row.mine) || canModerate(p)) &&
    (await visibleTarget(p, row.problemId));
  if (!row || !visible) throw new HttpError(404, '题解不存在');
  refuseDuringContest(p, row.problemId);
  // An anonymous post's author stays anonymous in their own comments under it (marked op), as an
  // anonymous report's author does in every comment under the report.
  const reporter = anonymousReporter(row.problemId);
  const rows = (
    db
      .prepare(
        `SELECT c.id,c.parent_id AS parentId,c.body,c.created_at AS createdAt,COALESCE(u.name,'') AS author,pr.handle,
          c.user_id=@me AS mine,c.user_id IN (sp.user_id,@reporter) AS op,
          (sp.anonymous=1 AND c.user_id=sp.user_id) OR c.user_id=@reporter AS anonymous,
          (SELECT COUNT(*) FROM comment_votes v WHERE v.comment_id=c.id) AS votes,
          EXISTS(SELECT 1 FROM comment_votes v WHERE v.comment_id=c.id AND v.user_id=@me) AS voted,
          ${reputationSql('c.user_id')} AS reputation
        FROM post_comments c JOIN solution_posts sp ON sp.id=c.post_id
        LEFT JOIN "user" u ON u.id=c.user_id ${PROFILE('c.user_id')}
        WHERE c.post_id=@id AND c.hidden=${SHOWN} AND (c.user_id=@me OR NOT ${reportedDown("'comment:'||c.id")})
        ORDER BY votes DESC,c.created_at,c.id LIMIT 500`,
      )
      .all({ me, id: postId, reporter }) as {
      id: string;
      parentId: string | null;
      body: string;
      createdAt: number;
      author: string;
      handle: string | null;
      mine: number;
      op: number;
      anonymous: number;
      votes: number;
      voted: number;
      reputation: number;
    }[]
  ).map(({ op, voted, ...c }) => ({ ...byline(c), op: !!op, voted: !!voted }));
  // Each top-level comment followed by its replies, both by votes then time. A reply whose
  // comment is gone (removed, hidden) stands on its own.
  const tops = new Set(rows.filter((c) => !c.parentId).map((c) => c.id));
  const replies = Map.groupBy(
    rows.filter((c) => c.parentId && tops.has(c.parentId)),
    (c) => c.parentId,
  );
  const comments = rows
    .filter((c) => !c.parentId || !tops.has(c.parentId))
    .flatMap((c) => [{ ...c, parentId: null }, ...(tops.has(c.id) ? (replies.get(c.id) ?? []) : [])]);
  return { post: { ...shape(row), poll: pollOf(postId, me) }, comments, moderator: canModerate(p) };
}

/** A target's posts for a server-rendered page, as a signed-out reader sees them. */
export async function publicPosts(target: string, params: Record<string, string> = {}) {
  try {
    return await listPosts(null, new URLSearchParams({ ...params, problem: target }));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
/** One post as a signed-out reader sees it, or null. */
export async function publicPost(id: string) {
  if (!idOk(id)) return null;
  try {
    return await readPost(null, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
const idOk = (value: string) => id.safeParse(value).success;

/**
 * A post this learner may act on (vote, comment, report): shown, not reported down unless it is
 * their own, not tagged with a hidden company, on a visible target. As readPost sees it, so a
 * write never lands on a post its reply then reads as missing.
 */
async function openPost(p: Person, postId: string) {
  const row = sqlite()
    .prepare(
      `SELECT sp.id,sp.problem_id AS problemId,sp.user_id AS userId,sp.title,sp.anonymous,
        ${reportedDown("'post:'||sp.id")} AS down FROM solution_posts sp
      WHERE sp.id=@id AND sp.hidden=${SHOWN} AND (sp.user_id=@me OR NOT ${reportedDown("'post:'||sp.id")})${hiddenTags()}`,
    )
    .get({ id: postId, me: p.id }) as OpenPost | undefined;
  if (!row || !(await visibleTarget(p, row.problemId))) throw new HttpError(404, '题解不存在');
  refuseDuringContest(p, row.problemId);
  return row;
}
type OpenPost = { id: string; problemId: string; userId: string; title: string; anonymous: number; down: number };

/** Owners of the visible profiles @named in a text, at most MENTIONS_MAX. */
function mentioned(text: string) {
  const handles = [...new Set(Array.from(text.matchAll(MENTION), (m) => m[1]))].slice(0, MENTIONS_MAX);
  if (!handles.length) return [];
  return sqlite()
    .prepare(`SELECT user_id FROM user_profiles WHERE visible=1 AND handle IN (${handles.map(() => '?').join(',')})`)
    .pluck()
    .all(...handles) as string[];
}
/**
 * Notices for a new post or comment: `to` (replies) first, then the @mentioned; one each, never to
 * the writer, none on a reported-down post. Anonymous writing (an anonymous post's author on it, an
 * anonymous report's author under it) names no one and mentions no one. A judge problem's notice
 * carries no excerpt to a recipient it is in a running contest for.
 */
function notifyWrite(p: Person, post: OpenPost, to: { userId: string; title: string }[], text: string, now: number) {
  if (post.down) return;
  const anonymous = (!!post.anonymous && post.userId === p.id) || anonymousReporter(post.problemId) === p.id;
  const from = anonymous ? '' : `${nameOf(p.id)}: `;
  const problem = targetKind(post.problemId) === 'problem';
  const done = new Set([p.id]);
  const send = (userId: string, kind: string, title: string) => {
    if (done.has(userId)) return;
    done.add(userId);
    const body = problem && inRunningContest(userId, post.problemId, now) ? '' : `${from}${autoTitle(text)}`;
    notify({ userId, kind, title, body, href: postHref(post.problemId, post.id), now });
  };
  for (const r of to) send(r.userId, 'reply', r.title);
  if (!anonymous) for (const userId of mentioned(text)) send(userId, 'mention', '有人在讨论中提到了你');
}

/** One report per learner and target: posts, comments and group chat ('gmsg:'). */
export function fileReport(p: Person, target: string, authorId: string, reason: string) {
  if (authorId === p.id) throw new HttpError(400, '不能举报自己的内容');
  underCap('post_reports', p, REPORTS_PER_DAY, '今天的举报次数已达上限');
  sqlite()
    .prepare('INSERT INTO post_reports(target,user_id,reason,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING')
    .run(target, p.id, reason, Date.now());
}
async function report(p: Person, target: string, authorId: string, request: Request) {
  fileReport(p, target, authorId, reportInput.parse(await readJson(request, 500)).reason);
  return json({ reported: true });
}

/**
 * hide / unhide flips between shown and moderated (an author's removal stays); any action clears
 * the reports (kept, marked cleared, so the same readers cannot report it down again).
 */
const TABLES = {
  post: 'solution_posts',
  comment: 'post_comments',
  gmsg: 'study_group_messages',
} as const;
type Kind = keyof typeof TABLES;
function moderate(p: Person, kind: Kind, targetId: string, action: string) {
  if (!['hide', 'unhide', 'dismiss'].includes(action)) throw new HttpError(404, '题解接口不存在');
  requireModerator(p);
  const db = sqlite();
  const table = TABLES[kind];
  if (action !== 'dismiss') {
    const [from, to] = action === 'hide' ? [SHOWN, MODERATED] : [MODERATED, SHOWN];
    db.prepare(`UPDATE ${table} SET hidden=? WHERE id=? AND hidden=?`).run(to, targetId, from);
  }
  const row = db.prepare(`SELECT hidden FROM ${table} WHERE id=?`).get(targetId) as { hidden: number } | undefined;
  if (!row) throw new HttpError(404, kind === 'post' ? '题解不存在' : kind === 'comment' ? '评论不存在' : '消息不存在');
  db.prepare('UPDATE post_reports SET reason=? WHERE target=?').run(REPORT_CLEARED, `${kind}:${targetId}`);
  auditStatement(p, `${kind}.${action}`, targetId).run();
  return json({ id: targetId, hidden: row.hidden });
}

type QueueItem = {
  kind: Kind;
  id: string;
  postId: string;
  problemId: string;
  title: string;
  excerpt: string;
  author: string;
  hidden: number;
  createdAt: number;
  reports?: number;
  reasons?: string;
};
const ITEM_POST = `SELECT 'post' AS kind,sp.id,sp.id AS postId,sp.problem_id AS problemId,sp.title,
  substr(sp.body,1,600) AS excerpt,COALESCE(u.name,'') AS author,sp.hidden,sp.created_at AS createdAt`;
const ITEM_COMMENT = `SELECT 'comment' AS kind,c.id,c.post_id AS postId,sp.problem_id AS problemId,sp.title,
  substr(c.body,1,600) AS excerpt,COALESCE(u.name,'') AS author,c.hidden,c.created_at AS createdAt`;
const REPORTS = `WITH r AS (SELECT target,COUNT(*) AS reports,group_concat(DISTINCT reason) AS reasons,
  MAX(created_at) AS lastAt FROM post_reports WHERE reason<>'${REPORT_CLEARED}' GROUP BY target)`;

/** The teacher view's queue: reported posts and comments first, then the latest ones. */
async function moderationQueue(p: Person) {
  requireModerator(p);
  const db = sqlite();
  const reported = [
    ...(db
      .prepare(
        `${REPORTS} ${ITEM_POST},r.reports,r.reasons,r.lastAt FROM r JOIN solution_posts sp ON sp.id=substr(r.target,6)
        LEFT JOIN "user" u ON u.id=sp.user_id WHERE r.target LIKE 'post:%'`,
      )
      .all() as (QueueItem & { lastAt: number })[]),
    ...(db
      .prepare(
        `${REPORTS} ${ITEM_COMMENT},r.reports,r.reasons,r.lastAt FROM r JOIN post_comments c ON c.id=substr(r.target,9)
        JOIN solution_posts sp ON sp.id=c.post_id LEFT JOIN "user" u ON u.id=c.user_id WHERE r.target LIKE 'comment:%'`,
      )
      .all() as (QueueItem & { lastAt: number })[]),
    // Reported chat: only what was reported, never the latest.
    ...(db
      .prepare(
        `${REPORTS} SELECT 'gmsg' AS kind,g.id,g.group_id AS postId,'' AS problemId,COALESCE(sg.name,'') AS title,
          substr(g.body,1,600) AS excerpt,COALESCE(u.name,'') AS author,g.hidden,g.created_at AS createdAt,
          r.reports,r.reasons,r.lastAt FROM r JOIN study_group_messages g ON g.id=substr(r.target,6)
        LEFT JOIN study_groups sg ON sg.id=g.group_id LEFT JOIN "user" u ON u.id=g.user_id WHERE r.target LIKE 'gmsg:%'`,
      )
      .all() as (QueueItem & { lastAt: number })[]),
  ]
    .sort((a, b) => b.reports! - a.reports! || b.lastAt - a.lastAt)
    .slice(0, 100);
  const latest = [
    ...(db
      .prepare(`${ITEM_POST} ${FROM_POST} WHERE sp.hidden<>${REMOVED} ORDER BY sp.created_at DESC LIMIT 30`)
      .all() as QueueItem[]),
    ...(db
      .prepare(
        `${ITEM_COMMENT} FROM post_comments c JOIN solution_posts sp ON sp.id=c.post_id
        LEFT JOIN "user" u ON u.id=c.user_id WHERE c.hidden<>${REMOVED} ORDER BY c.created_at DESC LIMIT 30`,
      )
      .all() as QueueItem[]),
  ].sort((a, b) => b.createdAt - a.createdAt);
  // A hidden company's problems stay out of the queue like everywhere else, and so do the
  // problems of a contest running for this moderator.
  const seen = new Map<string, boolean>();
  const running = runningContestProblems(p.id);
  const shown = async (item: QueueItem) => {
    // Chat hangs off no problem or page.
    if (!item.problemId) return true;
    if (!seen.has(item.problemId))
      seen.set(item.problemId, !running.has(item.problemId) && (await visibleTarget(p, item.problemId)));
    return seen.get(item.problemId)!;
  };
  const keep = async (items: QueueItem[]) => {
    const out: QueueItem[] = [];
    for (const item of items) if (await shown(item)) out.push(item);
    return out;
  };
  return { reported: await keep(reported), latest: await keep(latest) };
}

/**
 * /api/oj/posts/… and /api/oj/post-comments/<id>/<action>. Threads, answers and comments read
 * signed out; solutions, the moderation queue and every write need an account.
 * /api/oj/group-messages/<id>/<action> are the moderators' actions on reported chat.
 */
export async function handleSolutionPosts(request: Request, p: Person | null, path: string[]) {
  const [resource, target, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '题解接口不存在');
  const db = sqlite();
  if (request.method === 'GET') {
    await limitReader(request, p, 'posts-read', 120);
    if (resource === 'posts' && !target) {
      const params = new URL(request.url).searchParams;
      if (params.get('starred') === '1') {
        requirePerson(p);
        return json(await starredPosts(p, params));
      }
      if (targetKind(params.get('problem') ?? '') === 'problem') requirePerson(p);
      return json(await listPosts(p, params));
    }
    if (resource === 'posts' && target === 'moderation' && !action) {
      requirePerson(p);
      return json(await moderationQueue(p));
    }
    if (resource === 'posts' && idOk(target) && !action) return json(await readPost(p, target));
    throw new HttpError(404, '题解接口不存在');
  }
  requirePerson(p);
  if (request.method !== 'POST') throw new HttpError(404, '题解接口不存在');
  requireVerified(p);
  await limit(p, 'post-write', 30);
  const now = Date.now();
  if (resource === 'posts' && !target) {
    const d = postInput
      .extend({ problemId: z.string().max(320), anonymous: z.boolean().default(false) })
      .parse(await readJson(request, 90000));
    if (!(await visibleTarget(p, d.problemId))) throw new HttpError(404, '题目不存在或尚未发布');
    refuseDuringContest(p, d.problemId);
    if (!validTag(d.problemId, d.tag)) throw new HttpError(400, '标签无效');
    if (d.anonymous && !anonymousAllowed(d.problemId)) throw new HttpError(400, '这里不能匿名发帖');
    const title = titleOf(d.problemId, d);
    // An anonymous report's author posts under it anonymously, ticked or not (as their comments read).
    const anonymous = d.anonymous || anonymousReporter(d.problemId) === p.id ? 1 : 0;
    underCap('solution_posts', p, POSTS_PER_DAY, '今天发布的帖子已达上限');
    const postId = randomUUID();
    db.transaction(() => {
      db.prepare(
        `INSERT INTO solution_posts(id,problem_id,user_id,title,body,language,tag,hidden,anonymous,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,${SHOWN},?,?,?)`,
      ).run(postId, d.problemId, p.id, title, d.body, d.language, d.tag, anonymous, now, now);
      savePoll(postId, d.problemId, d.poll, now);
    })();
    const post = { id: postId, problemId: d.problemId, userId: p.id, title, anonymous, down: 0 };
    notifyWrite(p, post, [], `${title}\n${d.body}`, now);
    return json(await readPost(p, postId), 201);
  }
  if (!idOk(target) || !action) throw new HttpError(404, '题解接口不存在');
  if (resource === 'posts') {
    if (action === 'edit') {
      const d = postInput.parse(await readJson(request, 90000));
      const own = db
        .prepare(`SELECT problem_id AS problemId FROM solution_posts WHERE id=? AND user_id=? AND hidden<>${REMOVED}`)
        .get(target, p.id) as { problemId: string } | undefined;
      if (!own) throw new HttpError(404, '题解不存在');
      refuseDuringContest(p, own.problemId);
      if (!validTag(own.problemId, d.tag)) throw new HttpError(400, '标签无效');
      const title = titleOf(own.problemId, d);
      db.transaction(() => {
        db.prepare(
          `UPDATE solution_posts SET title=?,body=?,language=?,tag=?,updated_at=? WHERE id=? AND user_id=? AND hidden<>${REMOVED}`,
        ).run(title, d.body, d.language, d.tag, now, target, p.id);
        savePoll(target, own.problemId, d.poll, now);
      })();
      return json(await readPost(p, target));
    }
    if (action === 'delete') {
      const { changes } = db
        .prepare(`UPDATE solution_posts SET hidden=${REMOVED},updated_at=? WHERE id=? AND user_id=?`)
        .run(now, target, p.id);
      if (!changes) throw new HttpError(404, '题解不存在');
      return json({ ok: true });
    }
    if (action === 'vote') {
      const { on } = z.object({ on: z.boolean() }).strict().parse(await readJson(request, 200));
      const post = await openPost(p, target);
      if (post.userId === p.id) throw new HttpError(400, '不能给自己的题解投票');
      if (on) {
        const { changes } = db
          .prepare('INSERT INTO post_votes(post_id,user_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING')
          .run(target, p.id, now);
        // Once per voter and post, ever: un-voting and voting again pays nothing more.
        if (changes) {
          awardUpvote(post.userId, p, target, now);
          // One notice per post and (UTC) day, counting that day's voters.
          const day = new Date(now).toISOString().slice(0, 10);
          const voters = db
            .prepare('SELECT COUNT(*) FROM post_votes WHERE post_id=? AND created_at>=?')
            .pluck()
            .get(target, Date.parse(day)) as number;
          const notice = `like:${target}:${day}`;
          // Only a new high for the day raises it again, so un-voting and voting again never re-marks
          // it unread. ponytail: the count is read back from the title (`N 人…`), no extra column.
          const shown = db.prepare('SELECT title FROM notifications WHERE id=?').pluck().get(notice) as string | undefined;
          if (voters > (Number.parseInt(shown ?? '') || 0))
            notify({
              id: notice,
              userId: post.userId,
              kind: 'like',
              title: `${voters} 人赞了你的帖子`,
              body: post.title,
              href: postHref(post.problemId, target),
              now,
            });
        }
      } else db.prepare('DELETE FROM post_votes WHERE post_id=? AND user_id=?').run(target, p.id);
      const { votes } = db.prepare('SELECT COUNT(*) AS votes FROM post_votes WHERE post_id=?').get(target) as {
        votes: number;
      };
      return json({ votes, voted: on });
    }
    if (action === 'comments') {
      const { body, parentId } = commentInput.parse(await readJson(request, 5000));
      const post = await openPost(p, target);
      // A reply goes under a shown comment of the same post and notifies its author; one to a reply
      // goes under that reply's own top-level comment (one level, never deeper), even where that
      // comment is gone and the reply stands on its own.
      const parent = parentId
        ? (db
            .prepare(
              `SELECT user_id AS userId,parent_id AS parentId FROM post_comments WHERE id=? AND post_id=? AND hidden=${SHOWN}`,
            )
            .get(parentId, target) as { userId: string; parentId: string | null } | undefined)
        : undefined;
      if (parentId && !parent) throw new HttpError(404, '评论不存在');
      underCap('post_comments', p, COMMENTS_PER_DAY, '今天的评论已达上限');
      db.prepare(
        `INSERT INTO post_comments(id,post_id,user_id,parent_id,body,hidden,created_at) VALUES(?,?,?,?,?,${SHOWN},?)`,
      ).run(randomUUID(), target, p.id, parent?.parentId ?? parentId ?? null, body, now);
      notifyWrite(
        p,
        post,
        [
          ...(parent ? [{ userId: parent.userId, title: '有人回复了你的评论' }] : []),
          { userId: post.userId, title: '有人回复了你的帖子' },
        ],
        body,
        now,
      );
      return json(await readPost(p, target), 201);
    }
    if (action === 'pin' || action === 'unpin') {
      requireModerator(p);
      await limit(p, 'post-pin-write', 30);
      const { changes } = db
        .prepare(`UPDATE solution_posts SET pinned=? WHERE id=? AND hidden<>${REMOVED}`)
        .run(action === 'pin' ? 1 : 0, target);
      if (!changes) throw new HttpError(404, '题解不存在');
      auditStatement(p, `post.${action}`, target).run();
      return json({ id: target, pinned: action === 'pin' });
    }
    if (action === 'poll') {
      const { choices } = z
        .object({ choices: z.array(z.number().int().min(0).max(5)).min(1).max(6) })
        .strict()
        .parse(await readJson(request, 200));
      await openPost(p, target);
      const poll = pollOf(target, p.id, now);
      if (!poll) throw new HttpError(404, '投票不存在');
      if (poll.closed) throw new HttpError(409, '投票已截止');
      const picks = [...new Set(choices)];
      if (picks.some((c) => c >= poll.options.length) || (!poll.multi && picks.length > 1))
        throw new HttpError(400, '投票选项无效');
      // One vote per verified account (every write checks that), never changed afterwards.
      db.transaction(() => {
        if (db.prepare('SELECT 1 FROM poll_votes WHERE post_id=? AND user_id=?').get(target, p.id))
          throw new HttpError(409, '你已经投过票了');
        const insert = db.prepare('INSERT INTO poll_votes(post_id,user_id,option,created_at) VALUES(?,?,?,?)');
        for (const c of picks) insert.run(target, p.id, c, now);
      })();
      return json({ poll: pollOf(target, p.id) });
    }
    if (action === 'report') return report(p, `post:${target}`, (await openPost(p, target)).userId, request);
    return moderate(p, 'post', target, action);
  }
  if (resource === 'post-comments') {
    if (action === 'vote') {
      await limit(p, 'comment-vote-write', 60);
      const { on } = z.object({ on: z.boolean() }).strict().parse(await readJson(request, 200));
      const row = db
        .prepare(
          `SELECT c.post_id AS postId,c.user_id AS userId FROM post_comments c WHERE c.id=? AND c.hidden=${SHOWN}
            AND NOT ${reportedDown("'comment:'||c.id")}`,
        )
        .get(target) as { postId: string; userId: string } | undefined;
      if (!row) throw new HttpError(404, '评论不存在');
      await openPost(p, row.postId);
      if (row.userId === p.id) throw new HttpError(400, '不能给自己的评论点赞');
      // Comment votes order replies and pay no points (so they cannot be farmed).
      if (on)
        db.prepare('INSERT INTO comment_votes(comment_id,user_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(
          target,
          p.id,
          now,
        );
      else db.prepare('DELETE FROM comment_votes WHERE comment_id=? AND user_id=?').run(target, p.id);
      const votes = db.prepare('SELECT COUNT(*) FROM comment_votes WHERE comment_id=?').pluck().get(target) as number;
      return json({ votes, voted: on });
    }
    if (action === 'delete') {
      const { changes } = db
        .prepare(`UPDATE post_comments SET hidden=${REMOVED} WHERE id=? AND user_id=?`)
        .run(target, p.id);
      if (!changes) throw new HttpError(404, '评论不存在');
      return json({ ok: true });
    }
    if (action === 'report') {
      const row = db
        .prepare(`SELECT post_id AS postId,user_id AS userId FROM post_comments WHERE id=? AND hidden=${SHOWN}`)
        .get(target) as { postId: string; userId: string } | undefined;
      if (!row) throw new HttpError(404, '评论不存在');
      await openPost(p, row.postId);
      return report(p, `comment:${target}`, row.userId, request);
    }
    return moderate(p, 'comment', target, action);
  }
  if (resource === 'group-messages') return moderate(p, 'gmsg', target, action);
  throw new HttpError(404, '题解接口不存在');
}
