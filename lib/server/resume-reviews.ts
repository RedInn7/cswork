import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { lineAt, lines, normalizeResume, type Resume } from '@/lib/resume-shape';
import type { Person } from './auth';
import { GONE, hashToken, ID, TOKEN } from './code-reviews';
import { HttpError, json, limit, limitReader } from './http';
import { ownerHandle, requireVerified } from './learner-cloud';
import { readJson } from './my-practice';
import { notify } from './notify';

/**
 * Private resume review links (db/resume-reviews-schema.ts, /career/resume/review/<token>), shaped
 * like code reviews (lib/server/code-reviews.ts): the owner snapshots the resume being edited, minus
 * name and contact lines, and hands out a link; any signed-in reader holding it comments on single
 * lines and may suggest a rewrite, which the owner accepts back into the builder (in their browser:
 * the resume itself never lives on the server). Only the token's sha256 is stored; nobody's name or
 * email is shown, only public handles. No problem content, so no contest or exam gate. Closing a
 * link empties its snapshot; the comments stay.
 *
 *   POST resume-reviews {resume, version, note}      → {id, token}
 *   GET  resume-reviews                              → the owner's open links
 *   GET  resume-reviews/<token|id>                   → the snapshot, the note and the comments
 *   POST resume-reviews/<token|id>/comments          → {path, body, suggestion?}
 *   POST resume-reviews/<token|id>/accept            → {commentId}; owner only, marks a rewrite taken
 *   POST resume-reviews/<token|id>/close             → owner only; the link answers 404 from then on
 */
export const OPEN_MAX = 10;
export const MADE_PER_DAY = 20;
const DAY = 86_400_000;
const COMMENTS_PER_REVIEW = 300;

type Review = { id: string; owner_id: string; snapshot: string; version: string; note: string; created_at: number };

/** An open review by its token (anyone signed in) or its id (the owner only); else 404. */
function openReview(p: Person, key: string) {
  const byId = ID.test(key);
  if (!byId && !TOKEN.test(key)) throw new HttpError(404, GONE);
  const row = sqlite()
    .prepare(
      `SELECT id,owner_id,snapshot,version,note,created_at FROM resume_reviews WHERE ${byId ? 'id' : 'token_hash'}=? AND closed_at IS NULL`,
    )
    .get(byId ? key : hashToken(key)) as Review | undefined;
  if (!row || (byId && row.owner_id !== p.id)) throw new HttpError(404, GONE);
  return row;
}
const snapshotOf = (review: Review) => normalizeResume(JSON.parse(review.snapshot));
/** Every line a reviewer can comment on: entries' bullets, skills and awards. */
const lineCount = (r: Resume) =>
  [...r.education, ...r.experience, ...r.projects].reduce((n, item) => n + lines(item.bullets).length, lines(r.skills).length + lines(r.awards).length);

const created = z
  .object({
    resume: z.unknown(),
    version: z.string().max(40).default(''),
    note: z.string().trim().max(500).default(''),
  })
  .strict();
const comment = z
  .object({
    path: z.string().max(40),
    body: z.string().trim().min(1).max(2000),
    suggestion: z.string().trim().max(500).regex(/^[^\r\n]*$/).default(''),
  })
  .strict();
const accepted = z.object({ commentId: z.string().max(100) }).strict();

