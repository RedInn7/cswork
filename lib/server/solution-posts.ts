import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { autoTitle, isChannel, REPORTS_HIDE, targetKind } from '@/lib/community';
import { STOP_NAMES } from '@/lib/route-stops';
import type { Person } from './auth';
import { library } from './content-library';
import { isCourseOwner } from './course-visibility';
import { hiddenCompanies } from './env';
import { memberIdOf, readMember } from './experience-submissions';
import { auditStatement, HttpError, json, limit, limitReader, requirePerson } from './http';
import { maskName } from './judge-feed';
import { publicProblem, reportCompanies, requireVerified } from './learner-cloud';
import { readJson } from './my-practice';

/**
 * Community posts and their comments (db/solution-posts-schema.ts). A post's problem_id is its
 * target (lib/community.ts): a judge problem's solutions (signed in), a discussion channel's
 * threads, comments under an experience or answers to an interview question (those three read
 * signed out). Every read re-checks that the target is still visible (HIDDEN_COMPANIES, course
 * gates, the library), every author write names its author in the WHERE clause, and authors
 * show by their public handle or a masked name (never the account name, which is often a real
 * one). Bodies are Markdown the client renders without raw HTML.
 */
const DAY = 86400000;
const PAGE = 30;
const POSTS_PER_DAY = 10;
const COMMENTS_PER_DAY = 100;
const REPORTS_PER_DAY = 30;
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
  })
  .strict();
const commentInput = z.object({ body: text(1000) }).strict();
const reportInput = z.object({ reason: z.enum(['spam', 'offensive', 'wrong', 'other']) }).strict();

const POST = `SELECT sp.id,sp.problem_id AS problemId,sp.title,sp.language,sp.tag,sp.hidden,
  sp.created_at AS createdAt,sp.updated_at AS updatedAt,COALESCE(u.name,'') AS author,pr.handle,
  sp.user_id=@me AS mine,
  (SELECT COUNT(*) FROM post_votes v WHERE v.post_id=sp.id) AS votes,
  EXISTS(SELECT 1 FROM post_votes v WHERE v.post_id=sp.id AND v.user_id=@me) AS voted,
  (SELECT COUNT(*) FROM post_comments c WHERE c.post_id=sp.id AND c.hidden=0) AS comments`;
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
  body?: string;
  excerpt?: string;
};
/** Your own name to you; to everyone else the public handle if you chose one, else a masked name. */
const byline = <T extends { author: string; handle: string | null; mine: number }>(row: T) => {
  const { handle, ...rest } = row;
  return Object.assign(rest, {
    author: row.mine ? row.author : handle || (row.author ? maskName(row.author) : ''),
    mine: !!row.mine,
  });
};
const shape = (r: PostRow) => Object.assign(byline(r), { voted: !!r.voted });

export const canModerate = (p: Person | null) => !!p && (p.role === 'teacher' || isCourseOwner(p));
const reportedDown = (target: string) =>
  `(SELECT COUNT(*) FROM post_reports r WHERE r.target=${target})>=${REPORTS_HIDE}`;
/** Posts tagged with a hidden company stay out like the company's own pages. */
const hiddenTags = () => {
  const slugs = [...hiddenCompanies()].filter((s) => /^[a-z0-9-]+$/.test(s));
  return slugs.length ? ` AND sp.tag NOT IN (${slugs.map((s) => `'${s}'`).join(',')})` : '';
};
const ITEM = /^[\w-]{1,300}$/;
/**
 * Whether a target is open to posts: a published problem the reader may see, a known channel,
 * or an experience or interview question the library (or an approved member post) still shows.
 */
