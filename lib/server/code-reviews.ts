import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { refuseInContest } from './contests';
import { HttpError, json, limit, limitReader } from './http';
import { ownerHandle, publicProblem, requireVerified } from './learner-cloud';
import { readJson } from './my-practice';
import { notify } from './notify';
import { submissionRow } from './oj-submissions';

/**
 * Private code review links (db/code-reviews-schema.ts, /review/<token>): the author of a formal
 * submission hands out a link, and any signed-in reader holding it comments on single lines.
 * Only the token's sha256 is stored, so the link is shown once; the author reaches the review by
 * its id (/review/<id>) from the submission dialog or a notice. Nobody's name or email is shown:
 * a public handle, else "author" / "reviewer N" (the client words them). The problem's own gates
 * hold for every reader: a running contest or exam (refuseInContest) and the solution posts'
 * visibility (publicProblem: no course exercise, no hidden company).
 *
 *   POST reviews {submissionId, note}      → {id, token}
 *   GET  reviews[?submission=<id>]         → the author's open links (on that submission)
 *   GET  reviews/<token|id>                → the code, the note and the comments
 *   POST reviews/<token|id>/comments       → {line, body}
 *   POST reviews/<token|id>/close          → author only; the link answers 404 from then on
 */
export const OPEN_MAX = 20;
// ponytail: closed links stay (closed_at); a daily cap keeps a create-and-close loop from growing the table forever.
export const MADE_PER_DAY = 50;
const DAY = 86_400_000;
export const COMMENT_MAX = 2000;
const NOTE_MAX = 500;
// ponytail: a cap per link keeps GET bounded; nobody writes 300 line comments on one solution.
const COMMENTS_PER_REVIEW = 300;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GONE = '评审链接不存在或已关闭';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const lineCount = (code: string) => code.split('\n').length;

type Review = { id: string; owner_id: string; submission_id: string; note: string; created_at: number };

/** An open review by its token (anyone signed in) or its id (the author only); else 404. */
function openReview(p: Person, key: string) {
  const byId = ID.test(key);
  if (!byId && !TOKEN.test(key)) throw new HttpError(404, GONE);
  const row = sqlite()
    .prepare(
      `SELECT id,owner_id,submission_id,note,created_at FROM code_reviews WHERE ${byId ? 'id' : 'token_hash'}=? AND closed_at IS NULL`,
    )
    .get(byId ? key : hashToken(key)) as Review | undefined;
  if (!row || (byId && row.owner_id !== p.id)) throw new HttpError(404, GONE);
  return row;
}
/** The submission behind a review, behind the problem's gates for this reader. */
async function gated(p: Person, review: Review) {
  const sub = submissionRow(review.submission_id);
  if (!sub) throw new HttpError(404, GONE);
  refuseInContest(p, sub.problem_id);
  if (!(await publicProblem(p, sub.problem_id))) throw new HttpError(404, '题目不存在或尚未发布');
  return sub;
}
function titleOf(problemId: string) {
  const row = sqlite()
    .prepare(
      `SELECT json_extract(v.spec_json,'$.title') AS title,json_extract(v.spec_json,'$.translations.en.title') AS titleEn
      FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id WHERE p.id=?`,
    )
    .get(problemId) as { title: string | null; titleEn: string | null } | undefined;
  return { id: problemId, title: row?.title || problemId, titleEn: row?.titleEn || null };
}

const created = z
  .object({ submissionId: z.string().min(1).max(100), note: z.string().trim().max(NOTE_MAX).default('') })
  .strict();
const comment = z.object({ line: z.number().int().min(1), body: z.string().trim().min(1).max(COMMENT_MAX) }).strict();

