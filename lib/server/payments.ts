import Stripe from 'stripe';
import { setting, origin, database } from './env';
import { HttpError, one, json, limit, allowed, boundedText } from './http';
import type { Person } from './auth';
function stripe() {
  if (!setting('STRIPE_SECRET_KEY'))
    throw new HttpError(503, '课程购买暂未开放');
  return new Stripe(setting('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-07-29.dahlia',
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
    timeout: 12000,
  });
}
export async function checkout(p: Person, courseId: string) {
  if (
    courseId !== 'gomall' ||
    !setting('STRIPE_PRICE_GOMALL') ||
    !setting('STRIPE_WEBHOOK_SECRET')
  )
    throw new HttpError(503, '课程购买暂未开放，请联系老师开通');
  if (!p.verified) throw new HttpError(403, '请先验证邮箱');
  await limit(p, 'checkout', 5, 300);
  if (
    (await allowed(p, courseId)) ||
    (await one(
      "SELECT id FROM orders WHERE email=? AND course_id=? AND status='paid'",
      p.email,
      courseId,
    ))
  )
    throw new HttpError(409, '你已拥有此课程，无需重复购买');
  const client = stripe(),
    now = Date.now();
  const existing = await one<any>(
    "SELECT checkout_id FROM orders WHERE user_id=? AND course_id=? AND status='pending' AND checkout_id IS NOT NULL ORDER BY created_at DESC LIMIT 1",
    p.id,
    courseId,
  );
  if (existing) {
    const pending = await client.checkout.sessions.retrieve(
      existing.checkout_id,
    );
    if (pending.status === 'open' && pending.url) return { url: pending.url };
    if (pending.status === 'complete')
      throw new HttpError(409, '支付结果正在确认，请稍后刷新课程权限');
  }
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${p.id}:${courseId}:${Math.floor(now / 900000)}`),
  );
  const id = Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  await database()
    .prepare(
      'INSERT OR IGNORE INTO orders(id,user_id,email,course_id,status,created_at) VALUES(?,?,?,?,?,?)',
    )
    .bind(id, p.id, p.email, courseId, 'pending', now)
    .run();
  const prior = await one<any>('SELECT * FROM orders WHERE id=?', id);
  if (prior?.status === 'paid')
    throw new HttpError(409, '此课程已经购买，请刷新页面');
  if (prior?.status === 'refunded')
    throw new HttpError(409, '该订单已退款，请稍后重新购买');
  const session = await client.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [{ price: setting('STRIPE_PRICE_GOMALL'), quantity: 1 }],
      customer_email: p.email,
      client_reference_id: id,
      metadata: { orderId: id, courseId },
      payment_intent_data: { metadata: { orderId: id } },
      success_url: `${origin()}/?view=courses&payment=success`,
      cancel_url: `${origin()}/?view=courses&payment=cancelled`,
      allow_promotion_codes: true,
      integration_identifier: 'cswork_abcdefgh',
    },
    { idempotencyKey: `course:${id}` },
  );
  await database()
    .prepare('UPDATE orders SET checkout_id=? WHERE id=?')
    .bind(session.id, id)
    .run();
  if (!session.url) throw new HttpError(503, '结账页面暂不可用');
  return { url: session.url };
}
export async function webhook(request: Request) {
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  if (!setting('STRIPE_WEBHOOK_SECRET'))
    throw new HttpError(503, '支付尚未配置');
  const signature = request.headers.get('stripe-signature');
  if (!signature) throw new HttpError(400, '缺少签名');
  let event: Stripe.Event;
  const raw = await boundedText(request, 150000);
  try {
    event = await stripe().webhooks.constructEventAsync(
      raw,
      signature,
      setting('STRIPE_WEBHOOK_SECRET'),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    throw new HttpError(400, '签名验证失败');
  }
  const db = database(),
    now = Date.now();
  if (await one('SELECT id FROM webhook_events WHERE id=?', event.id))
    return json({ received: true });
  const statements = [
    db
      .prepare('INSERT INTO webhook_events(id,created_at) VALUES(?,?)')
      .bind(event.id, now),
  ];
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const s = event.data.object as Stripe.Checkout.Session;
    if (
      s.payment_status !== 'paid' &&
      !(
        s.payment_status === 'no_payment_required' &&
        s.amount_total === 0 &&
        s.status === 'complete'
      )
    )
      return json({ received: true });
    const orderId = s.metadata?.orderId;
    if (!orderId) throw new HttpError(400, '订单信息缺失');
    const o = await one<any>('SELECT * FROM orders WHERE id=?', orderId);
    if (
      !o ||
      s.client_reference_id !== o.id ||
      s.metadata?.courseId !== o.course_id ||
      s.mode !== 'payment' ||
      (o.checkout_id && o.checkout_id !== s.id)
    )
      throw new HttpError(400, '订单信息不一致');
    // Read current Stripe state so a late completion event cannot restore a refunded course.
    const pi =
      typeof s.payment_intent === 'string'
        ? await stripe().paymentIntents.retrieve(s.payment_intent, {
            expand: ['latest_charge'],
          })
        : null;
    const charge = pi?.latest_charge as Stripe.Charge | null;
    const refunded = o.status === 'refunded' || !!charge?.refunded;
    statements.push(
      db
        .prepare(
          "UPDATE orders SET status=CASE WHEN status='refunded' THEN 'refunded' ELSE ? END,checkout_id=?,payment_intent=?,amount=?,currency=? WHERE id=?",
        )
        .bind(
          refunded ? 'refunded' : 'paid',
          s.id,
          pi?.id || null,
          s.amount_total,
          s.currency,
          o.id,
        ),
    );
    if (!refunded)
      statements.push(
        db
          .prepare(
            "INSERT OR IGNORE INTO grants(id,email,course_id,source,created_at) SELECT ?,email,course_id,?,? FROM orders WHERE id=? AND status='paid'",
          )
          .bind(`order:${o.id}`, 'purchase', now, o.id),
      );
    if (refunded)
      statements.push(
        db
          .prepare('UPDATE grants SET revoked_at=? WHERE id=?')
          .bind(now, `order:${o.id}`),
      );
  } else if (event.type === 'charge.refunded') {
    const c = event.data.object as Stripe.Charge;
    if (c.refunded && typeof c.payment_intent === 'string') {
      let o = await one<any>(
        'SELECT * FROM orders WHERE payment_intent=?',
        c.payment_intent,
      );
      if (!o) {
        const pi = await stripe().paymentIntents.retrieve(c.payment_intent);
        if (pi.metadata.orderId)
          o = await one<any>(
            'SELECT * FROM orders WHERE id=?',
            pi.metadata.orderId,
          );
      }
      if (o)
        statements.push(
          db
            .prepare(
              "UPDATE orders SET status='refunded',payment_intent=? WHERE id=?",
            )
            .bind(c.payment_intent, o.id),
          db
            .prepare('UPDATE grants SET revoked_at=? WHERE id=?')
            .bind(now, `order:${o.id}`),
        );
    }
  }
  try {
    await db.batch(statements);
  } catch (e) {
    if (!(await one('SELECT id FROM webhook_events WHERE id=?', event.id)))
      throw e;
  }
  return json({ received: true });
}