export async function visibleTarget(p: Person | null, target: string) {
  const kind = targetKind(target);
  if (kind === 'problem') return !!p && (await publicProblem(p, target));
  const key = target.slice(target.indexOf(':') + 1);
  if (kind === 'discuss') return isChannel(key);
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
  const title = d.title || (kind === 'exp' || kind === 'q' ? autoTitle(d.body) : '');
  if (!title) throw new HttpError(400, '请填写标题');
  return title;
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

/**
 * A target's posts, best or newest first, optionally one tag's, plus whether this learner has an
 * AC on it (posts on anything but a problem are never locked). `discuss:all` lists every channel.
 * `excerpt` is the opening; `body: true` sends whole bodies (answers and comments show inline).
 */
async function listPosts(p: Person | null, params: URLSearchParams) {
  const problem = params.get('problem') ?? '';
  const all = problem === 'discuss:all';
  if (!all && !(await visibleTarget(p, problem))) throw new HttpError(404, '题目不存在或尚未发布');
  const order = params.get('sort') === 'new' ? 'sp.created_at DESC' : 'votes DESC,sp.created_at DESC';
  const offset = Math.min(Math.max(0, Math.floor(Number(params.get('offset')) || 0)), 5000);
  const tag = (params.get('tag') ?? '').slice(0, 80);
  const me = p?.id ?? '';
  const db = sqlite();
  // An author still sees their own moderated or reported-down post (with a notice), nobody else does.
  const rows = db
    .prepare(
      `${POST},${params.get('body') === '1' ? 'sp.body' : 'substr(sp.body,1,300) AS excerpt'} ${FROM_POST}
      WHERE ${all ? "sp.problem_id LIKE 'discuss:%'" : 'sp.problem_id=@problem'} ${tag ? 'AND sp.tag=@tag' : ''}
        AND (sp.user_id=@me OR (sp.hidden=${SHOWN} AND NOT ${reportedDown("'post:'||sp.id")}))
        AND sp.hidden<>${REMOVED}${hiddenTags()}
      ORDER BY ${order},sp.id LIMIT ${PAGE + 1} OFFSET @offset`,
    )
    .all({ me, problem, tag, offset }) as PostRow[];
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
 * One post with its comments; a hidden or reported-down one reads as missing unless it is the
 * author's own (not removed) or a moderator asks.
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
  const comments = (
    db
      .prepare(
        `SELECT c.id,c.body,c.created_at AS createdAt,COALESCE(u.name,'') AS author,pr.handle,c.user_id=@me AS mine
        FROM post_comments c LEFT JOIN "user" u ON u.id=c.user_id ${PROFILE('c.user_id')}
        WHERE c.post_id=@id AND c.hidden=${SHOWN} AND (c.user_id=@me OR NOT ${reportedDown("'comment:'||c.id")})
        ORDER BY c.created_at,c.id LIMIT 500`,
      )
      .all({ me, id: postId }) as { author: string; handle: string | null; mine: number }[]
  ).map(byline);
  return { post: shape(row), comments };
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

/** A shown post on a visible target, for votes, comments and reports. */
async function openPost(p: Person, postId: string) {
  const row = sqlite()
    .prepare(`SELECT problem_id AS problemId,user_id AS userId FROM solution_posts WHERE id=? AND hidden=${SHOWN}`)
    .get(postId) as { problemId: string; userId: string } | undefined;
  if (!row || !(await visibleTarget(p, row.problemId))) throw new HttpError(404, '题解不存在');
  return row;
}

async function report(p: Person, target: string, authorId: string, request: Request) {
  if (authorId === p.id) throw new HttpError(400, '不能举报自己的内容');
  const { reason } = reportInput.parse(await readJson(request, 500));
  underCap('post_reports', p, REPORTS_PER_DAY, '今天的举报次数已达上限');
  sqlite()
    .prepare('INSERT INTO post_reports(target,user_id,reason,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING')
    .run(target, p.id, reason, Date.now());
  return json({ reported: true });
}

/** hide / unhide flips between shown and moderated (an author's removal stays); any action clears the reports. */
function moderate(p: Person, kind: 'post' | 'comment', targetId: string, action: string) {
  if (!['hide', 'unhide', 'dismiss'].includes(action)) throw new HttpError(404, '题解接口不存在');
  requireModerator(p);
  const db = sqlite();
  const table = kind === 'post' ? 'solution_posts' : 'post_comments';
  if (action !== 'dismiss') {
    const [from, to] = action === 'hide' ? [SHOWN, MODERATED] : [MODERATED, SHOWN];
    db.prepare(`UPDATE ${table} SET hidden=? WHERE id=? AND hidden=?`).run(to, targetId, from);
  }
  const row = db.prepare(`SELECT hidden FROM ${table} WHERE id=?`).get(targetId) as { hidden: number } | undefined;
  if (!row) throw new HttpError(404, kind === 'post' ? '题解不存在' : '评论不存在');
  db.prepare('DELETE FROM post_reports WHERE target=?').run(`${kind}:${targetId}`);
  auditStatement(p, `${kind}.${action}`, targetId).run();
  return json({ id: targetId, hidden: row.hidden });
}

type QueueItem = {
  kind: 'post' | 'comment';
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
  MAX(created_at) AS lastAt FROM post_reports GROUP BY target)`;

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
  // A hidden company's problems stay out of the queue like everywhere else.
  const seen = new Map<string, boolean>();
  const shown = async (item: QueueItem) => {
    if (!seen.has(item.problemId)) seen.set(item.problemId, await visibleTarget(p, item.problemId));
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
 */
export async function handleSolutionPosts(request: Request, p: Person | null, path: string[]) {
  const [resource, target, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '题解接口不存在');
  const db = sqlite();
  if (request.method === 'GET') {
    await limitReader(request, p, 'posts-read', 120);
    if (resource === 'posts' && !target) {
      const params = new URL(request.url).searchParams;
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
    const d = postInput.extend({ problemId: z.string().max(320) }).parse(await readJson(request, 90000));
    if (!(await visibleTarget(p, d.problemId))) throw new HttpError(404, '题目不存在或尚未发布');
    if (!validTag(d.problemId, d.tag)) throw new HttpError(400, '标签无效');
    const title = titleOf(d.problemId, d);
    underCap('solution_posts', p, POSTS_PER_DAY, '今天发布的帖子已达上限');
    const postId = randomUUID();
    db.prepare(
      `INSERT INTO solution_posts(id,problem_id,user_id,title,body,language,tag,hidden,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,${SHOWN},?,?)`,
    ).run(postId, d.problemId, p.id, title, d.body, d.language, d.tag, now, now);
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
      if (!validTag(own.problemId, d.tag)) throw new HttpError(400, '标签无效');
      db.prepare(
        `UPDATE solution_posts SET title=?,body=?,language=?,tag=?,updated_at=? WHERE id=? AND user_id=? AND hidden<>${REMOVED}`,
      ).run(titleOf(own.problemId, d), d.body, d.language, d.tag, now, target, p.id);
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
      if (on)
        db.prepare('INSERT INTO post_votes(post_id,user_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(
          target,
          p.id,
          now,
        );
      else db.prepare('DELETE FROM post_votes WHERE post_id=? AND user_id=?').run(target, p.id);
      const { votes } = db.prepare('SELECT COUNT(*) AS votes FROM post_votes WHERE post_id=?').get(target) as {
        votes: number;
      };
      return json({ votes, voted: on });
    }
    if (action === 'comments') {
      const { body } = commentInput.parse(await readJson(request, 5000));
      await openPost(p, target);
      underCap('post_comments', p, COMMENTS_PER_DAY, '今天的评论已达上限');
      db.prepare(
        `INSERT INTO post_comments(id,post_id,user_id,body,hidden,created_at) VALUES(?,?,?,?,${SHOWN},?)`,
      ).run(randomUUID(), target, p.id, body, now);
      return json(await readPost(p, target), 201);
    }
    if (action === 'report') return report(p, `post:${target}`, (await openPost(p, target)).userId, request);
    return moderate(p, 'post', target, action);
  }
  if (resource === 'post-comments') {
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
  throw new HttpError(404, '题解接口不存在');
}
