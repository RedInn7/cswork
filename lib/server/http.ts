import { ZodError } from 'zod';
import { database, origin } from './env';
import type { Person } from './auth';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function fail(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error: '请检查填写内容',
        fields: error.issues.map((i) => i.path.join('.')),
      },
      400,
    );
  console.error(
    'API failure',
    error instanceof Error ? error.message : 'unknown',
  );
  return json({ error: '暂时无法完成，请稍后重试' }, 500);
}
export function requirePerson(p: Person | null): asserts p is Person {
  if (!p) throw new HttpError(401, '请先登录');
}
export function requireTeacher(p: Person | null): asserts p is Person {
  requirePerson(p);
  if (p.role !== 'teacher') throw new HttpError(403, '仅老师可以执行此操作');
}
export function sameOrigin(request: Request) {
  const from = request.headers.get('origin');
  if (!from || from !== new URL(origin()).origin)
    throw new HttpError(403, '请求来源无效');
}
export async function boundedText(request: Request, max = 150000) {
  if (Number(request.headers.get('content-length') || 0) > max)
    throw new HttpError(413, '内容过长');
  if (!request.body) return '';
  const reader = request.body.getReader(),
    decoder = new TextDecoder();
  let size = 0,
    text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, '内容过长');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
export async function body(request: Request) {
  const text = await boundedText(request);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, '无效的请求内容');
  }
}
export async function rows<T = Record<string, unknown>>(
  sql: string,
  ...values: (string | number | null)[]
): Promise<T[]> {
  return (
    await database()
      .prepare(sql)
      .bind(...values)
      .all<T>()
  ).results;
}
export async function one<T = Record<string, unknown>>(
  sql: string,
  ...values: (string | number | null)[]
): Promise<T | null> {
  return database()
    .prepare(sql)
    .bind(...values)
    .first<T>();
}
export async function allowed(p: Person, courseId: string) {
  if (p.role === 'teacher') return true;
  if (!p.verified) return false;
  return !!(await one(
    "SELECT id FROM grants WHERE email=? AND (course_id=? OR course_id='*') AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?) LIMIT 1",
    p.email,
    courseId,
    Date.now(),
  ));
}
export async function requireCourse(p: Person, courseId: string) {
  if (!(await allowed(p, courseId)))
    throw new HttpError(403, '此课程尚未开通，请联系老师或购买课程');
}
export async function limit(
  p: Person,
  action: string,
  max: number,
  seconds = 60,
) {
  const now = Date.now();
  const key = `${p.id}:${action}:${Math.floor(now / (seconds * 1000))}`;
  const result = await database()
    .prepare(
      'INSERT INTO limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    )
    .bind(key, now + seconds * 1000)
    .first<{ count: number }>();
  if (result && result.count > max)
    throw new HttpError(429, '操作有些频繁，请稍后再试');
}
export function auditStatement(p: Person, action: string, target: string) {
  return database()
    .prepare(
      'INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)',
    )
    .bind(crypto.randomUUID(), p.id, action, target, Date.now());
}
