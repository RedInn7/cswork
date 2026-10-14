import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { isCourseOwner } from './course-visibility';
import { auditStatement, HttpError, json, limit } from './http';
import { maskName } from './judge-feed';
import { publicProblem, requireVerified } from './learner-cloud';
import { readJson } from './my-practice';

/**
 * Community solutions per problem and their comments (db/solution-posts-schema.ts).
 * Signed in only. Every read re-checks that the problem is still visible (HIDDEN_COMPANIES,
 * course gates), every author write names its author in the WHERE clause, and authors
 * show by their public handle or a masked name (never the account name, which is often a
 * real one). Bodies are Markdown the client renders without raw HTML.
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
    title: text(120),
    body: text(20000),
    language: z.enum(['', 'python', 'cpp', 'java', 'go']).default(''),
  })
  .strict();
const commentInput = z.object({ body: text(1000) }).strict();
const reportInput = z.object({ reason: z.enum(['spam', 'offensive', 'wrong', 'other']) }).strict();

const POST = `SELECT sp.id,sp.problem_id AS problemId,sp.title,sp.language,sp.hidden,
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

export const canModerate = (p: Person) => p.role === 'teacher' || isCourseOwner(p);
function requireModerator(p: Person) {
  if (!canModerate(p)) throw new HttpError(403, '仅老师可以管理题解');
}
function underCap(table: 'solution_posts' | 'post_comments' | 'post_reports', p: Person, max: number, message: string) {
  const { n } = sqlite()
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=? AND created_at>?`)
    .get(p.id, Date.now() - DAY) as { n: number };
  if (n >= max) throw new HttpError(429, message);
}

/** A problem's posts, best or newest first, plus whether this learner has an AC on it. */
async function listPosts(p: Person, params: URLSearchParams) {
  const problem = params.get('problem') ?? '';
  if (!(await publicProblem(p, problem))) throw new HttpError(404, '题目不存在或尚未发布');
  const order = params.get('sort') === 'new' ? 'sp.created_at DESC' : 'votes DESC,sp.created_at DESC';
  const offset = Math.min(Math.max(0, Math.floor(Number(params.get('offset')) || 0)), 5000);
  const db = sqlite();
  // An author still sees their own moderated post (with a notice), nobody else does.
  const rows = db
    .prepare(
      `${POST},substr(sp.body,1,300) AS excerpt ${FROM_POST}
      WHERE sp.problem_id=@problem AND (sp.hidden=${SHOWN} OR (sp.hidden=${MODERATED} AND sp.user_id=@me))
      ORDER BY ${order},sp.id LIMIT ${PAGE + 1} OFFSET @offset`,
    )
    .all({ me: p.id, problem, offset }) as PostRow[];
  const solved = !!db
    .prepare(
      "SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND mode='judge' AND status='accepted' LIMIT 1",
    )
    .get(p.id, problem);
  return { solved, items: rows.slice(0, PAGE).map(shape), more: rows.length > PAGE };
}

/** One post with its comments; a hidden one reads as missing unless it is the author's moderated post. */
async function readPost(p: Person, postId: string) {
  const db = sqlite();
  const row = db.prepare(`${POST},sp.body ${FROM_POST} WHERE sp.id=@id`).get({ me: p.id, id: postId }) as
    | PostRow
    | undefined;
  const visible =
    row &&
    (row.hidden === SHOWN || (row.hidden === MODERATED && row.mine) || canModerate(p)) &&
    (await publicProblem(p, row.problemId));
  if (!row || !visible) throw new HttpError(404, '题解不存在');
  const comments = (
    db
      .prepare(
        `SELECT c.id,c.body,c.created_at AS createdAt,COALESCE(u.name,'') AS author,pr.handle,c.user_id=@me AS mine
        FROM post_comments c LEFT JOIN "user" u ON u.id=c.user_id ${PROFILE('c.user_id')}
        WHERE c.post_id=@id AND c.hidden=${SHOWN} ORDER BY c.created_at,c.id LIMIT 500`,
      )
      .all({ me: p.id, id: postId }) as { author: string; handle: string | null; mine: number }[]
  ).map(byline);
  return { post: shape(row), comments };
}

/** A shown post on a visible problem, for votes, comments and reports. */
async function openPost(p: Person, postId: string) {
  const row = sqlite()
    .prepare(`SELECT problem_id AS problemId,user_id AS userId FROM solution_posts WHERE id=? AND hidden=${SHOWN}`)
    .get(postId) as { problemId: string; userId: string } | undefined;
  if (!row || !(await publicProblem(p, row.problemId))) throw new HttpError(404, '题解不存在');
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
    if (!seen.has(item.problemId)) seen.set(item.problemId, await publicProblem(p, item.problemId));
    return seen.get(item.problemId)!;
  };
  const keep = async (items: QueueItem[]) => {
    const out: QueueItem[] = [];
    for (const item of items) if (await shown(item)) out.push(item);
    return out;
  };
  return { reported: await keep(reported), latest: await keep(latest) };
}

/** /api/oj/posts/… and /api/oj/post-comments/<id>/<action>; the caller has checked sign-in. */
export async function handleSolutionPosts(request: Request, p: Person, path: string[]) {
  const [resource, target, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '题解接口不存在');
  const db = sqlite();
  if (request.method === 'GET') {
    await limit(p, 'posts-read', 120);
    if (resource === 'posts' && !target) return json(await listPosts(p, new URL(request.url).searchParams));
    if (resource === 'posts' && target === 'moderation' && !action) return json(await moderationQueue(p));
    if (resource === 'posts' && id.safeParse(target).success && !action) return json(await readPost(p, target));
    throw new HttpError(404, '题解接口不存在');
  }
  if (request.method !== 'POST') throw new HttpError(404, '题解接口不存在');
  requireVerified(p);
  await limit(p, 'post-write', 30);
  const now = Date.now();
  if (resource === 'posts' && !target) {
    const d = postInput.extend({ problemId: z.string() }).parse(await readJson(request, 90000));
    if (!(await publicProblem(p, d.problemId))) throw new HttpError(404, '题目不存在或尚未发布');
    underCap('solution_posts', p, POSTS_PER_DAY, '今天发布的题解已达上限');
    const postId = randomUUID();
    db.prepare(
      `INSERT INTO solution_posts(id,problem_id,user_id,title,body,language,hidden,created_at,updated_at)
      VALUES(?,?,?,?,?,?,${SHOWN},?,?)`,
    ).run(postId, d.problemId, p.id, d.title, d.body, d.language, now, now);
    return json(await readPost(p, postId), 201);
  }
  if (!id.safeParse(target).success || !action) throw new HttpError(404, '题解接口不存在');
  if (resource === 'posts') {
    if (action === 'edit') {
      const d = postInput.parse(await readJson(request, 90000));
      const { changes } = db
        .prepare(
          `UPDATE solution_posts SET title=?,body=?,language=?,updated_at=? WHERE id=? AND user_id=? AND hidden<>${REMOVED}`,
        )
        .run(d.title, d.body, d.language, now, target, p.id);
      if (!changes) throw new HttpError(404, '题解不存在');
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
