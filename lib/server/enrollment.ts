import { z } from 'zod';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { sqlite } from '@/db/sqlite';
import { auth, type Person } from './auth';
import { origin, setting } from './env';
import { body, HttpError, json, requireTeacher, limit } from './http';

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
type Invite = {
  id: string;
  email: string;
  name: string | null;
  course_ids: string;
  expires_at: number;
  redeemed_at: number | null;
  redeemed_by: string | null;
  revoked_at: number | null;
};
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
function inviteFor(token: string) {
  const invite = sqlite()
    .prepare('SELECT * FROM enrollment_invites WHERE token_hash=?')
    .get(digest(token)) as Invite | undefined;
  if (!invite || invite.revoked_at || invite.expires_at <= Date.now())
    throw new HttpError(410, '邀请已过期或被撤销，请联系老师重新生成');
  return invite;
}
function safeInvite(i: Invite) {
  return {
    id: i.id,
    email: i.email,
    name: i.name,
    courseIds: JSON.parse(i.course_ids),
    expiresAt: i.expires_at,
    redeemedAt: i.redeemed_at,
    revokedAt: i.revoked_at,
  };
}

export async function handleEnrollment(
  request: Request,
  p: Person | null,
  path: string[],
): Promise<Response | null> {
  const [resource, action, id] = path;
  const db = sqlite();
  if (resource === 'teacher' && action === 'invitations') {
    requireTeacher(p);
    if (request.method === 'GET') {
      const url = new URL(request.url),
        page = Math.max(
          0,
          Math.min(10000, Number(url.searchParams.get('page')) || 0),
        );
      const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
      const invites = db
        .prepare(
          'SELECT * FROM enrollment_invites WHERE email LIKE ? ORDER BY created_at DESC,id LIMIT 31 OFFSET ?',
        )
        .all(`%${q}%`, page * 30) as Invite[];
      return json({
        items: invites.slice(0, 30).map(safeInvite),
        hasMore: invites.length > 30,
        page,
      });
    }
    if (request.method !== 'POST') throw new HttpError(405, '操作不支持');
    await limit(p, 'invite-create', 30, 3600);
    if (id && path[3] === 'revoke') {
      db.prepare(
        'UPDATE enrollment_invites SET revoked_at=? WHERE id=? AND redeemed_at IS NULL',
      ).run(Date.now(), id);
      return json({ saved: true });
    }
    if (id) throw new HttpError(404, '邀请操作不存在');
    const d = z
      .object({
        emails: z.array(z.email().max(254)).min(1).max(50),
        courseIds: z.array(z.string().min(1).max(100)).min(1).max(50),
        days: z.number().int().min(1).max(30).default(7),
      })
      .strict()
      .parse(await body(request));
    const emails = [...new Set(d.emails.map((e) => e.trim().toLowerCase()))];
    const courseIds = d.courseIds.includes('*')
      ? ['*']
      : [...new Set(d.courseIds)];
    for (const courseId of courseIds)
      if (
        courseId !== '*' &&
        !db.prepare('SELECT id FROM courses WHERE id=?').get(courseId)
      )
        throw new HttpError(400, '课程不存在');
    const admins = setting('ADMIN_EMAILS')
      .split(',')
      .map((e) => e.trim().toLowerCase());
    if (emails.some((e) => admins.includes(e)))
      throw new HttpError(400, '老师账号不需要学员邀请');
    const now = Date.now(),
      expiresAt = now + d.days * 86400000;
    const result = db.transaction(() =>
      emails.map((email) => {
        const token = randomBytes(32).toString('base64url'),
          inviteId = randomUUID();
        db.prepare(
          'INSERT INTO enrollment_invites(id,token_hash,email,course_ids,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?)',
        ).run(
          inviteId,
          digest(token),
          email,
          JSON.stringify(courseIds),
          p.id,
          now,
          expiresAt,
        );
        db.prepare(
          'INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)',
        ).run(randomUUID(), p.id, 'invite.create', inviteId, now);
        return {
          id: inviteId,
          email,
          expiresAt,
          url: `${origin()}/#invite=${token}`,
        };
      }),
    )();
    return json({ items: result }, 201);
  }
  if (resource !== 'enrollment') return null;
  if (request.method !== 'POST') throw new HttpError(405, '操作不支持');
  const ip = request.headers.get('x-real-ip') || 'local';
  await limit(
    {
      id: 'invite:' + digest(ip).slice(0, 24),
      email: '',
      name: '',
      role: 'student',
      verified: false,
    },
    'activation',
    15,
  );
  const data = await body(request);
  const token = tokenSchema.parse(data?.token),
    invite = inviteFor(token);
  const existing = db
    .prepare('SELECT id,email FROM user WHERE lower(email)=?')
    .get(invite.email) as { id: string; email: string } | undefined;
  if (action === 'inspect') {
    if (invite.redeemed_at) return json({ ...safeInvite(invite), used: true });
    const titles = (JSON.parse(invite.course_ids) as string[]).map((c) =>
      c === '*'
        ? '全部课程'
        : (
            db.prepare('SELECT title FROM courses WHERE id=?').get(c) as
              | { title: string }
              | undefined
          )?.title || c,
    );
    return json({
      email: invite.email,
      name: invite.name,
      titles,
      expiresAt: invite.expires_at,
      requiresLogin: !!existing,
      used: false,
      matchesAccount: !p || p.email === invite.email,
    });
  }
  if (action !== 'activate') throw new HttpError(404, '邀请操作不存在');
  if (invite.redeemed_at)
    throw new HttpError(409, '此邀请已经使用，请直接登录');
  if (existing && (!p || p.id !== existing.id || p.email !== invite.email))
    throw new HttpError(409, '该邮箱已有账号，请先使用原账号登录，再接受邀请');
  if (p && p.email !== invite.email)
    throw new HttpError(409, '邀请属于另一个邮箱，请切换到对应账号');
  const d = existing
    ? null
    : z
        .object({
          name: z.string().trim().min(1).max(100),
          password: z.string().min(12).max(128),
        })
        .parse(data);
  const passwordHash = d ? await hashPassword(d.password) : null;
  const userId = existing?.id || randomUUID(),
    now = Date.now();
  db.transaction(() => {
    // Claim is checked again inside the same transaction as account and grants.
    const claimed = db
      .prepare(
        'UPDATE enrollment_invites SET redeemed_at=?,redeemed_by=? WHERE id=? AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at>?',
      )
      .run(now, userId, invite.id, now);
    if (!claimed.changes) throw new HttpError(409, '邀请状态已变化，请刷新');
    if (!existing && d) {
      if (
        db.prepare('SELECT id FROM user WHERE lower(email)=?').get(invite.email)
      )
        throw new HttpError(409, '邮箱刚刚注册，请使用已有账号登录');
      db.prepare(
        'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
      ).run(userId, d.name, invite.email, 1, now, now);
      db.prepare(
        'INSERT INTO account(id,account_id,provider_id,issuer,user_id,password,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
      ).run(
        randomUUID(),
        userId,
        'credential',
        'local:credential',
        userId,
        passwordHash,
        now,
        now,
      );
    } else
      db.prepare(
        'UPDATE user SET email_verified=1,updated_at=? WHERE id=?',
      ).run(now, userId);
    for (const courseId of JSON.parse(invite.course_ids) as string[]) {
      db.prepare(
        'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)',
      ).run(
        `invite:${invite.id}:${courseId}`,
        invite.email,
        courseId,
        'invitation',
        now,
      );
    }
    db.prepare(
      'INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)',
    ).run(randomUUID(), userId, 'invite.redeem', invite.id, now);
  })();
  if (d) {
    // Use Better Auth to issue the session and cookie; never hand-roll session tokens.
    return auth().api.signInEmail({
      body: { email: invite.email, password: d.password },
      headers: request.headers,
      asResponse: true,
    });
  }
  return json({ activated: true });
}
