import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Person } from './auth';
import { sqlite } from '@/db/sqlite';
import {
  HttpError,
  body,
  json,
  requirePerson,
  requireTeacher,
  sameOrigin,
  limit,
} from './http';
import {
  annotateCommerceCourses,
  checkout,
  orderDetail,
  orderRow,
  reconcileSession,
  refundOrder,
  stripeReady,
  validPrice,
} from './payments';
export { annotateCommerceCourses } from './payments';
const objectId = z.string().min(1).max(200);
const sessionId = z
  .string()
  .regex(/^cs_[A-Za-z0-9_]+$/)
  .max(250);
export async function handleCommerce(
  request: Request,
  p: Person | null,
  path: string[],
): Promise<Response | null> {
  const [resource, id, action, subaction] = path;
  const ours =
    resource === 'checkout' ||
    resource === 'orders' ||
    (resource === 'teacher' &&
      (id === 'orders' || (id === 'courses' && subaction === 'price')));
  if (!ours) return null;
  requirePerson(p);
  if (request.method !== 'GET') sameOrigin(request);
  const db = sqlite();
  if (resource === 'checkout') {
    if (request.method !== 'POST' || path.length !== 1)
      throw new HttpError(405, '操作方式无效');
    return json(
      await checkout(
        p,
        z
          .object({ courseId: objectId })
          .strict()
          .parse(await body(request)).courseId,
      ),
    );
  }
  if (resource === 'orders') {
    if (request.method === 'GET' && !id) {
      const ids = db
        .prepare(
          'SELECT id FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100',
        )
        .all(p.id) as { id: string }[];
      return json(await Promise.all(ids.map((o) => orderDetail(p, o.id))));
    }
    if (request.method === 'GET' && id && path.length === 2)
      return json(await orderDetail(p, id, true));
    if (request.method === 'POST' && id === 'reconcile' && path.length === 2) {
      const d = z
        .object({ sessionId })
        .strict()
        .parse(await body(request));
      const order = await reconcileSession(d.sessionId, p);
      return json(await orderDetail(p, order.id));
    }
    // Order-id reconciliation supports an interrupted return to the site without sharing Stripe IDs.
    if (
      request.method === 'POST' &&
      action === 'refresh' &&
      path.length === 3
    ) {
      const order = orderRow(id);
      if (!order || (order.user_id !== p.id && p.role !== 'teacher'))
        throw new HttpError(404, '订单不存在');
      if (order.checkout_id) await reconcileSession(order.checkout_id, p);
      return json(await orderDetail(p, id, true));
    }
    throw new HttpError(405, '操作方式无效');
  }
  requireTeacher(p);
  if (id === 'orders') {
    if (request.method === 'GET' && path.length === 2) {
      const url = new URL(request.url),
        q = (url.searchParams.get('q') || '').trim().slice(0, 100),
        status = (url.searchParams.get('status') || '').slice(0, 30);
      const ids = db
        .prepare(
          "SELECT id FROM orders WHERE (?='' OR email LIKE ? OR id LIKE ?) AND (?='' OR status=?) ORDER BY created_at DESC LIMIT 100",
        )
        .all(q, `%${q}%`, `%${q}%`, status, status) as { id: string }[];
      return json({
        orders: await Promise.all(ids.map((o) => orderDetail(p, o.id))),
        configured: stripeReady(),
      });
    }
    if (
      request.method === 'POST' &&
      action &&
      subaction === 'refund' &&
      path.length === 4
    ) {
      const d = z
        .object({
          amount: z.number().int().positive().optional(),
          reason: z.string().trim().min(2).max(1000),
          idempotencyKey: z.string().uuid(),
        })
        .strict()
        .parse(await body(request));
      return json(await refundOrder(p, action, d));
    }
    throw new HttpError(405, '操作方式无效');
  }
  if (id === 'courses' && action && subaction === 'price') {
    if (request.method !== 'POST' || path.length !== 4)
      throw new HttpError(405, '操作方式无效');
    await limit(p, 'price-config', 20, 300);
    const d = z
      .object({
        priceId: z
          .string()
          .regex(/^price_[A-Za-z0-9]+$/)
          .max(150)
          .nullable(),
      })
      .strict()
      .parse(await body(request));
    const course = db
      .prepare('SELECT id,published FROM courses WHERE id=?')
      .get(action) as { id: string; published: number } | undefined;
    if (!course) throw new HttpError(404, '课程不存在');
    if (d.priceId) await validPrice(d.priceId, true);
    db.transaction(() => {
      db.prepare('UPDATE courses SET price_id=? WHERE id=?').run(
        d.priceId || '',
        action,
      );
      db.prepare(
        'INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)',
      ).run(randomUUID(), p.id, 'course.price.update', action, Date.now());
    })();
    return json((await annotateCommerceCourses([course], p))[0]);
  }
  return null;
}