export async function handleResumeReviews(request: Request, p: Person, path: string[]): Promise<Response> {
  const [key, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  const db = sqlite();
  const now = Date.now();
  if (request.method === 'GET') {
    await limitReader(request, p, 'resume-reviews-read', 120);
    if (action) throw new HttpError(404, '接口不存在');
    if (!key) {
      const items = db
        .prepare(
          `SELECT r.id,r.note,r.version,r.created_at AS createdAt,
            (SELECT COUNT(*) FROM resume_review_comments c WHERE c.review_id=r.id) AS comments,
            (SELECT COUNT(*) FROM resume_review_comments c WHERE c.review_id=r.id AND c.suggestion<>'' AND c.accepted_at IS NULL) AS pending
          FROM resume_reviews r WHERE r.owner_id=? AND r.closed_at IS NULL ORDER BY r.created_at DESC`,
        )
        .all(p.id);
      return json({ items, max: OPEN_MAX });
    }
    const review = openReview(p, key);
    const rows = db
      .prepare(
        'SELECT id,user_id,path,original,body,suggestion,accepted_at,created_at FROM resume_review_comments WHERE review_id=? ORDER BY created_at,rowid',
      )
      .all(review.id) as {
      id: string;
      user_id: string;
      path: string;
      original: string;
      body: string;
      suggestion: string;
      accepted_at: number | null;
      created_at: number;
    }[];
    // Reviewers are numbered by their first comment on this link; 0 is the owner.
    const numbers = new Map([[review.owner_id, 0]]);
    for (const r of rows) if (!numbers.has(r.user_id)) numbers.set(r.user_id, numbers.size);
    const handles = new Map([...numbers.keys()].map((id) => [id, ownerHandle(id)]));
    const mine = review.owner_id === p.id;
    return json({
      id: mine ? review.id : null,
      mine,
      // Which named copy it came from matters only to the owner's write-back.
      version: mine ? review.version : null,
      snapshot: snapshotOf(review),
      note: review.note,
      author: handles.get(review.owner_id),
      createdAt: review.created_at,
      comments: rows.map((r) => ({
        id: r.id,
        path: r.path,
        original: r.original,
        body: r.body,
        suggestion: r.suggestion,
        acceptedAt: r.accepted_at,
        createdAt: r.created_at,
        reviewer: numbers.get(r.user_id)!,
        handle: handles.get(r.user_id),
        mine: r.user_id === p.id,
      })),
    });
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  if (!key) {
    await limit(p, 'resume-reviews-write', 20);
    const d = created.parse(await readJson(request, 40_000));
    // The snapshot keeps the resume's content, never who it is or how to reach them.
    const snapshot = { ...normalizeResume(d.resume), name: '', email: '', phone: '', location: '', links: '' };
    if (!lineCount(snapshot)) throw new HttpError(400, '简历里还没有可以批注的要点');
    const id = randomUUID();
    const token = randomBytes(24).toString('base64url');
    // Count and insert together: two tabs cannot both take the last place.
    db.transaction(() => {
      const { open, made } = db
        .prepare(
          `SELECT COUNT(*) FILTER (WHERE closed_at IS NULL) AS open,COUNT(*) FILTER (WHERE created_at>?) AS made
          FROM resume_reviews WHERE owner_id=?`,
        )
        .get(now - DAY, p.id) as { open: number; made: number };
      if (open >= OPEN_MAX) throw new HttpError(409, '未关闭的评审链接已达上限，请先关闭不用的链接');
      if (made >= MADE_PER_DAY) throw new HttpError(429, '今天生成的评审链接已达上限，请明天再试');
      db.prepare(
        'INSERT INTO resume_reviews(id,owner_id,token_hash,snapshot,version,note,created_at) VALUES(?,?,?,?,?,?,?)',
      ).run(id, p.id, hashToken(token), JSON.stringify(snapshot), d.version, d.note, now);
    }).immediate();
    // The token leaves the server this once; only its hash stays.
    return json({ id, token });
  }
  if (action === 'close' || action === 'accept') {
    await limit(p, 'resume-reviews-write', 20);
    const review = openReview(p, key);
    if (review.owner_id !== p.id) throw new HttpError(404, GONE);
    if (action === 'close') {
      db.prepare("UPDATE resume_reviews SET closed_at=?,snapshot='{}' WHERE id=?").run(now, review.id);
      return json({ ok: true });
    }
    const { commentId } = accepted.parse(await readJson(request, 1000));
    const row = db
      .prepare('SELECT suggestion,accepted_at FROM resume_review_comments WHERE id=? AND review_id=?')
      .get(commentId, review.id) as { suggestion: string; accepted_at: number | null } | undefined;
    if (!row) throw new HttpError(404, '批注不存在');
    if (!row.suggestion) throw new HttpError(400, '这条批注没有改写建议');
    const acceptedAt = row.accepted_at ?? now;
    db.prepare('UPDATE resume_review_comments SET accepted_at=? WHERE id=?').run(acceptedAt, commentId);
    return json({ ok: true, acceptedAt });
  }
  if (action !== 'comments') throw new HttpError(404, '接口不存在');
  await limit(p, 'resume-review-comments-write', 30, 3600);
  requireVerified(p);
  const review = openReview(p, key);
  const d = comment.parse(await readJson(request, 12_000));
  // The line is read from the snapshot here; a client's copy of it is never trusted.
  const original = lineAt(snapshotOf(review), d.path);
  if (original === null) throw new HttpError(400, '这条要点不在简历快照里');
  const count = db.prepare('SELECT COUNT(*) FROM resume_review_comments WHERE review_id=?').pluck().get(review.id) as number;
  if (count >= COMMENTS_PER_REVIEW) throw new HttpError(409, '这条评审链接的评论已达上限');
  const id = randomUUID();
  db.prepare(
    'INSERT INTO resume_review_comments(id,review_id,user_id,path,original,body,suggestion,created_at) VALUES(?,?,?,?,?,?,?,?)',
  ).run(id, review.id, p.id, d.path, original, d.body, d.suggestion, now);
  // One in-app notice per link and (UTC) day, refreshed by later comments; never mail or push.
  if (review.owner_id !== p.id)
    notify({
      id: `resume-review:${review.id}:${new Date(now).toISOString().slice(0, 10)}`,
      userId: review.owner_id,
      kind: 'resume-review',
      title: '你的简历收到了新的批注',
      body: review.note,
      href: `/career/resume/review/${review.id}`,
      now,
    });
  return json({ id });
}
