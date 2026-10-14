import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { HttpError, json, limit } from './http';
import { readJson } from './my-practice';

/** `cswork_pat_` + 32 random bytes (base64url). Only the SHA-256 hex is stored. */
export const TOKEN_PREFIX = 'cswork_pat_';
const TOKEN = /^cswork_pat_[A-Za-z0-9_-]{43}$/;
const MAX_ACTIVE = 10;
const name = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^\P{Cc}+$/u),
  })
  .strict();

// ponytail: plain SHA-256 is enough for 256-bit random secrets; a slow hash only matters for passwords.
export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/**
 * Everything a token may call, as method + path under /api/. Notes, lists, the account,
 * token management itself and teacher tools still need a browser session.
 */
const SCOPES = [
  ['read', 'GET', /^oj\/(?:daily|library|oa-library|problems\/[\w-]{1,100})$/],
  ['submit', 'POST', /^oj\/submissions$/],
  ['results', 'GET', /^oj\/submissions\/[\w-]{1,100}$/],
] as const;
export function tokenScope(method: string, path: string) {
  return SCOPES.find(([, m, pattern]) => m === method && pattern.test(path))?.[0] ?? null;
}

type TokenRow = {
  id: string;
  user_id: string;
  last_used_at: number | null;
  email: string;
  name: string;
  email_verified: number;
};

/**
 * The learner behind `Authorization: Bearer cswork_pat_…`, or null when the request
 * carries no such header (the browser session applies then). A token never reads the
 * session cookie, acts as a student even for an admin, and only reaches SCOPES.
 */
export async function tokenCaller(request: Request, path: string[]) {
  const header = request.headers.get('authorization') ?? '';
  if (!/^bearer\s+cswork_pat_/i.test(header)) return null;
  const scope = tokenScope(request.method, path.join('/'));
  if (!scope) throw new HttpError(403, '访问令牌不能调用这个接口');
  const token = header.replace(/^bearer\s+/i, '').trim();
  const row = TOKEN.test(token)
    ? (sqlite()
        .prepare(
          `SELECT t.id,t.user_id,t.last_used_at,u.email,u.name,u.email_verified
          FROM api_tokens t JOIN "user" u ON u.id=t.user_id
          WHERE t.token_hash=? AND t.revoked_at IS NULL`,
        )
        .get(hashToken(token)) as TokenRow | undefined)
    : undefined;
  if (!row) throw new HttpError(401, '访问令牌无效或已吊销');
  await limit({ id: `pat:${row.id}` } as Person, 'pat', 60);
  const p: Person = {
    id: row.user_id,
    email: row.email.toLowerCase(),
    name: row.name,
    role: 'student',
    verified: !!row.email_verified,
  };
  // Scripts judge on top of the per-minute run/submit limits: a separate hourly budget per learner.
  if (scope === 'submit') await limit(p, 'pat-judge', 120, 3600);
  const now = Date.now();
  if (!row.last_used_at || now - row.last_used_at > 60000)
    sqlite().prepare('UPDATE api_tokens SET last_used_at=? WHERE id=?').run(now, row.id);
  return p;
}

/** Password changes and resets and "sign out other devices" end every token too (auth.ts). */
export function revokeUserTokens(userId: string) {
  sqlite()
    .prepare('UPDATE api_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL')
    .run(Date.now(), userId);
}

/** GET/POST oj/tokens and POST oj/tokens/:id/revoke: the signed-in learner's own tokens. */
export async function handleApiTokens(request: Request, p: Person, path: string[]) {
  const [id, action, ...rest] = path;
  const db = sqlite();
  if (request.method === 'GET' && !id) {
    await limit(p, 'pat-read', 60);
    return json({
      items: db
        .prepare(
          `SELECT id,name,created_at AS createdAt,last_used_at AS lastUsedAt FROM api_tokens
          WHERE user_id=? AND revoked_at IS NULL ORDER BY created_at DESC`,
        )
        .all(p.id),
    });
  }
  if (request.method !== 'POST' || rest.length || (id && action !== 'revoke'))
    throw new HttpError(404, '接口不存在');
  await limit(p, 'pat-write', 30, 3600);
  if (id) {
    const { changes } = db
      .prepare(
        'UPDATE api_tokens SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL',
      )
      .run(Date.now(), id, p.id);
    if (!changes) throw new HttpError(404, '访问令牌不存在');
    return json({ ok: true });
  }
  const data = name.parse(await readJson(request, 2000));
  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM api_tokens WHERE user_id=? AND revoked_at IS NULL')
    .get(p.id) as { n: number };
  if (n >= MAX_ACTIVE) throw new HttpError(409, '最多保留 10 个访问令牌，请先吊销不用的');
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  const item = { id: randomUUID(), name: data.name, createdAt: Date.now(), lastUsedAt: null };
  db.prepare(
    'INSERT INTO api_tokens(id,user_id,name,token_hash,created_at) VALUES(?,?,?,?,?)',
  ).run(item.id, p.id, item.name, hashToken(token), item.createdAt);
  // The only response that ever carries the token itself.
  return json({ token, item }, 201);
}
