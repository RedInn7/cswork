import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { setting, origin } from './env';
import { sqlite } from '@/db/sqlite';
import { HttpError, json, limit, allowed, boundedText } from './http';
import type { Person } from './auth';
import {
  money,
  type CommerceOrder,
  type OrderStatus,
  type RefundStatus,
} from '@/lib/commerce-types';

export type OrderRow = {
  id: string;
  user_id: string;
  email: string;
  course_id: string;
  price_id: string | null;
  checkout_id: string | null;
  payment_intent: string | null;
  status: OrderStatus;
  amount: number | null;
  currency: string | null;
  amount_refunded: number;
  receipt_url: string | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
  paid_at: number | null;
  access_revoked_at: number | null;
};
export function stripeReady() {
  return !!(setting('STRIPE_SECRET_KEY') && setting('STRIPE_WEBHOOK_SECRET'));
}
export function stripeClient() {
  if (!setting('STRIPE_SECRET_KEY'))
    throw new HttpError(503, '课程购买尚未开放，可先向老师申请开通。');
  let transport: { host?: string; port?: number; protocol?: 'http' | 'https' } =
    {};
  if (setting('STRIPE_API_BASE_URL')) {
    const url = new URL(setting('STRIPE_API_BASE_URL'));
    if (
      url.protocol !== 'https:' &&
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    )
      throw new Error('Invalid Stripe transport');
    transport = {
      host: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      protocol: url.protocol.slice(0, -1) as 'http' | 'https',
    };
  }
  return new Stripe(setting('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-07-29.dahlia',
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
    timeout: 10000,
    ...transport,
  });
}
export function orderRow(id: string) {
  return sqlite().prepare('SELECT * FROM orders WHERE id=?').get(id) as
    | OrderRow
    | undefined;
}
export function coursePriceId(courseId: string, includeHidden = false) {
  const c = sqlite()
    .prepare('SELECT price_id,published FROM courses WHERE id=?')
    .get(courseId) as
    | { price_id: string | null; published: number }
    | undefined;
  if (!c || (!includeHidden && !c.published))
    throw new HttpError(404, '课程不存在');
  // An explicit empty string disables the legacy environment price after a teacher removes it.
  return c.price_id === null && courseId === 'gomall'
    ? setting('STRIPE_PRICE_GOMALL')
    : c.price_id || '';
}
const priceCache = new Map<string, { expires: number; value: Stripe.Price }>();
export async function validPrice(priceId: string, fresh = false) {
  if (!/^price_[A-Za-z0-9]+$/.test(priceId))
    throw new HttpError(400, '请输入有效的 Stripe Price ID');
  const cacheKey = `${setting('STRIPE_API_BASE_URL')}:${priceId}`;
  const cached = priceCache.get(cacheKey);
  if (!fresh && cached && cached.expires > Date.now()) return cached.value;
  let price: Stripe.Price;
  try {
    price = await stripeClient().prices.retrieve(priceId, {
      expand: ['product'],
    });
  } catch (e) {
    if (e instanceof Stripe.errors.StripeInvalidRequestError)
      throw new HttpError(400, '该价格不存在或不属于当前支付账号');
    throw new HttpError(503, '暂时无法确认价格，请稍后重试');
  }
  const product = price.product;
  if (
    !price.active ||
    price.type !== 'one_time' ||
    price.recurring ||
    price.unit_amount === null ||
    !Number.isSafeInteger(price.unit_amount) ||
    price.unit_amount < 0 ||
    (typeof product !== 'string' &&
      ('deleted' in product ? product.deleted : !product.active))
  )
    throw new HttpError(400, '请选择已启用、固定金额的一次性课程价格');
  priceCache.set(cacheKey, { expires: Date.now() + 60000, value: price });
  return price;
}
export async function annotateCommerceCourses<
  T extends { id: string; published?: number },