export async function handleCodeReviews(request: Request, p: Person, path: string[]): Promise<Response> {
  const [key, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  const db = sqlite();
  const now = Date.now();
  if (request.method === 'GET') {
    await limitReader(request, p, 'code-reviews-read', 120);
    if (action) throw new HttpError(404, '接口不存在');
    if (!key) {
      // Without a submission: every open link, so a full author can find the ones to close.
      const submission = new URL(request.url).searchParams.get('submission');
      const items = db
        .prepare(
          `SELECT r.id,r.note,r.created_at AS createdAt,r.submission_id AS submissionId,s.problem_id AS problemId,
            (SELECT COUNT(*) FROM code_review_comments c WHERE c.review_id=r.id) AS comments
          FROM code_reviews r LEFT JOIN submissions s ON s.id=r.submission_id
          WHERE r.owner_id=? AND r.closed_at IS NULL${submission === null ? '' : ' AND r.submission_id=?'} ORDER BY r.created_at DESC`,
        )
        .all(p.id, ...(submission === null ? [] : [submission]));
      return json({ items, max: OPEN_MAX });
    }
    const review = openReview(p, key);
    const sub = await gated(p, review);
    const rows = db
      .prepare('SELECT id,user_id,line,body,created_at FROM code_review_comments WHERE review_id=? ORDER BY created_at,rowid')
      .all(review.id) as { id: string; user_id: string; line: number; body: string; created_at: number }[];
    // Reviewers are numbered by their first comment on this link; 0 is the author.
    const numbers = new Map([[review.owner_id, 0]]);
    for (const r of rows) if (!numbers.has(r.user_id)) numbers.set(r.user_id, numbers.size);
    const handles = new Map([...numbers.keys()].map((id) => [id, ownerHandle(id)]));
    const mine = review.owner_id === p.id;
    return json({
      id: mine ? review.id : null,
      mine,
      problem: titleOf(sub.problem_id),
      language: sub.language,
      code: sub.code,
      status: sub.status,
      note: review.note,
      author: handles.get(review.owner_id),
      createdAt: review.created_at,
      comments: rows.map((r) => ({
        id: r.id,
        line: r.line,
        body: r.body,
        createdAt: r.created_at,
        reviewer: numbers.get(r.user_id)!,
        handle: handles.get(r.user_id),
        mine: r.user_id === p.id,
      })),
    });
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  if (!key) {
    await limit(p, 'code-reviews-write', 20);
    const d = created.parse(await readJson(request, 4000));
    const sub = submissionRow(d.submissionId);
    // Someone else's submission answers like a missing one.
    if (!sub || sub.user_id !== p.id) throw new HttpError(404, '提交不存在');
    if (sub.mode !== 'judge') throw new HttpError(400, '只能为正式提交生成评审链接');
    refuseInContest(p, sub.problem_id);
    if (!(await publicProblem(p, sub.problem_id))) throw new HttpError(404, '题目不存在或尚未发布');
    const id = randomUUID();
    const token = randomBytes(24).toString('base64url');
    // Count and insert together: two tabs cannot both take the last place.
    db.transaction(() => {
      const { open, made } = db
        .prepare(
          `SELECT COUNT(*) FILTER (WHERE closed_at IS NULL) AS open,COUNT(*) FILTER (WHERE created_at>?) AS made
          FROM code_reviews WHERE owner_id=?`,
        )
        .get(now - DAY, p.id) as { open: number; made: number };
      if (open >= OPEN_MAX) throw new HttpError(409, '未关闭的评审链接已达上限，请先关闭不用的链接');
      if (made >= MADE_PER_DAY) throw new HttpError(429, '今天生成的评审链接已达上限，请明天再试');
      db.prepare(
        'INSERT INTO code_reviews(id,owner_id,submission_id,token_hash,note,created_at) VALUES(?,?,?,?,?,?)',
      ).run(id, p.id, sub.id, hashToken(token), d.note, now);
    }).immediate();
    // The token leaves the server this once; only its hash stays.
    return json({ id, token });
  }
  if (action === 'close') {
    await limit(p, 'code-reviews-write', 20);
    const review = openReview(p, key);
    if (review.owner_id !== p.id) throw new HttpError(404, GONE);
    db.prepare('UPDATE code_reviews SET closed_at=? WHERE id=?').run(now, review.id);
    return json({ ok: true });
  }
  if (action !== 'comments') throw new HttpError(404, '接口不存在');
  await limit(p, 'code-review-comments-write', 30, 3600);
  requireVerified(p);
  const review = openReview(p, key);
  const sub = await gated(p, review);
  const d = comment.parse(await readJson(request, 12000));
  if (d.line > lineCount(sub.code)) throw new HttpError(400, '行号超出代码范围');
  const count = db.prepare('SELECT COUNT(*) FROM code_review_comments WHERE review_id=?').pluck().get(review.id) as number;
  if (count >= COMMENTS_PER_REVIEW) throw new HttpError(409, '这条评审链接的评论已达上限');
  const id = randomUUID();
  db.prepare('INSERT INTO code_review_comments(id,review_id,user_id,line,body,created_at) VALUES(?,?,?,?,?,?)').run(
    id,
    review.id,
    p.id,
    d.line,
    d.body,
    now,
  );
  // One in-app notice per link and (UTC) day, refreshed by later comments; never mail or push.
  if (review.owner_id !== p.id)
    notify({
      id: `code-review:${review.id}:${new Date(now).toISOString().slice(0, 10)}`,
      userId: review.owner_id,
      kind: 'code-review',
      title: '你的代码收到了新的评审意见',
      body: titleOf(sub.problem_id).title,
      href: `/review/${review.id}`,
      now,
    });
  return json({ id });
}