>(courses: T[], p: Person | null) {
  await Promise.all(
    courses.map(async (c) => {
      const priceId = coursePriceId(c.id, p?.role === 'teacher');
      const extra = c as T & {
        price_id?: string | null;
        price?: { amount: number; currency: string; display: string } | null;
        purchase_available?: boolean;
      };
      if (p?.role === 'teacher') extra.price_id = priceId || null;
      extra.purchase_available = false;
      extra.price = null;
      if (!stripeReady() || !priceId) return;
      try {
        const price = await validPrice(priceId);
        extra.price = {
          amount: price.unit_amount!,
          currency: price.currency,
          display: money(price.unit_amount, price.currency),
        };
        extra.purchase_available = c.published !== 0;
      } catch {
        /* A provider outage cannot take down learning or imply a price is verified. */
      }
    }),
  );
  return courses;
}
function lockOrder(p: Person, courseId: string, price: Stripe.Price) {
  const db = sqlite(),
    now = Date.now();
  return db.transaction(() => {
    // Stripe price lookup yields to other requests; keep the final admission
    // decision and order reservation in the same database transaction.
    if (coursePriceId(courseId) !== price.id)
      throw new HttpError(409, '课程价格已更新，请刷新后重新购买');
    const hasAccess = db
      .prepare(
        "SELECT id FROM grants WHERE email=? AND (course_id=? OR course_id='*') AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?) LIMIT 1",
      )
      .get(p.email, courseId, now);
    const hasPaid = db
      .prepare(
        "SELECT id FROM orders WHERE user_id=? AND course_id=? AND status IN ('paid','partially_refunded') LIMIT 1",
      )
      .get(p.id, courseId);
    if (hasAccess || hasPaid)
      throw new HttpError(409, '课程已经开通，无需重复购买');
    const existing = db
      .prepare(
        'SELECT o.* FROM commerce_checkout_locks l JOIN orders o ON o.id=l.order_id WHERE l.user_id=? AND l.course_id=?',
      )
      .get(p.id, courseId) as OrderRow | undefined;
    if (existing) return existing;
    // Adopt a pre-upgrade pending checkout so deploying does not create another charge opportunity.
    const previous = db
      .prepare(
        "SELECT * FROM orders WHERE user_id=? AND course_id=? AND status IN ('creating','pending','processing') ORDER BY created_at DESC LIMIT 1",
      )
      .get(p.id, courseId) as OrderRow | undefined;
    const id = previous?.id || randomUUID();
    if (!previous)
      db.prepare(
        "INSERT INTO orders(id,user_id,email,course_id,price_id,status,amount,currency,created_at,updated_at) VALUES(?,?,?,?,?,'creating',?,?,?,?)",
      ).run(
        id,
        p.id,
        p.email,
        courseId,
        price.id,
        price.unit_amount,
        price.currency,
        now,
        now,
      );
    else if (!previous.price_id)
      db.prepare('UPDATE orders SET price_id=? WHERE id=?').run(price.id, id);
    db.prepare(
      'INSERT INTO commerce_checkout_locks(user_id,course_id,order_id,created_at) VALUES(?,?,?,?)',
    ).run(p.id, courseId, id, now);
    return orderRow(id)!;
  })();
}
export async function checkout(p: Person, courseId: string) {
  if (!p.verified) throw new HttpError(403, '请先验证邮箱');
  if (await allowed(p, courseId))
    throw new HttpError(409, '课程已经开通，无需重复购买');
  if (!stripeReady())
    throw new HttpError(503, '课程购买尚未开放，可先向老师申请开通。');
  await limit(p, 'checkout', 8, 300);
  const priceId = coursePriceId(courseId);
  if (!priceId)
    throw new HttpError(503, '这门课程暂未开放购买，请向老师申请开通');
  const price = await validPrice(priceId),
    client = stripeClient();
  for (let attempt = 0; attempt < 2; attempt++) {
    const order = lockOrder(p, courseId, price);
    if (order.checkout_id) {
      const session = await retrieveSession(order.checkout_id);
      await applySession(order, session);
      if (session.status === 'open' && session.url)
        return { url: session.url, orderId: order.id };
      const latest = orderRow(order.id)!;
      if (['failed', 'expired', 'refunded'].includes(latest.status)) continue;
      if (latest.status === 'paid' || latest.status === 'partially_refunded')
        throw new HttpError(409, '付款已确认，课程已开通，请刷新页面');
      throw new HttpError(409, '支付仍在处理中，请在账号页查看订单进度');
    }
    try {
      const session = await client.checkout.sessions.create(
        {
          mode: 'payment',
          line_items: [{ price: order.price_id!, quantity: 1 }],
          customer_email: order.email,
          client_reference_id: order.id,
          metadata: { orderId: order.id, courseId },
          payment_intent_data: { metadata: { orderId: order.id } },
          success_url: `${origin()}/?view=courses&payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin()}/?view=account&payment=cancelled`,
          allow_promotion_codes: true,
          integration_identifier: 'cswork_qmzkrvta',
        },
        { idempotencyKey: `cswork:checkout:${order.id}` },
      );
      sqlite()
        .prepare(
          "UPDATE orders SET checkout_id=?,status=CASE WHEN status='creating' THEN 'pending' ELSE status END,last_error=NULL,updated_at=? WHERE id=?",
        )
        .run(session.id, Date.now(), order.id);
      if (!session.url) throw new Error('Missing checkout URL');
      return { url: session.url, orderId: order.id };
    } catch {
      sqlite()
        .prepare('UPDATE orders SET last_error=?,updated_at=? WHERE id=?')
        .run(
          '暂时未能打开结账页面，重试会继续同一订单。',
          Date.now(),
          order.id,
        );
      throw new HttpError(503, '结账暂时不可用，请稍后重试；不会重复创建订单');
    }
  }
  throw new HttpError(503, '正在更新订单，请稍后重试');
}
async function retrieveSession(id: string) {
  try {
    return await stripeClient().checkout.sessions.retrieve(id, {
      expand: ['line_items.data.price', 'payment_intent.latest_charge'],
    });
  } catch (e) {
    if (e instanceof Stripe.errors.StripeInvalidRequestError)
      throw new HttpError(404, '订单不存在');
    throw new HttpError(503, '支付状态暂时无法确认，请稍后重试');
  }
}
function referenceId(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id || null;
}
function validateSession(order: OrderRow, session: Stripe.Checkout.Session) {
  if (
    session.mode !== 'payment' ||
    session.client_reference_id !== order.id ||
    session.metadata?.orderId !== order.id ||
    session.metadata?.courseId !== order.course_id ||
    (order.checkout_id && order.checkout_id !== session.id)
  )
    throw new HttpError(400, '支付订单信息不一致');
  const lines = session.line_items?.data;
  if (
    !lines ||
    lines.length !== 1 ||
    lines[0].quantity !== 1 ||
    (order.price_id && referenceId(lines[0].price) !== order.price_id) ||
    (order.currency && session.currency !== order.currency)
  )
    throw new HttpError(400, '支付价格信息不一致');
}
async function paymentState(session: Stripe.Checkout.Session) {
  const client = stripeClient();
  const pi =
    typeof session.payment_intent === 'string'
      ? await client.paymentIntents.retrieve(session.payment_intent, {
          expand: ['latest_charge'],
        })
      : session.payment_intent;
  const charge =
    pi && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
  const refunds = pi
    ? await client.refunds
        .list({ payment_intent: pi.id, limit: 100 })
        .autoPagingToArray({ limit: 1000 })
    : [];
  return { pi, charge, refunds };
}
function storeRefund(refund: Stripe.Refund, order: OrderRow, now: number) {
  const db = sqlite();
  const own = refund.metadata?.csworkRefundId;
  const existing = db
    .prepare(
      'SELECT id FROM order_refunds WHERE order_id=? AND (stripe_refund_id=? OR id=?)',
    )
    .get(order.id, refund.id, own || '') as { id: string } | undefined;
  if (existing)
    db.prepare(
      'UPDATE order_refunds SET stripe_refund_id=?,amount=?,status=?,updated_at=?,last_error=? WHERE id=?',
    ).run(
      refund.id,
      refund.amount,
      refund.status || 'pending',
      now,
      refund.failure_reason || null,
      existing.id,
    );
  else
    db.prepare(
      'INSERT INTO order_refunds(id,order_id,stripe_refund_id,idempotency_key,amount,status,reason,requested_by,created_at,updated_at,last_error) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      `stripe:${refund.id}`,
      order.id,
      refund.id,
      `stripe:${refund.id}`,
      refund.amount,
      refund.status || 'pending',
      '通过支付平台操作',
      'stripe',
      refund.created * 1000,
      now,
      refund.failure_reason || null,
    );
}
async function applySession(order: OrderRow, session: Stripe.Checkout.Session) {
  validateSession(order, session);
  const { pi, charge, refunds } = await paymentState(session);
  const paid =
    session.payment_status === 'paid' ||
    (session.payment_status === 'no_payment_required' &&
      session.amount_total === 0 &&
      session.status === 'complete');
  const amountRefunded = refunds
    .filter((r) => r.status === 'succeeded')
    .reduce((sum, r) => sum + r.amount, 0);
  const fullyRefunded =
    paid &&
    (session.amount_total || 0) > 0 &&
    amountRefunded >= session.amount_total!;
  let status: OrderStatus = paid
    ? fullyRefunded
      ? 'refunded'
      : amountRefunded > 0
        ? 'partially_refunded'
        : 'paid'
    : session.status === 'expired'
      ? 'expired'
      : session.status === 'complete'
        ? pi && ['requires_payment_method', 'canceled'].includes(pi.status)
          ? 'failed'
          : 'processing'
        : 'pending';
  const db = sqlite();
  db.transaction(() => {
    const latest = orderRow(order.id)!;
    if (latest.updated_at !== order.updated_at)
      throw new HttpError(409, '订单状态正在更新，请稍后刷新');
    const now = Math.max(Date.now(), latest.updated_at + 1);
    // A delayed unpaid snapshot must not undo a confirmed payment. Refund state is read from Stripe.
    if (
      !paid &&
      ['paid', 'partially_refunded', 'refunded'].includes(latest.status)
    )
      return;
    for (const refund of refunds) storeRefund(refund, latest, now);
    db.prepare(
      'UPDATE orders SET status=?,checkout_id=?,payment_intent=?,amount=?,currency=?,amount_refunded=?,receipt_url=?,updated_at=?,paid_at=COALESCE(paid_at,?),last_error=? WHERE id=?',
    ).run(
      status,
      session.id,
      pi?.id || null,
      session.amount_total,
      session.currency,
      amountRefunded,
      charge?.receipt_url || null,
      now,
      paid ? now : null,
      status === 'failed' ? '支付未完成，可以重新发起购买。' : null,
      order.id,
    );
    if (paid && !fullyRefunded) {
      db.prepare(
        "INSERT OR IGNORE INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,'purchase',?)",
      ).run(`order:${order.id}`, order.email, order.course_id, now);
      if (latest.access_revoked_at !== null) {
        db.prepare(
          'UPDATE grants SET revoked_at=NULL WHERE id=? AND revoked_at=?',
        ).run(`order:${order.id}`, latest.access_revoked_at);
        db.prepare('UPDATE orders SET access_revoked_at=NULL WHERE id=?').run(
          order.id,
        );
      }
    } else if (fullyRefunded) {
      const changed = db
        .prepare(
          'UPDATE grants SET revoked_at=? WHERE id=? AND revoked_at IS NULL',
        )
        .run(now, `order:${order.id}`);
      if (changed.changes)
        db.prepare('UPDATE orders SET access_revoked_at=? WHERE id=?').run(
          now,
          order.id,
        );
    }
    if (!['creating', 'pending', 'processing'].includes(status))
      db.prepare('DELETE FROM commerce_checkout_locks WHERE order_id=?').run(
        order.id,
      );
  })();
  return orderRow(order.id)!;
}
export async function reconcileSession(sessionId: string, p?: Person) {
  if (p) await limit(p, 'payment-reconcile', 30, 60);
  const known = sqlite()
    .prepare('SELECT * FROM orders WHERE checkout_id=?')
    .get(sessionId) as OrderRow | undefined;
  if (p && known && known.user_id !== p.id && p.role !== 'teacher')
    throw new HttpError(404, '订单不存在');
  const session = await retrieveSession(sessionId);
  const order =
    known ||
    (session.metadata?.orderId
      ? orderRow(session.metadata.orderId)
      : undefined);
  if (!order || (p && order.user_id !== p.id && p.role !== 'teacher'))
    throw new HttpError(404, '订单不存在');
  return applySession(order, session);
}
export async function orderDetail(
  p: Person,
  id: string,
  resume = false,
): Promise<CommerceOrder> {
  const order = orderRow(id);
  if (!order || (order.user_id !== p.id && p.role !== 'teacher'))
    throw new HttpError(404, '订单不存在');
  const course = sqlite()
    .prepare('SELECT title FROM courses WHERE id=?')
    .get(order.course_id) as { title: string } | undefined;
  const student: Person = {
    id: order.user_id,
    email: order.email,
    name: '',
    role: 'student',
    verified: true,
  };
  let checkoutUrl: string | null = null;
  if (
    resume &&
    order.checkout_id &&
    ['pending', 'creating'].includes(order.status) &&
    stripeReady()
  ) {
    try {
      const s = await retrieveSession(order.checkout_id);
      if (s.status === 'open') checkoutUrl = s.url;
    } catch {
      /* Stored order remains useful during a provider outage. */
    }
  }
  return {
    id: order.id,
    course_id: order.course_id,
    course_title: course?.title || order.course_id,
    ...(p.role === 'teacher' ? { email: order.email } : {}),
    status: order.status,
    amount: order.amount,
    currency: order.currency,
    amount_refunded: order.amount_refunded,
    created_at: order.created_at,
    updated_at: order.updated_at,
    paid_at: order.paid_at,
    receipt_url: order.receipt_url,
    last_error: order.last_error,
    has_access: await allowed(student, order.course_id),
    refunds: sqlite()
      .prepare(
        'SELECT id,amount,status,reason,created_at,updated_at,last_error FROM order_refunds WHERE order_id=? ORDER BY created_at DESC',
      )
      .all(order.id) as CommerceOrder['refunds'],
    ...(resume ? { checkout_url: checkoutUrl } : {}),
  };
}
export async function refundOrder(
  p: Person,
  id: string,
  input: { amount?: number; reason: string; idempotencyKey: string },
) {
  if (p.role !== 'teacher') throw new HttpError(403, '仅老师可以执行退款');
  await limit(p, 'refund', 10, 300);
  let order = orderRow(id);
  if (!order || !order.checkout_id) throw new HttpError(404, '订单不存在');
  await reconcileSession(order.checkout_id);
  order = orderRow(id)!;
  if (
    !order.payment_intent ||
    !['paid', 'partially_refunded', 'refunded'].includes(order.status)
  )
    throw new HttpError(409, '这笔订单尚无可退回的付款');
  const db = sqlite(),
    now = Date.now();
  const operation = db.transaction(() => {
    const old = db
      .prepare('SELECT * FROM order_refunds WHERE idempotency_key=?')
      .get(input.idempotencyKey) as
      | {
          id: string;
          order_id: string;
          amount: number;
          status: RefundStatus;
          stripe_refund_id: string | null;
          reason: string;
        }
      | undefined;
    if (old) {
      if (
        old.order_id !== id ||
        (input.amount !== undefined && old.amount !== input.amount) ||
        old.reason !== input.reason
      )
        throw new HttpError(409, '退款操作标识已用于另一请求');
      return old;
    }
    const reserved = db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) AS amount FROM order_refunds WHERE order_id=? AND status IN ('requested','pending','requires_action')",
      )
      .get(id) as { amount: number };
    const available =
      (order!.amount || 0) - order!.amount_refunded - reserved.amount;
    const amount = input.amount ?? available;
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > available)
      throw new HttpError(
        409,
        '可退款金额已变化，或已有退款正在处理，请刷新订单',
      );
    const operation = {
      id: randomUUID(),
      order_id: id,
      amount,
      status: 'requested' as const,
      stripe_refund_id: null,
      reason: input.reason,
    };
    db.prepare(
      "INSERT INTO order_refunds(id,order_id,idempotency_key,amount,status,reason,requested_by,created_at,updated_at) VALUES(?,?,?,?,'requested',?,?,?,?)",
    ).run(
      operation.id,
      id,
      input.idempotencyKey,
      amount,
      input.reason,
      p.id,
      now,
      now,
    );
    db.prepare(
      'INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)',
    ).run(randomUUID(), p.id, 'order.refund.request', operation.id, now);
    return operation;
  })();
  if (operation.stripe_refund_id) return orderDetail(p, id);
  try {
    const refund = await stripeClient().refunds.create(
      {
        payment_intent: order.payment_intent,
        amount: operation.amount,
        metadata: { orderId: id, csworkRefundId: operation.id },
      },
      { idempotencyKey: `cswork:refund:${operation.id}` },
    );
    db.transaction(() => storeRefund(refund, order!, Date.now()))();
    await reconcileSession(order.checkout_id!);
  } catch (e) {
    const definitive =
      e instanceof Stripe.errors.StripeInvalidRequestError ||
      e instanceof Stripe.errors.StripePermissionError;
    db.prepare(
      'UPDATE order_refunds SET status=?,last_error=?,updated_at=? WHERE id=? AND stripe_refund_id IS NULL',
    ).run(
      definitive ? 'failed' : 'requested',
      definitive
        ? '退款请求未被支付平台接受。'
        : '请求结果待确认。请使用同一操作重试，避免重复退款。',
      Date.now(),
      operation.id,
    );
    throw new HttpError(
      503,
      definitive
        ? '支付平台未接受退款，请检查订单后重试。'
        : '退款结果正在确认，请稍后刷新；重试会继续同一笔退款。',
    );
  }
  return orderDetail(p, id);
}
export async function webhook(request: Request) {
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  if (!setting('STRIPE_WEBHOOK_SECRET'))
    throw new HttpError(503, '支付尚未配置');
  const signature = request.headers.get('stripe-signature');
  if (!signature) throw new HttpError(400, '缺少签名');
  const raw = await boundedText(request, 150000);
  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(
      raw,
      signature,
      setting('STRIPE_WEBHOOK_SECRET'),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    throw new HttpError(400, '签名验证失败');
  }
  const db = sqlite();
  if (db.prepare('SELECT id FROM webhook_events WHERE id=?').get(event.id))
    return json({ received: true });
  if (
    [
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'checkout.session.expired',
    ].includes(event.type)
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.orderId && orderRow(session.metadata.orderId))
      await reconcileSession(session.id);
  } else if (
    [
      'charge.refunded',
      'refund.created',
      'refund.updated',
      'refund.failed',
    ].includes(event.type)
  ) {
    const value = event.data.object as Stripe.Charge | Stripe.Refund;
    const piId = referenceId(value.payment_intent);
    let order = piId
      ? (db.prepare('SELECT * FROM orders WHERE payment_intent=?').get(piId) as
          | OrderRow
          | undefined)
      : undefined;
    if (!order && piId) {
      const pi = await stripeClient().paymentIntents.retrieve(piId);
      if (pi.metadata.orderId) order = orderRow(pi.metadata.orderId);
    }
    if (order?.checkout_id) await reconcileSession(order.checkout_id);
    // If the refund beat checkout persistence, its completion webhook/reconcile reads live refunds.
  }
  db.prepare(
    'INSERT OR IGNORE INTO webhook_events(id,created_at) VALUES(?,?)',
  ).run(event.id, Date.now());
  return json({ received: true });
}
